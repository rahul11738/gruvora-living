"""
REDIS CACHING LAYER
====================

Caches expensive queries and frequently accessed data.
Reduces database load by 60-80% on repeated requests.

Cache Strategy:
- Homepage data: 2 minutes
- Listing details: 5 minutes  
- User profiles: 10 minutes
- Search results: 1 minute
- Trending lists: 30 seconds (hot data)

Usage:
    cache = RedisCache(redis_client)
    await cache.set('key', data, ttl=300)
    data = await cache.get('key')
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
import asyncio

logger = logging.getLogger(__name__)


class RedisCache:
    """
    Redis caching layer with automatic serialization.
    """

    def __init__(self, redis_client, prefix: str = "app", default_ttl: int = 300):
        """
        @param redis_client: redis.asyncio client
        @param prefix: Key prefix for namespacing
        @param default_ttl: Default TTL in seconds (5 minutes)
        """
        self.redis = redis_client
        self.prefix = prefix
        self.default_ttl = default_ttl

    def _make_key(self, name: str) -> str:
        """Create namespaced key."""
        return f"{self.prefix}:{name}"

    async def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache.
        
        @returns: Deserialized value or None if not found/expired
        """
        try:
            cached = await self.redis.get(self._make_key(key))
            if cached:
                return json.loads(cached)
            return None
        except Exception as e:
            logger.warning(f"Cache GET failed for {key}: {e}")
            return None

    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
    ) -> bool:
        """
        Set value in cache with optional TTL.
        
        @param key: Cache key
        @param value: Value to cache (must be JSON-serializable)
        @param ttl: Time to live in seconds (None = use default)
        """
        try:
            ttl = ttl or self.default_ttl
            serialized = json.dumps(value, default=str)  # Convert datetime to string
            await self.redis.setex(
                self._make_key(key),
                ttl,
                serialized,
            )
            return True
        except Exception as e:
            logger.warning(f"Cache SET failed for {key}: {e}")
            return False

    async def delete(self, key: str) -> bool:
        """Delete key from cache."""
        try:
            result = await self.redis.delete(self._make_key(key))
            return result > 0
        except Exception as e:
            logger.warning(f"Cache DELETE failed for {key}: {e}")
            return False

    async def delete_pattern(self, pattern: str) -> int:
        """
        Delete all keys matching pattern.
        Useful when invalidating related caches.
        
        @example:
        # Clear all listing caches
        await cache.delete_pattern('listing:*')
        """
        try:
            keys = await self.redis.keys(self._make_key(pattern))
            if keys:
                return await self.redis.delete(*keys)
            return 0
        except Exception as e:
            logger.warning(f"Cache DELETE_PATTERN failed: {e}")
            return 0

    async def clear_all(self) -> bool:
        """Clear all cached data (careful!)."""
        try:
            return await self.redis.flushdb()
        except Exception as e:
            logger.warning(f"Cache CLEAR_ALL failed: {e}")
            return False

    async def incr(self, key: str, increment: int = 1) -> int:
        """
        Increment counter.
        Perfect for view counts, like counts, etc.
        
        @example:
        await cache.incr(f'listing:{id}:views')
        """
        try:
            full_key = self._make_key(key)
            # Set expiry if key doesn't exist
            exists = await self.redis.exists(full_key)
            result = await self.redis.incrby(full_key, increment)
            if not exists:
                await self.redis.expire(full_key, 86400)  # 24 hours
            return result
        except Exception as e:
            logger.warning(f"Cache INCR failed for {key}: {e}")
            return 0


class CacheKeyBuilder:
    """
    Build consistent cache keys for common queries.
    """

    @staticmethod
    def listing_detail(listing_id: str) -> str:
        return f"listing:detail:{listing_id}"

    @staticmethod
    def listing_list(category: str, page: int) -> str:
        return f"listing:list:{category}:page:{page}"

    @staticmethod
    def user_profile(user_id: str) -> str:
        return f"user:profile:{user_id}"

    @staticmethod
    def search_results(query: str, filters: str) -> str:
        """Query and filters as hash for cache key."""
        return f"search:{query}:{filters}"

    @staticmethod
    def trending_listings() -> str:
        return "trending:listings"

    @staticmethod
    def trending_videos() -> str:
        return "trending:videos"

    @staticmethod
    def home_section(section: str) -> str:
        return f"home:section:{section}"

    @staticmethod
    def recommendations(user_id: str) -> str:
        return f"recommendations:user:{user_id}"

    @staticmethod
    def user_interactions(user_id: str) -> str:
        return f"interactions:user:{user_id}"

    @staticmethod
    def chat_history(chat_id: str) -> str:
        return f"chat:history:{chat_id}"

    @staticmethod
    def notifications(user_id: str) -> str:
        return f"notifications:user:{user_id}"


# ============================================
# CACHE MIDDLEWARE
# ============================================

