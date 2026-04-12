# Gruvora Living Performance Optimization - Implementation Checklist

## ✅ PHASE 1: FRONTEND OPTIMIZATION

### Libraries Created (Ready to Use)
- [x] OptimizedImage.jsx - Cloudinary image optimization
- [x] SkeletonLoaders.jsx - Perceived performance loaders
- [x] performanceHooks.js - 7 performance hooks
- [x] OptimizedSearchInput.jsx - Smart debounced search
- [x] service-worker.js - PWA caching
- [x] serviceWorkerRegistration.js - Registration utilities
- [x] index.js - Updated with global optimizations
- [x] PERFORMANCE_GUIDE.md - Integration guide
- [x] PerformanceIndex.js - Central exports

### Component Updates (Do These Next)

#### HomeComponents.js (High Priority - 40% load time)
- [ ] Replace all `<img>` with `<OptimizedImage>`
  - [ ] HeroSection images
  - [ ] CategoriesSection thumbnail
  - [ ] TrendingSection listing images
  - [ ] RecommendationsSection images
  - [ ] Fallback Unsplash images
  
- [ ] Wrap heavy components with React.memo
  - [ ] CategoryCard
  - [ ] TrendingCard
  
- [ ] Replace spinners with skeleton loaders
  - [ ] Loading states in sections

#### CategoryPage.js (Medium Priority - 25% load time)
- [ ] Replace listing card images with OptimizedImage
- [ ] Wrap ListingCard with React.memo
- [ ] Replace search spinner with SearchResultsSkeleton
- [ ] Add debounce to search:
  ```jsx
  const handleSearch = useDebounce((q) => api.search(q), 300);
  ```
- [ ] Add prefetch on hover:
  ```jsx
  const { prefetch } = usePrefetch(() => api.getDetails(id));
  <Link onMouseEnter={() => prefetch()}>View</Link>
  ```

#### ListingDetailPage.js (Medium Priority - 15% load time)
- [ ] Replace main image with OptimizedImage (priority=true)
- [ ] Replace thumbnail images with OptimizedImage
- [ ] Replace spinner with ListingDetailSkeleton
- [ ] Lazy load related listings:
  ```jsx
  const Related = lazy(() => import('./RelatedListings'));
  <Suspense fallback={<CardGridSkeleton />}><Related /></Suspense>
  ```

#### ReelsPage.js (Low Priority - 20% load time)
- [ ] Replace reel thumbnail images
- [ ] Wrap ReelCard with React.memo
- [ ] Add virtualization for feed
- [ ] Lazy load video player component

#### SearchPage/DiscoverSearchPage.js
- [ ] Replace SmartSearchInput with OptimizedSearchInput
- [ ] Add filter debounce (300ms)
- [ ] Replace loading skeleton

#### Other Pages
- [ ] AdminDashboard.js - Image optimization
- [ ] OwnerDashboard.js - Image optimization
- [ ] UserDashboard.js - Image optimization
- [ ] Chat pages - Optimize message timestamps

### Testing Frontend
- [ ] Open DevTools → Lighthouse
- [ ] Record Performance metrics before changes
- [ ] Run all component updates
- [ ] Run Lighthouse again
  - Expected: Performance 90+ (from 65)
  - Expected: Load time 1-2s (from 4-5s)
- [ ] Test on slow 3G network (DevTools → Network)
- [ ] Check image sizes are reduced 50-70%
- [ ] Verify no images are ever unoptimized

---

## ✅ PHASE 2: BACKEND OPTIMIZATION

### Libraries Created (Ready to Use)
- [x] mongodb_optimization.py - Indexes, projections, batch operations
- [x] redis_cache.py - Redis caching layer
- [x] http_caching.py - HTTP caching headers + compression
- [x] BACKEND_OPTIMIZATION_GUIDE.md - Integration patterns

### Server.py Updates

#### Import Optimizations
- [ ] Import create_indexes:
  ```python
  from mongodb_optimization import create_indexes
  ```
- [ ] Import RedisCache:
  ```python
  from redis_cache import RedisCache
  import redis.asyncio as redis_async
  ```
