import logging
import os
from typing import Optional

try:
    import redis.asyncio as redis_asyncio
except ImportError:  # pragma: no cover
    redis_asyncio = None

logger = logging.getLogger(__name__)


def get_redis_url() -> str:
    return os.environ.get("REDIS_URL", "").strip()


async def create_redis_client(redis_url: str):
    if not redis_url or not redis_asyncio:
        return None

    try:
        client = redis_asyncio.from_url(
            redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
            retry_on_timeout=True,
        )
        await client.ping()
        return client
    except Exception as exc:  # pragma: no cover
        logger.warning("Redis unavailable, running without shared cache: %s", exc)
        return None


async def close_redis_client(client: Optional[object]) -> None:
    if not client:
        return
    try:
        await client.close()
    except Exception:
        return
