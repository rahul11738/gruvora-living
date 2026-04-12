import hashlib
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Awaitable, Callable, Dict, Optional, Tuple

logger = logging.getLogger(__name__)


class ResponseCacheMiddleware:
    """Reusable response cache helper with Redis + in-memory fallback."""

    def __init__(
        self,
        redis_client=None,
        *,
        prefix: str = "api-cache",
        max_items: int = 2000,
    ):
        self.redis = redis_client
        self.prefix = prefix
        self.max_items = max_items
        self._memory_cache: Dict[str, Dict[str, Any]] = {}

    def _make_key(self, namespace: str, params: Dict[str, Any]) -> str:
        normalized = {k: params.get(k) for k in sorted(params.keys())}
        digest = hashlib.sha256(
            json.dumps(normalized, sort_keys=True, default=str).encode("utf-8")
        ).hexdigest()[:24]
        return f"{self.prefix}:{namespace}:{digest}"

    async def get_or_set(
        self,
        namespace: str,
        params: Dict[str, Any],
        producer: Callable[[], Awaitable[Dict[str, Any]]],
        *,
        ttl_seconds: int,
    ) -> Tuple[Dict[str, Any], bool]:
        cache_key = self._make_key(namespace, params)

        cached_payload = await self._read(cache_key)
        if cached_payload is not None:
            return cached_payload, True

        payload = await producer()
        await self._write(cache_key, payload, ttl_seconds)
        return payload, False

    async def invalidate_namespace(self, namespace: str) -> int:
        return await self.invalidate_pattern(f"{self.prefix}:{namespace}:*")

    async def invalidate_pattern(self, pattern: str) -> int:
        removed = 0

        if self.redis:
            try:
                keys = []
                async for key in self.redis.scan_iter(match=pattern, count=200):
                    keys.append(key)
                if keys:
                    removed += int(await self.redis.delete(*keys))
            except Exception as exc:
                logger.warning("Redis invalidation fallback for %s: %s", pattern, exc)

        memory_keys = [k for k in self._memory_cache.keys() if self._match(pattern, k)]
        for key in memory_keys:
            self._memory_cache.pop(key, None)
            removed += 1

        return removed

    async def _read(self, cache_key: str) -> Optional[Dict[str, Any]]:
        if self.redis:
            try:
                cached = await self.redis.get(cache_key)
                if cached:
                    return json.loads(cached)
            except Exception as exc:
                logger.warning("Redis cache read fallback for %s: %s", cache_key, exc)

        entry = self._memory_cache.get(cache_key)
        if not entry:
            return None

        if entry["expires_at"] <= datetime.now(timezone.utc):
            self._memory_cache.pop(cache_key, None)
            return None

        return entry["payload"]

    async def _write(self, cache_key: str, payload: Dict[str, Any], ttl_seconds: int) -> None:
        if self.redis:
            try:
                await self.redis.setex(
                    cache_key,
                    ttl_seconds,
                    json.dumps(payload, default=str),
                )
                return
            except Exception as exc:
                logger.warning("Redis cache write fallback for %s: %s", cache_key, exc)

        if len(self._memory_cache) >= self.max_items:
            self._evict_memory_cache()

        self._memory_cache[cache_key] = {
            "payload": payload,
            "expires_at": datetime.now(timezone.utc)
            + timedelta(seconds=ttl_seconds),
        }

    def _evict_memory_cache(self) -> None:
        now = datetime.now(timezone.utc)
        expired_keys = [
            key
            for key, value in self._memory_cache.items()
            if value.get("expires_at") <= now
        ]
        for key in expired_keys:
            self._memory_cache.pop(key, None)

        if len(self._memory_cache) >= self.max_items:
            oldest_key = next(iter(self._memory_cache), None)
            if oldest_key:
                self._memory_cache.pop(oldest_key, None)

    @staticmethod
    def _match(pattern: str, value: str) -> bool:
        if pattern.endswith("*"):
            return value.startswith(pattern[:-1])
        return value == pattern