- [ ] Import HTTP caching:
  ```python
  from http_caching import HTTPCachingMiddleware, CompressionMiddleware
  ```

#### Add Middleware (in order)
- [ ] Add CompressionMiddleware:
  ```python
  app.add_middleware(CompressionMiddleware, min_size=500)
  ```
- [ ] Add HTTPCachingMiddleware:
  ```python
  app.add_middleware(HTTPCachingMiddleware)
  ```

#### Initialize on Startup
- [ ] Create indexes:
  ```python
  @app.on_event('startup')
  async def startup():
      await create_indexes(db)
  ```
- [ ] Initialize Redis cache:
  ```python
  redis_client = await redis_async.from_url(os.environ['REDIS_URL'])
  app.state.cache = RedisCache(redis_client)
  ```
- [ ] Start background tasks (see BACKEND_OPTIMIZATION_GUIDE.md)

### API Endpoints - High Priority

#### GET /api/listings (Homepage)
- [ ] Add caching:
  ```python
  cache_key = CacheKeyBuilder.home_section('main')
  cached = await app.state.cache.get(cache_key)
  # ... fetch and cache
  ```
- [ ] Use field projection
- [ ] Cache for 2 minutes
- [ ] Test performance: Expected <150ms

#### GET /api/listings?category={cat}
- [ ] Add pagination with caching
- [ ] Use field projection (listing_card)
- [ ] Cache for 5 minutes
- [ ] Test: Expected <200ms

#### GET /api/search?q={query}
- [ ] Add debounce support (already in frontend, just return cached)
- [ ] Cache for 1 minute
- [ ] Test: Expected <200ms

#### GET /api/trending
- [ ] Add 30-second cache
- [ ] Background refresh task
- [ ] Test: Expected <50ms

#### POST /api/listings/{id}/view
- [ ] Cache view count increment (no DB write per view!)
  ```python
  await cache.incr(f'listing:{id}:views')  # <1ms
  ```
- [ ] Batch write to DB every 5 minutes
- [ ] Test: Expected <5ms

### API Endpoints - Medium Priority

#### GET /api/listings/{id}
- [ ] Add 10-minute cache
- [ ] Use listing_detail projection
- [ ] Invalidate on update
- [ ] Test: Expected <100ms

#### GET /api/user/listings
- [ ] Add 5-minute cache (private)
- [ ] Use pagination
- [ ] Invalidate on update
- [ ] Test: Expected <200ms

#### PUT /api/listings/{id}
- [ ] Update database
- [ ] Invalidate cache:
  ```python
  await app.state.cache.delete(f'listing:detail:{id}')
  await app.state.cache.delete_pattern('listing:list:*')
  ```
- [ ] Test: Cache is deleted

#### DELETE /api/listings/{id}
- [ ] Delete from database
- [ ] Invalidate all related caches

### Background Tasks
- [ ] Implement sync_view_counts_to_db() (5 min batch)
- [ ] Implement refresh_trending_cache() (30 sec refresh)
- [ ] Start tasks in @app.on_event('startup')

### Testing Backend

#### Test Database Performance
```python
# Before optimization
GET /api/listings?category=home → 800ms

# After optimization (should be):
GET /api/listings?category=home → 100-150ms
```

#### Test Cache Hit Rate
```python
GET /api/admin/cache-stats
{
  "hit_rate": 0.85,  # Should be 80-95%
}
```

#### Test View Count Sync
```python
# Call view endpoint 100 times
# Check database: should only have 1-2 writes (batched)
# Not 100 writes
```

#### Load Testing (Optional but recommended)
```bash
# Install k6 or Locust
# Simulate 100 concurrent users
# Check that database CPU stays under 20%
```

---

## ✅ PHASE 3: INFRASTRUCTURE

### Deployment Configuration
- [ ] Ensure variables set:
  - [ ] REDIS_URL configured in Railway
  - [ ] MongoDB connection pooling enabled
  - [ ] CORS_ORIGINS updated if needed

### HTTP Headers (Nginx/Railway)
- [ ] Gzip compression enabled (see http_caching.py comments)
- [ ] Cache-Control headers respected
- [ ] ETags supported