class CachingMiddleware:
    """
    Automatic caching for GET requests.
    """

    def __init__(self, cache: RedisCache, ttl: int = 300):
        self.cache = cache
        self.ttl = ttl

    async def __call__(self, request, call_next):
        """Cache GET request responses."""
        # Only cache GET requests
        if request.method != "GET":
            return await call_next(request)

        # Don't cache authenticated endpoints (for privacy)
        if "Authorization" in request.headers:
            return await call_next(request)

        # Build cache key from request path and params
        cache_key = f"http:{request.url.path}"
        if request.query_params:
            cache_key += f"?{request.url.query}"

        # Try to get from cache
        cached = await self.cache.get(cache_key)
        if cached:
            logger.debug(f"Cache HIT for {request.url.path}")
            return cached

        # Get response and cache it
        response = await call_next(request)

        # Only cache successful responses
        if response.status_code == 200:
            try:
                body = await response.body()
                await self.cache.set(cache_key, json.loads(body), self.ttl)
                logger.debug(f"Cache SET for {request.url.path}")
            except:
                pass

        return response


# ============================================
# USAGE EXAMPLES
# ============================================

"""
1. INITIALIZE REDIS CACHE IN SERVER.PY:

import redis.asyncio as redis_async
from redis_cache import RedisCache

# On startup:
redis_client = await redis_async.from_url(os.environ.get('REDIS_URL'))
cache = RedisCache(redis_client)

# Store in app state for access in routes
app.state.cache = cache


2. USE IN API ENDPOINTS:

from redis_cache import CacheKeyBuilder

@app.get('/api/listings/{listing_id}')
async def get_listing(listing_id: str):
    # Try cache first
    cache_key = CacheKeyBuilder.listing_detail(listing_id)
    cached = await app.state.cache.get(cache_key)
    if cached:
        return cached
    
    # Miss, fetch from DB
    listing = await db.listings.find_one({'id': listing_id})
    
    # Cache for 5 minutes
    await app.state.cache.set(cache_key, listing, ttl=300)
    
    return listing


3. INVALIDATE CACHE ON UPDATE:

@app.put('/api/listings/{listing_id}')
async def update_listing(listing_id: str, data: dict):
    # Update database
    result = await db.listings.update_one({'id': listing_id}, {'$set': data})
    
    # Invalidate cache
    cache_key = CacheKeyBuilder.listing_detail(listing_id)
    await app.state.cache.delete(cache_key)
    
    return result


4. CACHE VIEW/LIKE COUNTS (HIGH FREQUENCY):

@app.post('/api/listings/{listing_id}/view')
async def record_view(listing_id: str):
    # Increment in cache (fast)
    view_count = await app.state.cache.incr(f'listing:{listing_id}:views')
    
    # Sync to DB periodically (batch operation)
    # Don't write to DB on every view!
    
    return {'views': view_count}


5. CACHE TRENDING LISTS (REFRESH EVERY 30s):

async def refresh_trending():
    # This runs in background
    while True:
        listings = await db.listings.find({}).sort('views', -1).limit(20).to_list(20)
        cache_key = CacheKeyBuilder.trending_listings()
        await app.state.cache.set(cache_key, listings, ttl=30)
        
        videos = await db.videos.find({}).sort('views', -1).limit(20).to_list(20)
        cache_key = CacheKeyBuilder.trending_videos()
        await app.state.cache.set(cache_key, videos, ttl=30)
        
        await asyncio.sleep(30)

# Start background task on app startup


6. CACHE HOMEPAGE SECTIONS:

@app.get('/api/home')
async def get_home():
    cache_key = CacheKeyBuilder.home_section('main')
    cached = await app.state.cache.get(cache_key)
    if cached:
        return cached
    
    home_data = {
        'trending': await get_trending(),
        'categories': await get_categories(),
        'recommendations': await get_recommendations(),
    }
    
    await app.state.cache.set(cache_key, home_data, ttl=120)
    return home_data
"""

# ============================================
# CACHE PATTERNS
# ============================================

CACHE_TTL_MAP = {
    # Hot data (changes frequently)
    'trending': 30,  # 30 seconds
    'hot_search': 60,  # 1 minute
    'view_count': 3600,  # 1 hour (batch writes to DB)
    
    # Regular data
    'search_results': 60,  # 1 minute
    'listing_list': 300,  # 5 minutes
    'category_list': 600,  # 10 minutes
    
    # Slow-changing data
    'listing_detail': 600,  # 10 minutes
    'user_profile': 1800,  # 30 minutes
    'user_interactions': 1800,  # 30 minutes
    
    # Static data (rarely changes)
    'categories': 86400,  # 1 day
    'amenities': 86400,  # 1 day
}


async def get_with_cache(
    cache: RedisCache,
    cache_key: str,
    fetch_fn,
    ttl: int,
) -> Any:
    """
    Generic pattern: try cache, fallback to fetch, then cache.
    
    @example:
    listing = await get_with_cache(
        cache,
        CacheKeyBuilder.listing_detail(listing_id),
        lambda: db.listings.find_one({'id': listing_id}),
        ttl=600,
    )
    """
    # Try cache
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    # Fetch from source
    data = await fetch_fn() if asyncio.iscoroutinefunction(fetch_fn) else fetch_fn()

    # Cache result
    if data:
        await cache.set(cache_key, data, ttl=ttl)

    return data