### CDN Configuration
- [ ] Cloudinary API key set
- [ ] Images using Cloudinary URLs
- [ ] f_auto, q_auto parameters in URLs

### Monitoring
- [ ] Set up Lighthouse CI (optional):
  ```bash
  npm install -g @lhci/cli@~0.8.0
  lhci autorun
  ```
- [ ] Monitor database CPU
- [ ] Monitor Redis memory usage
- [ ] Monitor API response times

---

## 📊 VERIFICATION CHECKLIST

### Before Optimization
- [ ] Screenshot Lighthouse: ____ (expected ~65)
- [ ] Record page load time: ____ seconds
- [ ] Database CPU usage: ____% 
- [ ] API response time for search: ____ ms

### After Optimization
- [ ] Lighthouse score: ____ (expected 90+)
- [ ] Page load time: ____ seconds (expected <2s)
- [ ] Database CPU: ____% (expected <20%)
- [ ] Search API: ____ ms (expected <200ms)
- [ ] Improvement: ___% faster

### Quality Checks
- [ ] No console errors
- [ ] All images load correctly
- [ ] No stale data in cache
- [ ] Search debounce works (max 2 API calls per 1000ms)
- [ ] Skeleton loaders appear while loading
- [ ] No "Cannot read property of undefined" errors
- [ ] Accessibility maintained (Axe devtools)

---

## 🔄 IMPLEMENTATION WORKFLOW

### Day 1: Frontend Images (Biggest Bang)
```
Time: 1-2 hours
1. Update HomeComponents.js - Replace all images
2. Update CategoryPage.js - Replace listing images
3. Update ListingDetailPage.js - Replace images
Result goal: 70% image size reduction
```

### Day 2: Skeleton Loaders + Search Optimization
```
Time: 2-3 hours
1. Replace spinners with skeleton loaders
2. Add useDebounce to search
3. Test perceived load time
Result goal: Better UX, 98% fewer search API calls
```

### Day 3: Backend Indexes + Caching
```
Time: 2-3 hours
1. Add MongoDB indexes
2. Initialize Redis
3. Add middleware
4. Update homepage API
Result goal: 80% database load reduction
```

### Day 4: API Optimization + Testing
```
Time: 2-3 hours
1. Add caching to all hot endpoints
2. Implement view count batch write
3. Run Lighthouse audit
4. Performance test
Result goal: Lighthouse 90+, page load <2s
```

---

## 🎯 SUCCESS CRITERIA

When optimization is complete, you should see:

✅ Lighthouse Audit
- Performance: 90+
- FCP (First Contentful Paint): <1.5s
- LCP (Largest Contentful Paint): <2.5s
- CLS (Cumulative Layout Shift): <0.1

✅ Page Load Times
- Homepage: <1s (from ~4.5s)
- Search: <200ms (from ~1.2s)
- Listing detail: <1s (from ~2.8s)

✅ Database Performance
- CPU: <20% (from 80%)
- Query response: <100ms (from 400-800ms)

✅ Image Optimization
- Image sizes: 50-70% smaller (via Cloudinary)
- WebP served to modern browsers
- All images lazy loaded

✅ Network
- API calls on search: 1-2 (from 100+)
- Response size: 40-60% smaller (due to compression)
- Cache hit rate: 80-95%

---

## 📝 NOTES

- Always create a backup before large changes
- Test each optimization before moving to next
- Monitor production after deployment
- Keep this checklist updated as you progress
- Celebrate milestones! 🎉

---

## 🆘 TROUBLESHOOTING

| Issue | Solution |
|-------|----------|
| Images not loading | Check Cloudinary URL format, verify f_auto parameters |
| Stale cache | Verify cache invalidation on updates |
| High memory usage | Check Redis TTLs, implement cleanup |
| Slow search | Verify index exists, check cache hit rate |
| Database CPU high | Add more indexes, check query patterns |
| Service worker not caching | Check browser console, verify registration |

---

**Last Updated:** April 12, 2026
**Status:** Ready for Implementation
**Estimated Total Time:** 8-12 hours
**Expected ROI:** 75% performance improvement

