from fastapi import (
    FastAPI,
    APIRouter,
    HTTPException,
    Depends,
    UploadFile,
    File,
    Query,
    status,
    WebSocket,
    WebSocketDisconnect,
    Form,
    Header,
    Response,
    Request,
    Body,
)
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
from pathlib import Path
import calendar
from pydantic import BaseModel, Field, EmailStr, ValidationError, field_validator
from typing import List, Optional, Dict, Any, Set, Tuple
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import json
import csv
import io
import importlib
from contextlib import asynccontextmanager
from enum import Enum
import asyncio
from collections import defaultdict, Counter
import hashlib
import socketio
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
from search_engine import (
    normalize_search_query,
    smart_search_listings,
    suggest_search_terms,
)
from listing_priority import (
    build_fresh_priority_until,
    listing_boost_score,
    listing_freshness_score,
)
from models.listing_base import ListingBaseCreate
from validators.listing_factory import validate_specific_fields

try:
    import redis.asyncio as redis_asyncio
except ImportError:
    redis_asyncio = None

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# MongoDB connection
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# JWT Config
JWT_SECRET = os.environ.get("JWT_SECRET", "gharsetu-secret-key-2024")
JWT_ALGORITHM = "HS256"


def _build_socketio_manager(redis_connection_url: str):
    if not redis_connection_url:
        return None
    try:
        return socketio.AsyncRedisManager(redis_connection_url)
    except Exception:
        return None


# Socket.IO server
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
    client_manager=_build_socketio_manager(os.environ.get("REDIS_URL", "")),
)

# Store connected users
connected_users: Dict[str, str] = {}  # user_id -> sid
JWT_EXPIRATION_HOURS = 24
interaction_locks: Dict[str, asyncio.Lock] = {}


def _get_interaction_lock(key: str) -> asyncio.Lock:
    lock = interaction_locks.get(key)
    if lock is None:
        lock = asyncio.Lock()
        interaction_locks[key] = lock
    return lock


@asynccontextmanager
async def lifespan(_: FastAPI):
    await startup_services()
    try:
        yield
    finally:
        await shutdown_db_client()


# Create the main app
app = FastAPI(
    title="GharSetu API",
    version="2.0.0",
    description="Full-scale real estate & services marketplace",
    lifespan=lifespan,
)

app.add_middleware(GZipMiddleware, minimum_size=1024)


@app.get("/")
async def root_probe():
    return {"status": "ok", "service": "gharsetu-api"}


@app.get("/health")
async def root_health_probe():
    return {
        "status": "healthy",
        "service": "gharsetu-api",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


api_router = APIRouter(prefix="/api")
security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


# ============ ENUMS ============
class UserRole(str, Enum):
    USER = "user"
    PROPERTY_OWNER = "property_owner"
    STAY_OWNER = "stay_owner"
    SERVICE_PROVIDER = "service_provider"
    HOTEL_OWNER = "hotel_owner"
    EVENT_OWNER = "event_owner"
    ADMIN = "admin"


class SubscriptionPlan(str, Enum):
    BASIC = "basic"
    PRO = "pro"
    UNLIMITED = "unlimited"  # For Property owners (₹999)
    # Service Provider Specific Plans
    SERVICE_BASIC = "service_basic"  # ₹50
    SERVICE_VERIFIED = "service_verified"  # ₹99
    SERVICE_TOP = "service_top"  # ₹149


class ListingCategory(str, Enum):
    HOME = "home"
    BUSINESS = "business"
    STAY = "stay"
    EVENT = "event"
    SERVICES = "services"


class ListingType(str, Enum):
    RENT = "rent"
    SELL = "sell"
    BOTH = "both"


class ListingStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    BOOSTED = "boosted"
    AWAITING_PAYMENT = "awaiting_payment"


class BookingStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class NegotiationStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    COUNTER = "counter"


class VerificationStatus(str, Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"


# ============ MODELS ============
class PlatformSettings(BaseModel):
    id: str = "platform_config"
    global_config: Dict[str, float]
    categories: Dict[str, Dict[str, float]]
    updated_at: Optional[str] = None


class UserRegister(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str
    gender: str
    address: str
    city: str = "Surat"
    state: str = "Gujarat"


class OwnerRegister(UserRegister):
    role: UserRole = UserRole.PROPERTY_OWNER
    aadhar_number: str
    aadhar_name: str
    business_name: Optional[str] = None
    coupon: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class RefreshToken(BaseModel):
    token: str


class ListingCreate(BaseModel):
    title: str
    description: str
    category: ListingCategory
    listing_type: ListingType
    sub_category: str
    price: float
    location: str
    city: str
    state: str = "Gujarat"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    amenities: List[str] = []
    images: List[str] = []
    videos: List[str] = []
    virtual_tour_url: Optional[str] = None
    contact_phone: str
    contact_email: str
    specifications: Dict[str, Any] = {}
    nearby_facilities: Dict[str, List[str]] = {}
    floor_plan_url: Optional[str] = None


class ListingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    location: Optional[str] = None
    amenities: Optional[List[str]] = None
    images: Optional[List[str]] = None
    videos: Optional[List[str]] = None
    specifications: Optional[Dict[str, Any]] = None
    is_available: Optional[bool] = None


class BookingCreate(BaseModel):
    listing_id: str
    booking_date: str
    end_date: Optional[str] = None
    check_in_time: Optional[str] = None
    check_out_time: Optional[str] = None
    guests: int = 1
    rooms: int = 1
    notes: str = ""
    special_requests: Optional[str] = None


class VideoCreate(BaseModel):
    title: str
    description: str
    video_url: str
    thumbnail_url: str
    listing_id: Optional[str] = None
    category: ListingCategory
    tags: List[str] = []
    duration: Optional[int] = None


class NegotiationCreate(BaseModel):
    listing_id: str
    offered_price: float
    message: str = ""


class NegotiationResponse(BaseModel):
    status: NegotiationStatus
    counter_price: Optional[float] = None
    message: str = ""


class ReviewCreate(BaseModel):
    listing_id: str
    rating: int = Field(ge=1, le=5)
    title: str
    comment: str
    images: List[str] = []


class ChatMessage(BaseModel):
    message: str
    images: Optional[List[str]] = None


class RecommendationInteractionEvent(BaseModel):
    listing_id: Optional[str] = None
    action: str = Field(..., min_length=2, max_length=48)
    source: Optional[str] = Field(default=None, max_length=64)
    query: Optional[str] = Field(default=None, max_length=200)
    city: Optional[str] = Field(default=None, max_length=80)
    category: Optional[str] = Field(default=None, max_length=32)
    price: Optional[float] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class UploadSignatureRequest(BaseModel):
    folder: str = "listings"
    resource_type: str = "auto"


class UploadDeleteRequest(BaseModel):
    public_id: str
    resource_type: str = "image"


ALLOWED_UPLOAD_FOLDERS = {"listings", "reels", "profile"}
_upload_rate_limit_windows: Dict[str, List[datetime]] = defaultdict(list)
redis_url = os.environ.get("REDIS_URL", "")
redis_client = None
delete_worker_task = None
DELETE_JOB_MAX_ATTEMPTS = 5
DELETE_RETRY_DELAYS_SECONDS = [30, 120, 600, 1800, 3600]
ADMIN_STATS_CACHE_KEY = "admin:stats:v2"
ADMIN_STATS_CACHE_TTL_SECONDS = int(
    os.environ.get("ADMIN_STATS_CACHE_TTL_SECONDS", "60")
)
RECOMMENDATIONS_CACHE_TTL_SECONDS = int(
    os.environ.get("RECOMMENDATIONS_CACHE_TTL_SECONDS", "120")
)
HOT_ENDPOINT_CACHE_TTL_SECONDS = int(
    os.environ.get("HOT_ENDPOINT_CACHE_TTL_SECONDS", "20")
)
HOT_ENDPOINT_CACHE_MAX_ITEMS = int(
    os.environ.get("HOT_ENDPOINT_CACHE_MAX_ITEMS", "1000")
)
_hot_endpoint_cache: Dict[str, Dict[str, Any]] = {}
RECOMMENDATION_ALLOWED_ACTIONS = {
    "view",
    "search",
    "map_marker_click",
    "map_card_click",
    "detail_view",
    "wishlist_add",
    "wishlist_remove",
    "contact_reveal",
}

OWNER_UPLOAD_ROLES = {
    UserRole.PROPERTY_OWNER,
    UserRole.STAY_OWNER,
    UserRole.SERVICE_PROVIDER,
    UserRole.HOTEL_OWNER,
    UserRole.EVENT_OWNER,
    UserRole.ADMIN,
}

ALL_LISTING_CATEGORIES = {
    ListingCategory.HOME.value,
    ListingCategory.BUSINESS.value,
    ListingCategory.STAY.value,
    ListingCategory.EVENT.value,
    ListingCategory.SERVICES.value,
}

ROLE_ALLOWED_LISTING_CATEGORIES = {
    UserRole.PROPERTY_OWNER.value: {
        ListingCategory.HOME.value,
        ListingCategory.BUSINESS.value,
    },
    UserRole.STAY_OWNER.value: {ListingCategory.STAY.value},
    UserRole.HOTEL_OWNER.value: {ListingCategory.STAY.value},
    UserRole.SERVICE_PROVIDER.value: {ListingCategory.SERVICES.value},
    UserRole.EVENT_OWNER.value: {ListingCategory.EVENT.value},
    UserRole.ADMIN.value: ALL_LISTING_CATEGORIES,
}


def get_allowed_listing_categories_for_role(role: Any) -> Set[str]:
    role_value = str(role.value if isinstance(role, Enum) else role or "").strip()
    return set(ROLE_ALLOWED_LISTING_CATEGORIES.get(role_value, set()))


def ensure_category_allowed_for_role(
    role: Any, category: Any, *, detail_prefix: str = "Category"
):
    category_value = (
        category.value if isinstance(category, Enum) else str(category or "").strip()
    )
    allowed = get_allowed_listing_categories_for_role(role)
    if not allowed or category_value not in allowed:
        allowed_label = ", ".join(sorted(allowed)) if allowed else "none"
        raise HTTPException(
            status_code=403,
            detail=f"{detail_prefix} '{category_value}' is not allowed for role '{role}'. Allowed: {allowed_label}",
        )


def _extract_cloudinary_video_public_id_and_version(
    raw_value: Any,
) -> Tuple[Optional[str], Optional[int]]:
    if raw_value is None:
        return None, None

    text = str(raw_value).strip()
    if not text:
        return None, None

    # Public ID only (already normalized)
    if not text.startswith("http://") and not text.startswith("https://"):
        cleaned = text.split("?", 1)[0]
        if (
            "/" in cleaned
            and cleaned.split("/", 1)[0].startswith("v")
            and cleaned.split("/", 1)[0][1:].isdigit()
        ):
            version_part, remainder = cleaned.split("/", 1)
            return remainder.rsplit(".", 1)[0], int(version_part[1:])
        return cleaned.rsplit(".", 1)[0], None

    if "res.cloudinary.com" not in text or "/video/upload/" not in text:
        return None, None

    tail = text.replace("http://", "https://", 1).split("/video/upload/", 1)[1]
    tail = tail.split("?", 1)[0]
    parts = [part for part in tail.split("/") if part]
    if not parts:
        return None, None

    version = None
    version_idx = None
    for idx, part in enumerate(parts):
        if re.fullmatch(r"v\d+", part):
            version = int(part[1:])
            version_idx = idx
            break

    public_parts = parts[version_idx + 1 :] if version_idx is not None else list(parts)

    if version_idx is None:

        def _is_transformation_segment(segment: str) -> bool:
            if not segment:
                return False
            tokens = segment.split(",")
            return all(
                re.fullmatch(r"[a-z]{1,5}_.+", token, flags=re.IGNORECASE)
                for token in tokens
            )

        while public_parts and _is_transformation_segment(public_parts[0]):
            public_parts.pop(0)

    if not public_parts:
        return None, version

    public_parts[-1] = public_parts[-1].rsplit(".", 1)[0]
    public_id = "/".join(public_parts).strip("/")
    if not public_id:
        return None, version

    return public_id, version


def _build_cloudinary_video_playback_url(
    public_id: str, version: Optional[int]
) -> Optional[str]:
    if not CLOUDINARY_CLOUD_NAME or not public_id:
        return None
    if version is not None:
        return f"https://res.cloudinary.com/{CLOUDINARY_CLOUD_NAME}/video/upload/v{int(version)}/{public_id}.mp4"
    return f"https://res.cloudinary.com/{CLOUDINARY_CLOUD_NAME}/video/upload/{public_id}.mp4"


CLOUDINARY_VIDEO_PUBLIC_ID_ALIASES: Dict[str, Tuple[str, Optional[int]]] = {
    "gharshetu/reels/f83a2271-c448-4c04-99ad-f2c3e4c8a06c": (
        "gharshetu/reels/ggqemxl7p6kvyzl92hux",
        1775508039,
    ),
}


def _normalize_video_doc_for_response(video_doc: Dict[str, Any]) -> Dict[str, Any]:
    doc = dict(video_doc)

    public_id = doc.get("video_public_id")
    version = doc.get("video_version")

    if isinstance(version, str) and version.isdigit():
        version = int(version)

    if not public_id:
        source = doc.get("video_url") or doc.get("url")
        extracted_public_id, extracted_version = (
            _extract_cloudinary_video_public_id_and_version(source)
        )
        if extracted_public_id:
            public_id = extracted_public_id
            if version is None:
                version = extracted_version

    if public_id:
        alias = CLOUDINARY_VIDEO_PUBLIC_ID_ALIASES.get(str(public_id))
        if alias:
            public_id, alias_version = alias
            if version is None and alias_version is not None:
                version = int(alias_version)

        canonical_url = _build_cloudinary_video_playback_url(str(public_id), version)
        if canonical_url:
            doc["video_public_id"] = str(public_id)
            doc["video_version"] = version
            doc["public_id"] = str(public_id)
            doc["version"] = f"v{int(version)}" if version is not None else None
            doc["video_url"] = canonical_url
            doc["url"] = canonical_url
            if not doc.get("thumbnail_url") or str(
                doc.get("thumbnail_url", "")
            ).startswith("http://"):
                if version is not None:
                    doc["thumbnail_url"] = (
                        f"https://res.cloudinary.com/{CLOUDINARY_CLOUD_NAME}/video/upload/v{int(version)}/{public_id}.jpg"
                    )
                else:
                    doc["thumbnail_url"] = (
                        f"https://res.cloudinary.com/{CLOUDINARY_CLOUD_NAME}/video/upload/{public_id}.jpg"
                    )
    else:
        fallback_url = str(doc.get("video_url") or doc.get("url") or "")
        if fallback_url:
            safe_url = fallback_url.replace("http://", "https://")
            doc["video_url"] = safe_url
            doc["url"] = safe_url
        doc["public_id"] = None
        doc["version"] = None

    if doc.get("thumbnail_url"):
        doc["thumbnail_url"] = str(doc["thumbnail_url"]).replace("http://", "https://")

    return doc


def _build_hot_cache_key(namespace: str, params: Dict[str, Any]) -> str:
    normalized = {k: params.get(k) for k in sorted(params.keys())}
    digest = hashlib.sha256(
        json.dumps(normalized, sort_keys=True, default=str).encode("utf-8")
    ).hexdigest()[:24]
    return f"{namespace}:{digest}"


async def get_hot_cached_payload(cache_key: str) -> Optional[Dict[str, Any]]:
    redis_key = f"hot:{cache_key}"
    if redis_client:
        try:
            cached = await redis_client.get(redis_key)
            if cached:
                return json.loads(cached)
        except Exception as cache_error:
            logger.warning("Hot cache read fallback for %s: %s", cache_key, cache_error)

    entry = _hot_endpoint_cache.get(cache_key)
    if not entry:
        return None
    if entry["expires_at"] <= datetime.now(timezone.utc):
        _hot_endpoint_cache.pop(cache_key, None)
        return None
    return entry.get("payload")


async def set_hot_cached_payload(
    cache_key: str,
    payload: Dict[str, Any],
    ttl_seconds: int = HOT_ENDPOINT_CACHE_TTL_SECONDS,
) -> None:
    redis_key = f"hot:{cache_key}"
    if redis_client:
        try:
            await redis_client.setex(
                redis_key, ttl_seconds, json.dumps(payload, default=str)
            )
            return
        except Exception as cache_error:
            logger.warning(
                "Hot cache write fallback for %s: %s", cache_key, cache_error
            )

    if len(_hot_endpoint_cache) >= HOT_ENDPOINT_CACHE_MAX_ITEMS:
        # Remove expired entries first; if still full, evict oldest insertion key.
        now = datetime.now(timezone.utc)
        expired_keys = [
            k for k, v in _hot_endpoint_cache.items() if v.get("expires_at") <= now
        ]
        for key in expired_keys:
            _hot_endpoint_cache.pop(key, None)
        if len(_hot_endpoint_cache) >= HOT_ENDPOINT_CACHE_MAX_ITEMS:
            oldest_key = next(iter(_hot_endpoint_cache), None)
            if oldest_key:
                _hot_endpoint_cache.pop(oldest_key, None)

    _hot_endpoint_cache[cache_key] = {
        "payload": payload,
        "expires_at": datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds),
    }


async def enforce_upload_rate_limit(
    user_id: str, action: str, max_requests: int = 30, window_seconds: int = 60
) -> None:
    """Redis-backed rate limit guard with in-memory fallback."""
    if redis_client:
        try:
            key = f"rl:{action}:{user_id}"
            current_count = await redis_client.incr(key)
            if current_count == 1:
                await redis_client.expire(key, window_seconds)
            if current_count > max_requests:
                raise HTTPException(
                    status_code=429,
                    detail="Too many upload requests. Please retry shortly.",
                )
            return
        except HTTPException:
            raise
        except Exception as redis_error:
            logger.warning(
                "Redis upload rate-limit fallback for %s: %s", user_id, redis_error
            )

    # Fallback for local/dev if Redis is unavailable.
    now = datetime.now(timezone.utc)
    key = f"{action}:{user_id}"
    window = _upload_rate_limit_windows[key]
    cutoff = now - timedelta(seconds=window_seconds)

    while window and window[0] < cutoff:
        window.pop(0)

    if len(window) >= max_requests:
        raise HTTPException(
            status_code=429, detail="Too many upload requests. Please retry shortly."
        )

    window.append(now)


async def enforce_message_rate_limit(
    user_id: str, max_requests: int = 1, window_seconds: int = 1
) -> None:
    """Anti-spam guard for chat sends (Redis-backed with in-memory fallback)."""
    if redis_client:
        try:
            key = f"rl:message:{user_id}"
            current_count = await redis_client.incr(key)
            if current_count == 1:
                await redis_client.expire(key, window_seconds)
            if current_count > max_requests:
                raise HTTPException(
                    status_code=429, detail="Too many messages. Please slow down."
                )
            return
        except HTTPException:
            raise
        except Exception as redis_error:
            logger.warning(
                "Redis message rate-limit fallback for %s: %s", user_id, redis_error
            )

    now = datetime.now(timezone.utc)
    key = f"message:{user_id}"
    window = _upload_rate_limit_windows[key]
    cutoff = now - timedelta(seconds=window_seconds)

    while window and window[0] < cutoff:
        window.pop(0)

    if len(window) >= max_requests:
        raise HTTPException(
            status_code=429, detail="Too many messages. Please slow down."
        )

    window.append(now)


def ensure_folder_access(user: Dict[str, Any], folder: str) -> None:
    """Authorize uploads/deletes by user role and folder."""
    role = user.get("role")

    # Profile media is allowed for any authenticated user.
    if folder == "profile":
        return

    # Listings/reels media requires owner-capable roles.
    if folder in {"listings", "reels"} and role in OWNER_UPLOAD_ROLES:
        return

    raise HTTPException(status_code=403, detail="Not authorized for this media folder")


def build_delete_job_id(
    user_id: str,
    public_id: str,
    resource_type: str,
    idempotency_key: Optional[str] = None,
) -> str:
    seed = idempotency_key or f"{user_id}:{public_id}:{resource_type}"
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    return f"del_{digest[:32]}"


async def process_media_delete_job(job_doc: Dict[str, Any]) -> Dict[str, Any]:
    """Try one Cloudinary delete attempt and update retry state."""
    attempts = int(job_doc.get("attempts", 0)) + 1
    job_id = job_doc["id"]
    public_id = job_doc["public_id"]
    resource_type = job_doc["resource_type"]
    now = datetime.now(timezone.utc)

    try:
        delete_call = partial(
            cloudinary.uploader.destroy,
            public_id,
            resource_type=resource_type,
            invalidate=True,
        )
        delete_result = await asyncio.get_event_loop().run_in_executor(
            None, delete_call
        )
        result_status = delete_result.get("result", "unknown")
        success = result_status in {"ok", "not found"}

        if success:
            await db.media_delete_jobs.update_one(
                {"id": job_id},
                {
                    "$set": {
                        "status": "completed",
                        "result": result_status,
                        "attempts": attempts,
                        "updated_at": now,
                        "completed_at": now,
                        "last_error": None,
                    }
                },
            )
            return {"success": True, "result": result_status}

        if attempts >= DELETE_JOB_MAX_ATTEMPTS:
            await db.media_delete_jobs.update_one(
                {"id": job_id},
                {
                    "$set": {
                        "status": "failed",
                        "attempts": attempts,
                        "updated_at": now,
                        "last_error": f"Cloudinary result: {result_status}",
                    }
                },
            )
            return {"success": False, "result": result_status}

        retry_delay = DELETE_RETRY_DELAYS_SECONDS[
            min(attempts - 1, len(DELETE_RETRY_DELAYS_SECONDS) - 1)
        ]
        await db.media_delete_jobs.update_one(
            {"id": job_id},
            {
                "$set": {
                    "status": "retry",
                    "attempts": attempts,
                    "updated_at": now,
                    "last_error": f"Cloudinary result: {result_status}",
                    "next_retry_at": now + timedelta(seconds=retry_delay),
                }
            },
        )
        return {"success": False, "result": result_status}

    except Exception as e:
        logger.error(f"Cloudinary delete exception for {public_id}: {e}")
        if attempts >= DELETE_JOB_MAX_ATTEMPTS:
            await db.media_delete_jobs.update_one(
                {"id": job_id},
                {
                    "$set": {
                        "status": "failed",
                        "attempts": attempts,
                        "updated_at": now,
                        "last_error": str(e),
                    }
                },
            )
            return {"success": False, "result": "failed"}

        retry_delay = DELETE_RETRY_DELAYS_SECONDS[
            min(attempts - 1, len(DELETE_RETRY_DELAYS_SECONDS) - 1)
        ]
        await db.media_delete_jobs.update_one(
            {"id": job_id},
            {
                "$set": {
                    "status": "retry",
                    "attempts": attempts,
                    "updated_at": now,
                    "last_error": str(e),
                    "next_retry_at": now + timedelta(seconds=retry_delay),
                }
            },
        )
        return {"success": False, "result": "retry"}


async def media_delete_retry_worker():
    """Background worker that retries failed/pending Cloudinary deletes."""
    logger.info("Media delete retry worker started")
    try:
        while True:
            now = datetime.now(timezone.utc)
            job = await db.media_delete_jobs.find_one_and_update(
                {
                    "status": {"$in": ["pending", "retry"]},
                    "next_retry_at": {"$lte": now},
                },
                {
                    "$set": {
                        "status": "processing",
                        "updated_at": now,
                    }
                },
                sort=[("next_retry_at", 1)],
                return_document=ReturnDocument.AFTER,
            )

            if not job:
                await asyncio.sleep(5)
                continue

            await process_media_delete_job(job)
    except asyncio.CancelledError:
        logger.info("Media delete retry worker stopped")
    except Exception as e:
        logger.error(f"Media delete retry worker crashed: {e}")


class MessageCreate(BaseModel):
    receiver_id: Optional[str] = None
    content: Optional[str] = None
    message: Optional[str] = None
    listing_id: Optional[str] = None
    media_url: Optional[str] = None


class LockListingRequest(BaseModel):
    listing_id: str


class RevealContactRequest(BaseModel):
    listing_id: str


class VisitSchedule(BaseModel):
    listing_id: str
    visit_date: str
    visit_time: str
    visit_type: str = "in_person"  # in_person, video
    notes: str = ""


class BoostListing(BaseModel):
    listing_id: str
    boost_days: int = 7
    boost_type: str = "top_search"  # top_search, trending, featured


class ReelsDebugReportIn(BaseModel):
    stress_session_id: str = Field(..., min_length=1, max_length=128)
    stats: Dict[str, Any] = Field(default_factory=dict)
    hit_rate_history: List[int] = Field(default_factory=list)
    total_captures: Optional[int] = None
    captures: Optional[List[Dict[str, Any]]] = None


class AdminSendNotification(BaseModel):
    target: str
    title: str
    message: str
    type: str = "admin_message"


class AdminBlockUser(BaseModel):
    user_id: str
    block_type: str
    reason: str
    duration_hours: Optional[int] = None


class AdminVerifyOwner(BaseModel):
    user_id: str
    status: str
    rejection_reason: Optional[str] = None


# ============ HELPER FUNCTIONS ============
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def normalize_role(role: Optional[str]) -> str:
    """Normalize role strings to lowercase with underscores (e.g. 'Property Owner' -> 'property_owner')."""
    if not role:
        return ""
    return str(role).lower().strip().replace(" ", "_")


SUBSCRIPTION_ROLES = {
    UserRole.PROPERTY_OWNER.value,
    UserRole.STAY_OWNER.value,
    UserRole.SERVICE_PROVIDER.value,
    UserRole.EVENT_OWNER.value,
    UserRole.HOTEL_OWNER.value,
}
COMMISSION_ROLES = {
    UserRole.STAY_OWNER.value,
    UserRole.HOTEL_OWNER.value,
    UserRole.EVENT_OWNER.value,
}
VALID_COUPONS = {
    "GRUVORA5M": {"free_months": 5, "description": "First 5 months free"},
    "GRUVORA5": {"free_months": 5, "description": "Welcome Offer: 5 Months Free"},
}
SUBSCRIPTION_AMOUNT_PAISE = 99900  # Default ₹999/month (Property)
STAY_EVENT_BASIC_SUB_PAISE = 19900  # ₹199/month
STAY_EVENT_PRO_SUB_PAISE = 49900  # ₹499/month
SERVICE_BASIC_SUB_PAISE = 5000  # ₹50/month
SERVICE_VERIFIED_SUB_PAISE = 9900  # ₹99/month
SERVICE_TOP_SUB_PAISE = 14900  # ₹149/month
PROPERTY_LISTING_FEE_PAISE = 19900  # Default ₹199 per property
COMMISSION_RATE = 0.02  # 2% per successful booking
BASIC_PLAN_LISTING_LIMIT = 5
BILLING_GRACE_DAYS = 5
BLOCK_DURATION_DAYS = 7


def _add_months(source_date: datetime, months: int) -> datetime:
    month_index = source_date.month - 1 + months
    year = source_date.year + month_index // 12
    month = month_index % 12 + 1
    day = min(source_date.day, calendar.monthrange(year, month)[1])
    return source_date.replace(year=year, month=month, day=day)


def compute_next_billing_date(from_date: datetime) -> datetime:
    return _add_months(from_date, 1)


def build_subscription_init_doc(
    role: str, coupon: Optional[str] = None
) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    norm_role = normalize_role(role)

    validated_coupon = None
    free_months = 0

    # Universal 5-month free trial for ALL owner categories (Property, Stay, Hotel, Event, Service)
    if norm_role in SUBSCRIPTION_ROLES:
        validated_coupon = "GRUVORA5"
        free_months = 5
    elif coupon:
        coupon_upper = coupon.strip().upper()
        if coupon_upper in VALID_COUPONS:
            validated_coupon = coupon_upper
            free_months = VALID_COUPONS[coupon_upper]["free_months"]

    if free_months > 0:
        trial_end = _add_months(now, free_months)
        next_billing = trial_end.replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )

        doc = {
            "subscription_model": "subscription",
            "subscription_status": "trial",
            "trial_months_remaining": free_months,
            "trial_end_date": trial_end.isoformat(),
            "subscription_start_date": None,
            "next_billing_date": next_billing.isoformat(),
            "last_payment_date": None,
            "auto_renew": True,
            "coupon_used": validated_coupon,
            "block_status": None,
            "block_until": None,
            "subscription_amount_paise": SUBSCRIPTION_AMOUNT_PAISE,
        }

        # Add commission fields for hybrid roles
        if norm_role in COMMISSION_ROLES:
            doc.update(
                {
                    "subscription_model": "hybrid",
                    "commission_rate": COMMISSION_RATE,
                    "total_commission_owed": 0.0,
                    "total_commission_paid": 0.0,
                }
            )

        return doc

    if norm_role in COMMISSION_ROLES:
        return {
            "subscription_model": "commission",
            "subscription_status": None,
            "commission_rate": COMMISSION_RATE,
            "total_commission_owed": 0.0,
            "total_commission_paid": 0.0,
            "block_status": None,
            "block_until": None,
        }

    return {
        "subscription_model": "subscription",
        "subscription_status": "pending",
        "trial_months_remaining": 0,
        "trial_end_date": None,
        "subscription_start_date": None,
        "next_billing_date": now.replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        ).isoformat(),
        "last_payment_date": None,
        "auto_renew": True,
        "coupon_used": None,
        "block_status": None,
        "block_until": None,
        "subscription_amount_paise": SUBSCRIPTION_AMOUNT_PAISE,
    }


def generate_invoice_number(billing_month: str, sequence: int) -> str:
    return f"INV-{billing_month}-{sequence:04d}"


def compute_commission(deal_amount: float) -> float:
    return round(deal_amount * COMMISSION_RATE, 2)


def _parse_iso_datetime(value: Any) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


async def check_and_resolve_block(user: Dict[str, Any], database) -> Dict[str, Any]:
    role = normalize_role(user.get("role"))
    if role not in SUBSCRIPTION_ROLES:
        return user

    now = datetime.now(timezone.utc)
    status = str(user.get("subscription_status") or "")

    if status == "trial":
        trial_end = _parse_iso_datetime(user.get("trial_end_date"))
        if trial_end and trial_end <= now:
            await database.users.update_one(
                {"id": user["id"]},
                {
                    "$set": {
                        "subscription_status": "expired",
                        "trial_months_remaining": 0,
                    }
                },
            )
            user["subscription_status"] = "expired"
            user["trial_months_remaining"] = 0

    block_until = _parse_iso_datetime(user.get("block_until"))
    if user.get("block_status") == "subscription_overdue" and block_until:
        if block_until <= now:
            await database.users.update_one(
                {"id": user["id"]},
                {
                    "$set": {"subscription_status": "expired"},
                    "$unset": {"block_status": "", "block_until": ""},
                },
            )
            user["subscription_status"] = "expired"
            user.pop("block_status", None)
            user.pop("block_until", None)
        else:
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "SUBSCRIPTION_BLOCKED",
                    "message": "Your account is temporarily suspended for unpaid subscription.",
                    "action_required": "pay_subscription",
                    "block_until": block_until.isoformat(),
                },
            )

    return user


def enforce_subscription(user: Dict[str, Any]) -> None:
    role = normalize_role(user.get("role"))
    if role == UserRole.ADMIN.value:
        return

    # Property owners can create listings even without a subscription, but they must pay per listing.
    # So we don't block them here; create_listing will set status to 'awaiting_payment' if needed.
    if role == UserRole.PROPERTY_OWNER.value:
        return

    if role in COMMISSION_ROLES:
        return
    if role not in SUBSCRIPTION_ROLES:
        return

    status = str(user.get("subscription_status") or "")
    now = datetime.now(timezone.utc)

    # Allow trial, active, and pending statuses - only block expired/blocked
    if status in {"trial", "active", "pending", ""}:
        return

    if status == "trial":
        trial_end = _parse_iso_datetime(user.get("trial_end_date"))
        if trial_end and trial_end <= now:
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "TRIAL_EXPIRED",
                    "message": "Your free trial has ended. Please subscribe to continue.",
                    "action_required": "subscribe",
                },
            )
        return

    if status == "active":
        return

    if status in {"blocked", "expired"}:
        detail = {
            "code": "SUBSCRIPTION_BLOCKED",
            "message": "Your account is suspended due to an unpaid subscription.",
            "action_required": "pay_subscription",
        }
        if user.get("block_until"):
            detail["block_until"] = user.get("block_until")
        raise HTTPException(status_code=403, detail=detail)

    # Default: allow (be permissive)
    return


def create_token(user_id: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "user_id": user_id,
        "role": role,
        "iat": now,
        "jti": str(uuid.uuid4()),
        "exp": now + timedelta(hours=JWT_EXPIRATION_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def normalize_auth_token(token_value: Optional[str]) -> str:
    """Accept raw JWT or 'Bearer <JWT>' and return only the JWT segment."""
    if not token_value:
        return ""
    token = token_value.strip()
    if token.lower().startswith("bearer "):
        token = token.split(" ", 1)[1].strip()
    return token


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    token_data = decode_token(credentials.credentials)
    user = await db.users.find_one({"id": token_data["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # PROFESSIONAL FIX: Normalize role at the source AND persist to DB
    # This ensures "Property Owner" from DB becomes "property_owner" permanently
    raw_role = user.get("role")
    normalized_role = normalize_role(raw_role)
    user["role"] = normalized_role

    # Persist the normalized role back to MongoDB if it was different
    # This fixes the root cause: old users with "Property Owner" format get permanently updated
    if raw_role != normalized_role:
        await db.users.update_one(
            {"id": user["id"]}, {"$set": {"role": normalized_role}}
        )

    if user.get("deleted"):
        raise HTTPException(status_code=403, detail="Account no longer exists.")

    block_status = user.get("block_status")
    if block_status == "permanent":
        raise HTTPException(
            status_code=403, detail="Account permanently blocked. Contact support."
        )

    if block_status == "temporary":
        unblock_at = user.get("unblock_at")
        if unblock_at:
            unblock_at_dt = None
            if isinstance(unblock_at, datetime):
                unblock_at_dt = unblock_at
            elif isinstance(unblock_at, str):
                try:
                    unblock_at_dt = datetime.fromisoformat(
                        unblock_at.replace("Z", "+00:00")
                    )
                except ValueError:
                    unblock_at_dt = None

            if unblock_at_dt and unblock_at_dt <= datetime.now(timezone.utc):
                await db.users.update_one(
                    {"id": user["id"]},
                    {
                        "$unset": {
                            "block_status": "",
                            "block_reason": "",
                            "blocked_at": "",
                            "blocked_by": "",
                            "unblock_at": "",
                            "block_duration_hours": "",
                        }
                    },
                )
                user.pop("block_status", None)
                user.pop("block_reason", None)
                user.pop("blocked_at", None)
                user.pop("blocked_by", None)
                user.pop("unblock_at", None)
                user.pop("block_duration_hours", None)
            else:
                raise HTTPException(
                    status_code=403,
                    detail=f"Account temporarily blocked until {unblock_at}.",
                )

    return user


async def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security),
):
    if not credentials:
        return None
    token_data = decode_token(credentials.credentials)
    user = await db.users.find_one({"id": token_data["user_id"]}, {"_id": 0})
    return user


async def get_admin_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    user = await get_current_user(credentials)
    if user.get("role") != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def get_owner_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    user = await get_current_user(credentials)
    user = await check_and_resolve_block(user, db)
    owner_roles = [
        UserRole.PROPERTY_OWNER,
        UserRole.STAY_OWNER,
        UserRole.SERVICE_PROVIDER,
        UserRole.HOTEL_OWNER,
        UserRole.EVENT_OWNER,
        UserRole.ADMIN,
    ]
    if user.get("role") not in owner_roles:
        raise HTTPException(status_code=403, detail="Owner access required")
    return user


# ============ WEBSOCKET CONNECTION MANAGER ============
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_rooms: Dict[str, Set[str]] = defaultdict(set)

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_json(message)

    async def broadcast(self, message: dict, user_ids: List[str]):
        for user_id in user_ids:
            await self.send_personal_message(message, user_id)


manager = ConnectionManager()


# ============ AUTH ROUTES ============
@api_router.post("/auth/register")
async def register_user(user: UserRegister):
    # ✅ Password validation
    if len(user.password) < 8:
        raise HTTPException(
            status_code=400, detail="Password must be at least 8 characters"
        )
    if not any(c.isupper() for c in user.password):
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least one uppercase letter",
        )
    if not any(c.isdigit() for c in user.password):
        raise HTTPException(
            status_code=400, detail="Password must contain at least one number"
        )

    existing = await db.users.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = str(uuid.uuid4())
    verification_token = str(uuid.uuid4())

    user_doc = {
        "id": user_id,
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "password": hash_password(user.password),
        "gender": user.gender,
        "address": user.address,
        "city": user.city,
        "state": user.state,
        "role": UserRole.USER,
        "is_verified": False,
        "is_email_verified": False,
        "is_phone_verified": False,
        "verification_token": verification_token,
        "wishlist": [],
        "saved_reels": [],
        "search_history": [],
        "preferences": {},
        "notifications_enabled": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.users.insert_one(user_doc)
    token = create_token(user_id, UserRole.USER)

    return {
        "message": "Registration successful. Please verify your email.",
        "token": token,
        "user": {
            "id": user_id,
            "name": user.name,
            "email": user.email,
            "role": UserRole.USER,
            "is_verified": False,
        },
        "verification_token": verification_token,
    }


@api_router.post("/auth/register/owner")
async def register_owner(owner: OwnerRegister):
    existing = await db.users.find_one({"email": owner.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = str(uuid.uuid4())
    verification_token = str(uuid.uuid4())
    subscription_fields = build_subscription_init_doc(
        role=owner.role.value, coupon=owner.coupon
    )

    user_doc = {
        "id": user_id,
        "name": owner.name,
        "email": owner.email,
        "phone": owner.phone,
        "password": hash_password(owner.password),
        "gender": owner.gender,
        "address": owner.address,
        "city": owner.city,
        "state": owner.state,
        "role": owner.role,
        "business_name": owner.business_name,
        "is_verified": False,
        "is_email_verified": False,
        "is_phone_verified": False,
        "verification_token": verification_token,
        "aadhar_number": owner.aadhar_number,
        "aadhar_name": owner.aadhar_name,
        "aadhar_status": VerificationStatus.PENDING,
        "subscription": subscription_fields.get("subscription_status"),
        "subscription_expires": subscription_fields.get("trial_end_date")
        or subscription_fields.get("next_billing_date"),
        **subscription_fields,
        "listings": [],
        "total_views": 0,
        "total_bookings": 0,
        "total_revenue": 0,
        "rating": 0,
        "review_count": 0,
        "auto_reply_enabled": False,
        "auto_reply_message": "Thank you for your interest! I will get back to you soon.",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.users.insert_one(user_doc)
    token = create_token(user_id, owner.role)

    success_msg = "Owner registration successful. Pending Aadhaar verification."
    if owner.role == UserRole.PROPERTY_OWNER.value:
        success_msg = "Welcome! You have received 5 months of free subscription. Payment will start after the trial period."

    return {
        "message": success_msg,
        "token": token,
        "user": {
            "id": user_id,
            "name": owner.name,
            "email": owner.email,
            "role": owner.role,
            "is_verified": False,
            "aadhar_status": VerificationStatus.PENDING,
            "subscription_status": subscription_fields.get("subscription_status"),
            "subscription_model": subscription_fields.get("subscription_model"),
            "coupon_used": subscription_fields.get("coupon_used"),
        },
        "verification_token": verification_token,
    }


@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user_id = user.get("id") or str(user.get("_id", ""))
    token = create_token(user_id, user["role"])

    # Update last login
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}},
    )

    return {
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "is_verified": user.get("is_verified", False),
            "subscription_status": user.get("subscription_status"),
            "subscription_plan": user.get("subscription_plan"),
            "subscription_expires": user.get("subscription_expires"),
            "next_billing_date": user.get("next_billing_date"),
            "last_payment_date": user.get("last_payment_date"),
            "trial_end_date": user.get("trial_end_date"),
            "block_status": user.get("block_status"),
        },
    }


@api_router.post("/auth/refresh")
async def refresh_token(body: RefreshToken):
    """Refresh expired JWT token."""
    try:
        payload = jwt.decode(
            body.token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
            options={"verify_exp": False},
        )

        exp = payload.get("exp", 0)
        now = datetime.now(timezone.utc).timestamp()
        if now - exp > 7 * 24 * 3600:
            raise HTTPException(status_code=401, detail="Token too old to refresh")

        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid refresh token payload")

        user = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "role": 1})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        # Always trust the persisted role, not the incoming token claim.
        new_token = create_token(user_id, user.get("role", UserRole.USER))
        return {"token": new_token, "message": "Token refreshed"}

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Cannot refresh token")


@api_router.get("/auth/verify/{token}")
async def verify_email(token: str):
    user = await db.users.find_one({"verification_token": token})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid verification token")

    await db.users.update_one(
        {"verification_token": token},
        {
            "$set": {"is_email_verified": True, "is_verified": True},
            "$unset": {"verification_token": ""},
        },
    )

    return {"message": "Email verified successfully"}


@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    safe_user = {
        k: v for k, v in user.items() if k not in ["password", "verification_token"]
    }
    # Always include subscription fields so frontend never needs a separate status call
    # to determine if the user has an active subscription after login/refresh
    for field in ["subscription_status", "subscription_plan", "subscription_expires",
                  "next_billing_date", "last_payment_date", "trial_end_date", "block_status"]:
        if field not in safe_user:
            safe_user[field] = user.get(field)
    return safe_user


@api_router.put("/auth/profile")
async def update_profile(
    updates: Dict[str, Any], user: dict = Depends(get_current_user)
):
    allowed_fields = [
        "name",
        "email",
        "phone",
        "address",
        "city",
        "state",
        "profile_image",
        "preferences",
        "notifications_enabled",
        "auto_reply_enabled",
        "auto_reply_message",
    ]
    update_data = {k: v for k, v in updates.items() if k in allowed_fields}

    next_email = (update_data.get("email") or "").strip().lower()
    if next_email and next_email != str(user.get("email", "")).strip().lower():
        existing = await db.users.find_one(
            {"email": next_email, "id": {"$ne": user["id"]}}, {"_id": 1}
        )
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        update_data["email"] = next_email

    if update_data:
        await db.users.update_one({"id": user["id"]}, {"$set": update_data})

    return {"message": "Profile updated successfully"}


@api_router.put("/auth/change-password")
async def change_password(
    payload: Dict[str, Any], user: dict = Depends(get_current_user)
):
    old_password = str(payload.get("old_password") or "")
    new_password = str(payload.get("new_password") or "")

    if not old_password or not new_password:
        raise HTTPException(
            status_code=400, detail="old_password and new_password are required"
        )

    if len(new_password) < 8:
        raise HTTPException(
            status_code=400, detail="Password must be at least 8 characters"
        )
    if not any(c.isupper() for c in new_password):
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least one uppercase letter",
        )
    if not any(c.isdigit() for c in new_password):
        raise HTTPException(
            status_code=400, detail="Password must contain at least one number"
        )

    if not verify_password(old_password, user.get("password", "")):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if verify_password(new_password, user.get("password", "")):
        raise HTTPException(
            status_code=400,
            detail="New password must be different from current password",
        )

    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {
                "password": hash_password(new_password),
                "password_updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )

    return {"message": "Password updated successfully"}


# ============ LISTINGS ROUTES ============
@api_router.post("/listings")
async def create_listing(
    payload: Dict[str, Any] = Body(...), user: dict = Depends(get_owner_user)
):
    enforce_subscription(user)

    if not user.get("id"):
        raise HTTPException(status_code=401, detail="Invalid authenticated user")

    role = str(user.get("role") or "").strip()
    category = str(payload.get("category") or "").strip()
    if not category:
        raise HTTPException(status_code=422, detail="category is required")

    # Backward compatibility: old clients send flat fields instead of nested pricing/media blocks.
    if "price" in payload and "pricing" not in payload:
        raw_price = payload.get("price", 0)
        try:
            raw_price = float(raw_price) if raw_price not in ("", None) else 0.0
        except (ValueError, TypeError):
            raw_price = 0.0
        payload["pricing"] = {
            "type": payload.get("listing_type") or "fixed",
            "amount": raw_price,
            "negotiable": payload.get("negotiable", False),
            "security_deposit": payload.get("security_deposit"),
        }

    if "images" in payload and "media" not in payload:
        payload["media"] = {
            "images": payload.get("images", []),
            "videos": payload.get("videos", []),
            "virtual_tour_url": payload.get("virtual_tour_url"),
            "floor_plan_url": payload.get("floor_plan_url"),
        }

    pricing_block = payload.get("pricing", {})
    if isinstance(pricing_block, dict):
        try:
            pricing_block["amount"] = float(pricing_block.get("amount") or 0)
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=422, detail="pricing.amount must be a valid number"
            )
        payload["pricing"] = pricing_block

    try:
        base = ListingBaseCreate(**payload)
    except Exception as exc:
        errors = []
        if hasattr(exc, "errors"):
            errors = [
                {"field": ".".join(str(loc) for loc in item["loc"]), "msg": item["msg"]}
                for item in exc.errors()
            ]
        raise HTTPException(status_code=422, detail=errors or str(exc))

    raw_specific = payload.get("category_specific_fields") or {}
    if not isinstance(raw_specific, dict):
        raw_specific = {}

    if not raw_specific and "sub_category" in payload:
        raw_specific = {
            "listing_type": payload.get("listing_type", "rent"),
            "area_sqft": float(payload.get("area_sqft", 0) or 0),
        }

        if role in ("property_owner",):
            raw_specific.update(
                {
                    "property_type": payload.get("sub_category") or "flat",
                    "furnishing": payload.get("furnishing") or "unfurnished",
                }
            )
        elif role in ("stay_owner", "hotel_owner"):
            raw_specific.update(
                {
                    "stay_type": payload.get("sub_category") or "hotel",
                    "total_rooms": int(payload.get("total_rooms", 1) or 1),
                    "available_rooms": int(payload.get("available_rooms", 1) or 1),
                    "room_configs": payload.get("room_configs") or [],
                    "check_in_time": "14:00",
                    "check_out_time": "11:00",
                    "cancellation_policy": "moderate",
                }
            )
        elif role == "service_provider":
            raw_specific.update(
                {
                    "service_type": payload.get("sub_category") or "plumber",
                    "pricing_type": "fixed",
                    "experience_years": 0,
                    "skills": [],
                    "service_radius_km": 10.0,
                    "availability_slots": [
                        {"day": "mon", "start": "09:00", "end": "18:00"}
                    ],
                }
            )
        elif role == "event_owner":
            raw_specific.update(
                {
                    "venue_type": payload.get("sub_category") or "party_plot",
                    "indoor_capacity": int(payload.get("indoor_capacity", 100) or 100),
                    "price_per_day": float(base.pricing.amount),
                }
            )

    try:
        specific = validate_specific_fields(role, category, raw_specific)
        specific_fields = specific.model_dump()
    except HTTPException:
        specific_fields = raw_specific

    # Check listing limit for non-property owners on basic plan
    if role in (
        UserRole.STAY_OWNER.value,
        UserRole.EVENT_OWNER.value,
        UserRole.SERVICE_PROVIDER.value,
        UserRole.HOTEL_OWNER.value,
    ):
        sub_plan = user.get("subscription_plan", SubscriptionPlan.BASIC.value)
        if sub_plan == SubscriptionPlan.BASIC.value:
            existing_count = await db.listings.count_documents(
                {"owner_id": user["id"], "category": category}
            )
            if existing_count >= BASIC_PLAN_LISTING_LIMIT:
                raise HTTPException(
                    status_code=403,
                    detail=f"Basic plan limit reached ({BASIC_PLAN_LISTING_LIMIT} listings). Upgrade to Pro for unlimited listings.",
                )

    listing_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    base_data = base.model_dump(exclude={"pricing", "media"})
    pricing_data = base.pricing.model_dump()
    media_data = base.media.model_dump()

    listing_type = str(
        specific_fields.get("listing_type")
        or payload.get("listing_type")
        or pricing_data.get("type")
        or "fixed"
    )
    sub_category = (
        specific_fields.get("property_type")
        or specific_fields.get("stay_type")
        or specific_fields.get("service_type")
        or specific_fields.get("venue_type")
        or payload.get("sub_category")
        or category
    )
    amenities = specific_fields.get("amenities") or payload.get("amenities") or []

    # Set subscription plan and featured status for listing
    sub_plan = user.get("subscription_plan", SubscriptionPlan.BASIC.value)
    is_pro = sub_plan == SubscriptionPlan.PRO.value

    listing_doc = {
        "id": listing_id,
        "owner_id": user["id"],
        "owner_name": user["name"],
        "owner_phone": user.get("phone", ""),
        "owner_role": role,
        "owner_verified": str(user.get("aadhar_status") or "").strip()
        == VerificationStatus.VERIFIED.value,
        "category": category,
        **base_data,
        "pricing": pricing_data,
        "media": media_data,
        "category_specific_fields": specific_fields,
        "price": pricing_data.get("amount"),
        "listing_type": listing_type,
        "sub_category": sub_category,
        "amenities": amenities if isinstance(amenities, list) else [],
        "images": media_data.get("images", []),
        "videos": media_data.get("videos", []),
        "virtual_tour_url": media_data.get("virtual_tour_url"),
        "floor_plan_url": media_data.get("floor_plan_url"),
        "specifications": payload.get("specifications", {}),
        "nearby_facilities": payload.get("nearby_facilities", {}),
        "title_en": base.title,
        "title_gu": base.title,
        "title_hi": base.title,
        "status": ListingStatus.PENDING,
        "is_available": True,
        "is_draft": base.is_draft,
        "views": 0,
        "likes": 0,
        "saves": 0,
        "inquiries": 0,
        "shares": 0,
        "is_locked": False,
        "locked_by": None,
        "locked_at": None,
        "contact_unlocked_user_ids": [],
        "price_history": [{"price": pricing_data.get("amount"), "date": now}],
        "boost_expires": None,
        "fresh_priority_until": build_fresh_priority_until(datetime.now(timezone.utc)),
        "featured": is_pro,
        "subscription_plan": sub_plan,
        "created_at": now,
        "updated_at": now,
    }

    # Monetization for Property (Home/Business)
    final_status = ListingStatus.PENDING
    payment_info = {}

    if role == UserRole.PROPERTY_OWNER.value:
        # Check for active subscription or trial
        sub_status = str(user.get("subscription_status") or "").lower()
        if sub_status in ("active", "trial"):
            # Owners with active sub/trial get free listings
            final_status = ListingStatus.APPROVED
            logger.info(
                f"Free listing approved for owner {user.get('email')} during {sub_status}"
            )
        else:
            # Fetch dynamic listing fee from settings
            settings = await db.settings.find_one({"id": "platform_config"})
            listing_fee = PROPERTY_LISTING_FEE_PAISE
            if (
                settings
                and "categories" in settings
                and category in settings["categories"]
            ):
                listing_fee = int(
                    settings["categories"][category].get("listing_fee", 0) * 100
                )
            elif settings and "global_config" in settings:
                listing_fee = int(settings["global_config"].get("listing_fee", 0) * 100)

            if listing_fee > 0:
                # No active subscription, mark as awaiting listing fee payment
                final_status = ListingStatus.AWAITING_PAYMENT
                payment_info = {
                    "payment_required": "listing_fee",
                    "fee_amount_paise": listing_fee,
                }

    listing_doc["status"] = final_status
    listing_doc.update(payment_info)

    await db.listings.insert_one(listing_doc)
    await db.users.update_one({"id": user["id"]}, {"$push": {"listings": listing_id}})

    return {
        "message": "Listing created",
        "listing_id": listing_id,
        "status": final_status,
        **payment_info,
    }


@api_router.get("/listings")
async def get_listings(
    category: Optional[str] = None,
    owner_id: Optional[str] = None,
    listing_type: Optional[str] = None,
    sub_category: Optional[str] = None,
    city: Optional[str] = None,
    min_price: Optional[str] = None,
    max_price: Optional[str] = None,
    search: Optional[str] = None,
    q: Optional[str] = None,
    amenities: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius: Optional[float] = 10,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    page: Optional[str] = "1",
    limit: Optional[str] = "20",
    response: Response = None,
):
    valid_categories = {item.value for item in ListingCategory}
    valid_listing_types = {item.value for item in ListingType}

    normalized_category = (category or "").strip().lower()
    if normalized_category in {"", "all", "any", "*"}:
        normalized_category = ""
    if normalized_category == "hotel":
        normalized_category = "stay"

    normalized_listing_type = (listing_type or "").strip().lower()
    if normalized_listing_type in {"", "all", "any", "*"}:
        normalized_listing_type = ""

    parsed_min_price: Optional[float] = None
    if min_price not in (None, ""):
        try:
            parsed_min_price = float(min_price)
        except (TypeError, ValueError):
            parsed_min_price = None

    parsed_max_price: Optional[float] = None
    if max_price not in (None, ""):
        try:
            parsed_max_price = float(max_price)
        except (TypeError, ValueError):
            parsed_max_price = None

    try:
        parsed_page = int(page or "1")
    except (TypeError, ValueError):
        parsed_page = 1
    parsed_page = max(1, parsed_page)

    try:
        parsed_limit = int(limit or "20")
    except (TypeError, ValueError):
        parsed_limit = 20
    parsed_limit = min(100, max(1, parsed_limit))

    cache_key = _build_hot_cache_key(
        "listings",
        {
            "category": normalized_category,
            "owner_id": owner_id or "",
            "listing_type": normalized_listing_type,
            "sub_category": sub_category or "",
            "city": city or "",
            "min_price": parsed_min_price,
            "max_price": parsed_max_price,
            "search": (search or q or "").strip().lower(),
            "amenities": amenities or "",
            "lat": lat,
            "lng": lng,
            "radius": radius,
            "sort_by": sort_by,
            "sort_order": sort_order,
            "page": parsed_page,
            "limit": parsed_limit,
        },
    )
    cached_payload = await get_hot_cached_payload(cache_key)
    if cached_payload is not None:
        if response is not None:
            response.headers["X-Cache"] = "HIT"
            response.headers["Cache-Control"] = (
                f"public, max-age={HOT_ENDPOINT_CACHE_TTL_SECONDS}"
            )
        return cached_payload

    query = {
        "status": {"$in": [ListingStatus.APPROVED, ListingStatus.BOOSTED]},
        "is_available": True,
    }

    if normalized_category in valid_categories:
        query["category"] = normalized_category
    if owner_id:
        query["owner_id"] = owner_id
    if normalized_listing_type in valid_listing_types:
        query["listing_type"] = normalized_listing_type
    if sub_category:
        query["sub_category"] = sub_category
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if parsed_min_price is not None:
        query["price"] = {"$gte": parsed_min_price}
    if parsed_max_price is not None:
        query["price"] = {**query.get("price", {}), "$lte": parsed_max_price}
    effective_search = search or q
    if effective_search:
        from search_engine import _extract_proper_nouns

        proper = _extract_proper_nouns(effective_search)
        normalized = normalize_search_query(effective_search)
        terms = normalized.get("expanded_terms", [])[:20]
        or_clauses = []
        if proper:
            pn = re.escape(proper)
            for field in ["title", "title_en", "description", "location"]:
                or_clauses.append({field: {"$regex": pn, "$options": "i"}})
        if terms:
            rp = "|".join(re.escape(t) for t in terms)
            for field in [
                "title",
                "title_en",
                "description",
                "location",
                "city",
                "sub_category",
            ]:
                or_clauses.append({field: {"$regex": rp, "$options": "i"}})
        if or_clauses:
            query["$or"] = or_clauses
    if amenities:
        amenity_list = amenities.split(",")
        query["amenities"] = {"$all": amenity_list}

    skip = (parsed_page - 1) * parsed_limit
    now_iso = datetime.now(timezone.utc).isoformat()

    base_query = dict(query)
    search_or_clauses = base_query.pop("$or", None)
    priority_conditions = [
        {"status": ListingStatus.BOOSTED.value, "boost_expires": {"$gt": now_iso}},
        {"fresh_priority_until": {"$gt": now_iso}},
        {"featured": True},
        {"subscription_plan": SubscriptionPlan.PRO.value},
    ]

    priority_query: Dict[str, Any] = dict(base_query)
    if search_or_clauses:
        priority_query["$and"] = [
            {"$or": search_or_clauses},
            {"$or": priority_conditions},
        ]
    else:
        priority_query["$or"] = priority_conditions

    boosted_or_fresh = (
        await db.listings.find(priority_query, {"_id": 0})
        .sort([("fresh_priority_until", -1), ("boost_expires", -1), ("created_at", -1)])
        .limit(parsed_limit)
        .to_list(parsed_limit)
    )
    priority_ids = [item.get("id") for item in boosted_or_fresh if item.get("id")]

    regular_query = dict(base_query)
    if search_or_clauses:
        regular_query["$or"] = search_or_clauses
    if priority_ids:
        regular_query["id"] = {"$nin": priority_ids}

    regular_limit = max(1, parsed_limit - len(boosted_or_fresh))
    regular = (
        await db.listings.find(regular_query, {"_id": 0})
        .sort("created_at", -1)
        .skip(skip)
        .limit(regular_limit)
        .to_list(parsed_limit)
    )

    listings = boosted_or_fresh + regular
    total = await db.listings.count_documents(query)

    payload = {
        "listings": listings,
        "total": total,
        "page": parsed_page,
        "pages": (total + parsed_limit - 1) // parsed_limit,
    }
    await set_hot_cached_payload(cache_key, payload)
    if response is not None:
        response.headers["X-Cache"] = "MISS"
        response.headers["Cache-Control"] = (
            f"public, max-age={HOT_ENDPOINT_CACHE_TTL_SECONDS}"
        )
    return payload


@api_router.get("/listings/trending")
async def get_trending_listings(
    limit: int = 10, category: Optional[ListingCategory] = None
):
    query = {
        "status": {"$in": [ListingStatus.APPROVED, ListingStatus.BOOSTED]},
        "is_available": True,
    }
    if category:
        query["category"] = category

    candidates = (
        await db.listings.find(query, {"_id": 0})
        .limit(max(limit * 5, 50))
        .to_list(max(limit * 5, 50))
    )
    candidates.sort(
        key=lambda listing: (
            listing_boost_score(listing),
            listing_freshness_score(listing),
            float(listing.get("views") or 0),
            float(listing.get("likes") or 0),
        ),
        reverse=True,
    )
    listings = candidates[:limit]
    return {"listings": listings}


@api_router.get("/listings/recommended")
async def get_recommended_listings(
    user: dict = Depends(get_current_user), limit: int = 10
):
    # AI-based recommendations based on user history
    preferences = user.get("preferences", {})
    search_history = user.get("search_history", [])
    wishlist_docs = await db.wishlists.find(
        {"user_id": user["id"]},
        {"_id": 0, "listing_id": 1},
    ).to_list(500)
    wishlist_ids = {
        doc.get("listing_id") for doc in wishlist_docs if doc.get("listing_id")
    }
    wishlist_ids.update(str(item) for item in (user.get("wishlist", []) or []) if item)

    query = {
        "status": {"$in": [ListingStatus.APPROVED, ListingStatus.BOOSTED]},
        "is_available": True,
    }

    # If user has preferences, use them
    if preferences.get("city"):
        query["city"] = preferences["city"]
    if preferences.get("category"):
        query["category"] = preferences["category"]
    if preferences.get("max_budget"):
        query["price"] = {"$lte": preferences["max_budget"]}

    listings = (
        await db.listings.find(query, {"_id": 0})
        .sort([("views", -1), ("likes", -1)])
        .limit(limit)
        .to_list(limit)
    )

    return {"listings": listings, "reason": "Based on your preferences"}


@api_router.get("/listings/nearby")
async def get_nearby_listings(
    lat: float, lng: float, radius: float = 5, limit: int = 20
):
    # Simple distance-based query (for production, use MongoDB geospatial queries)
    query = {
        "status": {"$in": [ListingStatus.APPROVED, ListingStatus.BOOSTED]},
        "is_available": True,
        "latitude": {"$exists": True},
        "longitude": {"$exists": True},
    }

    listings = (
        await db.listings.find(query, {"_id": 0}).limit(limit * 3).to_list(limit * 3)
    )

    # Filter by distance (simplified)
    nearby = []
    for listing in listings:
        if listing.get("latitude") and listing.get("longitude"):
            # Simple distance calculation
            dlat = abs(listing["latitude"] - lat)
            dlng = abs(listing["longitude"] - lng)
            if dlat < radius / 111 and dlng < radius / 111:  # Rough approximation
                nearby.append(listing)

    return {"listings": nearby[:limit]}


@api_router.get("/listings/map")
async def get_map_listings(
    min_lat: float,
    max_lat: float,
    min_lng: float,
    max_lng: float,
    category: Optional[ListingCategory] = None,
    limit: int = 100,
):
    query = {
        "status": {"$in": [ListingStatus.APPROVED, ListingStatus.BOOSTED]},
        "is_available": True,
        "latitude": {"$gte": min_lat, "$lte": max_lat},
        "longitude": {"$gte": min_lng, "$lte": max_lng},
    }
    if category:
        query["category"] = category

    listings = (
        await db.listings.find(
            query,
            {
                "_id": 0,
                "id": 1,
                "title": 1,
                "price": 1,
                "category": 1,
                "latitude": 1,
                "longitude": 1,
                "images": 1,
                "listing_type": 1,
            },
        )
        .limit(limit)
        .to_list(limit)
    )

    return {"listings": listings}


@api_router.get("/listings/heatmap")
async def get_property_heatmap(city: str = "Surat"):
    # Get property density by area
    pipeline = [
        {
            "$match": {
                "city": {"$regex": city, "$options": "i"},
                "status": {"$in": [ListingStatus.APPROVED, ListingStatus.BOOSTED]},
            }
        },
        {
            "$group": {
                "_id": "$location",
                "count": {"$sum": 1},
                "avg_price": {"$avg": "$price"},
            }
        },
        {"$sort": {"count": -1}},
        {"$limit": 50},
    ]

    results = await db.listings.aggregate(pipeline).to_list(50)

    return {
        "hotspots": [
            {"area": r["_id"], "listings": r["count"], "avg_price": r["avg_price"]}
            for r in results
        ],
        "city": city,
    }


@api_router.get("/listings/{listing_id}")
async def get_listing(listing_id: str):
    listing = await db.listings.find_one({"id": listing_id}, {"_id": 0})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    owner = await db.users.find_one(
        {"id": listing.get("owner_id")}, {"_id": 0, "profile_image": 1}
    )
    listing["owner_profile_image"] = (owner or {}).get("profile_image", "")

    await db.listings.update_one({"id": listing_id}, {"$inc": {"views": 1}})
    listing["views"] = listing.get("views", 0) + 1

    # Get similar listings
    similar = (
        await db.listings.find(
            {
                "id": {"$ne": listing_id},
                "category": listing["category"],
                "city": listing["city"],
                "status": {"$in": [ListingStatus.APPROVED, ListingStatus.BOOSTED]},
            },
            {"_id": 0},
        )
        .limit(4)
        .to_list(4)
    )

    # Get reviews
    reviews = (
        await db.reviews.find({"listing_id": listing_id}, {"_id": 0})
        .sort("created_at", -1)
        .limit(10)
        .to_list(10)
    )

    listing["similar_listings"] = similar
    listing["reviews"] = reviews

    return listing


@api_router.post("/lock-listing")
async def lock_listing(
    payload: LockListingRequest, user: dict = Depends(get_current_user)
):
    listing_id = str(payload.listing_id or "").strip()
    if not listing_id:
        raise HTTPException(status_code=400, detail="listing_id is required")

    listing = await db.listings.find_one(
        {"id": listing_id},
        {"_id": 0, "id": 1, "is_locked": 1, "locked_by": 1, "owner_id": 1},
    )
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    if listing.get("owner_id") == user.get("id"):
        raise HTTPException(status_code=400, detail="Owner cannot lock own listing")

    current_lock_owner = str(listing.get("locked_by") or "").strip()
    lock_at = listing.get("locked_at")
    is_locked = listing.get("is_locked", False)

    # If locked by someone else within the last 15 minutes, deny
    if is_locked and current_lock_owner and current_lock_owner != user["id"]:
        if lock_at:
            locked_dt = datetime.fromisoformat(lock_at.replace("Z", "+00:00"))
            if (datetime.now(timezone.utc) - locked_dt).total_seconds() < 900:  # 15 min
                raise HTTPException(
                    status_code=409, detail="Already in process by another user"
                )

    await db.listings.update_one(
        {"id": listing_id},
        {
            "$set": {
                "is_locked": True,
                "locked_by": user["id"],
                "locked_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )

    return {"message": "Listing locked", "listing_id": listing_id, "is_locked": True}


@api_router.post("/unlock-listing")
async def unlock_listing(
    payload: LockListingRequest, user: dict = Depends(get_current_user)
):
    listing_id = str(payload.listing_id or "").strip()
    if not listing_id:
        raise HTTPException(status_code=400, detail="listing_id is required")

    listing = await db.listings.find_one(
        {"id": listing_id}, {"_id": 0, "owner_id": 1, "locked_by": 1}
    )
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    locked_by = str(listing.get("locked_by") or "").strip()
    if user.get("role") != UserRole.ADMIN and user.get("id") not in {
        locked_by,
        listing.get("owner_id"),
    }:
        raise HTTPException(
            status_code=403, detail="Not authorized to unlock this listing"
        )

    await db.listings.update_one(
        {"id": listing_id},
        {
            "$set": {
                "is_locked": False,
                "locked_by": None,
                "locked_at": None,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )
    return {"message": "Listing unlocked", "listing_id": listing_id, "is_locked": False}


@api_router.post("/listings/contact/reveal")
async def reveal_listing_contact(
    payload: RevealContactRequest, user: dict = Depends(get_current_user)
):
    listing_id = str(payload.listing_id or "").strip()
    if not listing_id:
        raise HTTPException(status_code=400, detail="listing_id is required")

    listing = await db.listings.find_one({"id": listing_id}, {"_id": 0})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    unlocked_users = set(str(x) for x in listing.get("contact_unlocked_user_ids", []))
    if (
        user["id"] != listing.get("owner_id")
        and user["id"] not in unlocked_users
        and user.get("role") != UserRole.ADMIN
    ):
        raise HTTPException(
            status_code=403,
            detail="Contact details are locked until payment is completed",
        )

    return {
        "listing_id": listing_id,
        "contact_phone": listing.get("contact_phone")
        or listing.get("owner_phone")
        or "",
        "contact_email": listing.get("contact_email") or "",
        "unlocked": True,
    }


@api_router.get("/listings/{listing_id}/price-history")
async def get_price_history(listing_id: str):
    listing = await db.listings.find_one(
        {"id": listing_id}, {"_id": 0, "price_history": 1}
    )
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    return {"price_history": listing.get("price_history", [])}


@api_router.put("/listings/{listing_id}")
async def update_listing(
    listing_id: str, update: ListingUpdate, user: dict = Depends(get_owner_user)
):
    listing = await db.listings.find_one({"id": listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    if listing["owner_id"] != user["id"] and user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")

    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    # Track price history
    if "price" in update_data and update_data["price"] != listing.get("price"):
        await db.listings.update_one(
            {"id": listing_id},
            {
                "$push": {
                    "price_history": {
                        "price": update_data["price"],
                        "date": datetime.now(timezone.utc).isoformat(),
                    }
                }
            },
        )

    await db.listings.update_one({"id": listing_id}, {"$set": update_data})

    return {"message": "Listing updated successfully"}


@api_router.delete("/listings/{listing_id}")
async def delete_listing(listing_id: str, user: dict = Depends(get_owner_user)):
    listing = await db.listings.find_one({"id": listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    if listing["owner_id"] != user["id"] and user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")

    await db.listings.delete_one({"id": listing_id})
    await db.users.update_one(
        {"id": listing["owner_id"]}, {"$pull": {"listings": listing_id}}
    )

    return {"message": "Listing deleted successfully"}


@api_router.post("/listings/{listing_id}/like")
async def like_listing(listing_id: str, user: dict = Depends(get_current_user)):
    listing = await db.listings.find_one({"id": listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    await db.listings.update_one({"id": listing_id}, {"$inc": {"likes": 1}})

    return {"message": "Listing liked"}


@api_router.post("/listings/{listing_id}/share")
async def share_listing(listing_id: str, user: dict = Depends(get_current_user)):
    await db.listings.update_one({"id": listing_id}, {"$inc": {"shares": 1}})
    return {"message": "Share recorded"}


# ============ BOOST LISTING ============
@api_router.post("/listings/boost")
async def boost_listing(boost: BoostListing, user: dict = Depends(get_owner_user)):
    listing = await db.listings.find_one({"id": boost.listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    if listing["owner_id"] != user["id"] and user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")

    boost_expires = (
        datetime.now(timezone.utc) + timedelta(days=boost.boost_days)
    ).isoformat()

    await db.listings.update_one(
        {"id": boost.listing_id},
        {
            "$set": {
                "status": ListingStatus.BOOSTED,
                "boost_expires": boost_expires,
                "boost_type": boost.boost_type,
            }
        },
    )

    return {
        "message": f"Listing boosted for {boost.boost_days} days",
        "expires": boost_expires,
    }


# ============ WISHLIST ROUTES ============
@api_router.post("/wishlist/{listing_id}")
async def add_to_wishlist(listing_id: str, user: dict = Depends(get_current_user)):
    listing = await db.listings.find_one({"id": listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    existing = await db.wishlists.find_one(
        {"user_id": user["id"], "listing_id": listing_id}
    )
    if not existing:
        wishlisted_at = datetime.now(timezone.utc).isoformat()
        await db.wishlists.insert_one(
            {
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "listing_id": listing_id,
                "created_at": wishlisted_at,
                "updated_at": wishlisted_at,
            }
        )
        await db.listings.update_one({"id": listing_id}, {"$inc": {"saves": 1}})
    await db.users.update_one(
        {"id": user["id"]}, {"$addToSet": {"wishlist": listing_id}}
    )

    return {"message": "Added to wishlist", "wishlisted": True}


@api_router.delete("/wishlist/{listing_id}")
async def remove_from_wishlist(listing_id: str, user: dict = Depends(get_current_user)):
    result = await db.wishlists.delete_one(
        {"user_id": user["id"], "listing_id": listing_id}
    )
    if result.deleted_count:
        await db.listings.update_one(
            {"id": listing_id, "saves": {"$gt": 0}},
            {"$inc": {"saves": -1}},
        )
    await db.users.update_one({"id": user["id"]}, {"$pull": {"wishlist": listing_id}})
    return {"message": "Removed from wishlist", "wishlisted": False}


@api_router.get("/wishlist")
async def get_wishlist(user: dict = Depends(get_current_user)):
    wishlist_docs = (
        await db.wishlists.find(
            {"user_id": user["id"]},
            {"_id": 0},
        )
        .sort("created_at", -1)
        .to_list(200)
    )

    if not wishlist_docs:
        wishlist_ids = [str(item) for item in (user.get("wishlist", []) or []) if item]
        if not wishlist_ids:
            return {"listings": [], "count": 0}
        listings = await db.listings.find(
            {"id": {"$in": wishlist_ids}}, {"_id": 0}
        ).to_list(200)
        listing_map = {
            listing.get("id"): listing for listing in listings if listing.get("id")
        }
        ordered_listings = []
        for listing_id in wishlist_ids:
            listing = listing_map.get(listing_id)
            if listing:
                listing["wishlisted_at"] = None
                ordered_listings.append(listing)
        return {"listings": ordered_listings, "count": len(ordered_listings)}

    listing_ids = [
        doc.get("listing_id") for doc in wishlist_docs if doc.get("listing_id")
    ]
    listings = await db.listings.find({"id": {"$in": listing_ids}}, {"_id": 0}).to_list(
        200
    )
    listing_map = {
        listing.get("id"): listing for listing in listings if listing.get("id")
    }

    ordered_listings = []
    for doc in wishlist_docs:
        listing_id = doc.get("listing_id")
        listing = listing_map.get(listing_id)
        if not listing:
            continue
        listing["wishlisted_at"] = doc.get("created_at") or doc.get("updated_at")
        ordered_listings.append(listing)

    return {"listings": ordered_listings, "count": len(ordered_listings)}


# ============ BOOKING ROUTES ============
@api_router.post("/bookings")
async def create_booking(
    booking: BookingCreate, user: dict = Depends(get_current_user)
):
    listing = await db.listings.find_one({"id": booking.listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    booking_id = str(uuid.uuid4())
    booking_doc = {
        "id": booking_id,
        "user_id": user["id"],
        "user_name": user["name"],
        "user_phone": user.get("phone", ""),
        "user_email": user["email"],
        "listing_id": booking.listing_id,
        "listing_title": listing["title"],
        "listing_category": listing["category"],
        "owner_id": listing["owner_id"],
        "owner_name": listing["owner_name"],
        "booking_date": booking.booking_date,
        "end_date": booking.end_date,
        "check_in_time": booking.check_in_time,
        "check_out_time": booking.check_out_time,
        "guests": booking.guests,
        "rooms": booking.rooms,
        "notes": booking.notes,
        "special_requests": booking.special_requests,
        "status": BookingStatus.PENDING,
        "total_price": listing["price"],
        "payment_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.bookings.insert_one(booking_doc)
    await db.listings.update_one({"id": booking.listing_id}, {"$inc": {"inquiries": 1}})

    # Send notification to owner
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": listing["owner_id"],
        "type": "booking_request",
        "title": "New Booking Request",
        "message": f"{user['name']} requested to book {listing['title']}",
        "data": {"booking_id": booking_id, "listing_id": booking.listing_id},
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.notifications.insert_one(notification)

    return {"message": "Booking request sent", "booking_id": booking_id}


@api_router.get("/bookings")
async def get_user_bookings(user: dict = Depends(get_current_user)):
    bookings = (
        await db.bookings.find(
            {
                "user_id": user["id"],
                "status": {
                    "$in": [BookingStatus.PENDING.value, BookingStatus.CONFIRMED.value]
                },
            },
            {"_id": 0},
        )
        .sort("created_at", -1)
        .to_list(100)
    )
    return {"bookings": bookings}


@api_router.get("/bookings/owner")
async def get_owner_bookings(user: dict = Depends(get_owner_user)):
    bookings = (
        await db.bookings.find({"owner_id": user["id"]}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(100)
    )
    return {"bookings": bookings}


@api_router.put("/bookings/{booking_id}/status")
async def update_booking_status(
    booking_id: str, status: BookingStatus, user: dict = Depends(get_owner_user)
):
    booking = await db.bookings.find_one({"id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking["owner_id"] != user["id"] and user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")

    await db.bookings.update_one({"id": booking_id}, {"$set": {"status": status}})

    if (
        status == BookingStatus.CONFIRMED
        and str(user.get("role") or "") == UserRole.PROPERTY_OWNER.value
    ):
        listing = await db.listings.find_one(
            {"id": booking["listing_id"]}, {"_id": 0, "price": 1}
        )
        if listing and listing.get("price") is not None:
            deal_amount = float(listing["price"])
            commission_amount = compute_commission(deal_amount)
            commission_doc = {
                "id": str(uuid.uuid4()),
                "owner_id": user["id"],
                "listing_id": booking["listing_id"],
                "booking_id": booking_id,
                "deal_amount": deal_amount,
                "commission_rate": COMMISSION_RATE,
                "commission_amount": commission_amount,
                "status": "pending",
                "paid_at": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.commissions.insert_one(commission_doc)
            await db.users.update_one(
                {"id": user["id"]},
                {
                    "$inc": {"total_commission_owed": commission_amount},
                    "$set": {"subscription_model": "commission"},
                },
            )
            await db.notifications.insert_one(
                {
                    "id": str(uuid.uuid4()),
                    "user_id": user["id"],
                    "type": "commission",
                    "title": "Commission due",
                    "message": f"A 5% platform commission of ₹{commission_amount:,.2f} is due on your confirmed deal.",
                    "read": False,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            )

    # Send notification to user
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": booking["user_id"],
        "type": "booking_update",
        "title": f"Booking {status}",
        "message": f"Your booking for {booking['listing_title']} has been {status}",
        "data": {"booking_id": booking_id},
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.notifications.insert_one(notification)

    return {"message": f"Booking {status}"}


# ============ VISIT SCHEDULING ============
@api_router.post("/visits/schedule")
async def schedule_visit(visit: VisitSchedule, user: dict = Depends(get_current_user)):
    listing = await db.listings.find_one({"id": visit.listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    visit_id = str(uuid.uuid4())
    visit_doc = {
        "id": visit_id,
        "user_id": user["id"],
        "user_name": user["name"],
        "user_phone": user.get("phone", ""),
        "listing_id": visit.listing_id,
        "listing_title": listing["title"],
        "owner_id": listing["owner_id"],
        "visit_date": visit.visit_date,
        "visit_time": visit.visit_time,
        "visit_type": visit.visit_type,
        "notes": visit.notes,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.visits.insert_one(visit_doc)

    return {"message": "Visit scheduled", "visit_id": visit_id}


@api_router.get("/visits")
async def get_visits(user: dict = Depends(get_current_user)):
    visits = (
        await db.visits.find({"user_id": user["id"]}, {"_id": 0})
        .sort("visit_date", 1)
        .to_list(50)
    )
    return {"visits": visits}


@api_router.get("/visits/owner")
async def get_owner_visits(user: dict = Depends(get_owner_user)):
    visits = (
        await db.visits.find({"owner_id": user["id"]}, {"_id": 0})
        .sort("visit_date", 1)
        .to_list(50)
    )
    return {"visits": visits}


# ============ NEGOTIATION ROUTES ============
@api_router.post("/negotiations")
async def create_negotiation(
    negotiation: NegotiationCreate, user: dict = Depends(get_current_user)
):
    listing = await db.listings.find_one({"id": negotiation.listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    negotiation_id = str(uuid.uuid4())
    negotiation_doc = {
        "id": negotiation_id,
        "user_id": user["id"],
        "user_name": user["name"],
        "listing_id": negotiation.listing_id,
        "listing_title": listing["title"],
        "owner_id": listing["owner_id"],
        "original_price": listing["price"],
        "offered_price": negotiation.offered_price,
        "current_price": negotiation.offered_price,
        "message": negotiation.message,
        "status": NegotiationStatus.PENDING,
        "history": [
            {
                "action": "offer",
                "price": negotiation.offered_price,
                "by": user["id"],
                "message": negotiation.message,
                "date": datetime.now(timezone.utc).isoformat(),
            }
        ],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.negotiations.insert_one(negotiation_doc)

    # Notify owner
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": listing["owner_id"],
        "type": "negotiation",
        "title": "New Price Offer",
        "message": f"{user['name']} offered ₹{negotiation.offered_price:,.0f} for {listing['title']}",
        "data": {
            "negotiation_id": negotiation_id,
            "listing_id": negotiation.listing_id,
        },
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.notifications.insert_one(notification)

    return {"message": "Offer sent", "negotiation_id": negotiation_id}


@api_router.put("/negotiations/{negotiation_id}/respond")
async def respond_negotiation(
    negotiation_id: str,
    response: NegotiationResponse,
    user: dict = Depends(get_owner_user),
):
    negotiation = await db.negotiations.find_one({"id": negotiation_id})
    if not negotiation:
        raise HTTPException(status_code=404, detail="Negotiation not found")

    if negotiation["owner_id"] != user["id"] and user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")

    update_data = {
        "status": response.status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    history_entry = {
        "action": response.status,
        "by": user["id"],
        "message": response.message,
        "date": datetime.now(timezone.utc).isoformat(),
    }

    if response.status == NegotiationStatus.COUNTER and response.counter_price:
        update_data["current_price"] = response.counter_price
        history_entry["price"] = response.counter_price

    await db.negotiations.update_one(
        {"id": negotiation_id},
        {"$set": update_data, "$push": {"history": history_entry}},
    )

    # Notify user
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": negotiation["user_id"],
        "type": "negotiation_response",
        "title": f"Offer {response.status}",
        "message": f"Your offer for {negotiation['listing_title']} has been {response.status}",
        "data": {"negotiation_id": negotiation_id},
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.notifications.insert_one(notification)

    return {"message": f"Response sent: {response.status}"}


@api_router.get("/negotiations")
async def get_negotiations(user: dict = Depends(get_current_user)):
    negotiations = (
        await db.negotiations.find({"user_id": user["id"]}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(50)
    )
    return {"negotiations": negotiations}


@api_router.get("/negotiations/owner")
async def get_owner_negotiations(user: dict = Depends(get_owner_user)):
    negotiations = (
        await db.negotiations.find({"owner_id": user["id"]}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(50)
    )
    return {"negotiations": negotiations}


# ============ REVIEWS ROUTES ============
@api_router.post("/reviews")
async def create_review(review: ReviewCreate, user: dict = Depends(get_current_user)):
    listing = await db.listings.find_one({"id": review.listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    # Check if user has booked this listing
    booking = await db.bookings.find_one(
        {
            "user_id": user["id"],
            "listing_id": review.listing_id,
            "status": BookingStatus.COMPLETED,
        }
    )

    review_id = str(uuid.uuid4())
    review_doc = {
        "id": review_id,
        "user_id": user["id"],
        "user_name": user["name"],
        "listing_id": review.listing_id,
        "owner_id": listing["owner_id"],
        "rating": review.rating,
        "title": review.title,
        "comment": review.comment,
        "images": review.images,
        "verified_booking": booking is not None,
        "helpful_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.reviews.insert_one(review_doc)

    # Update listing rating
    all_reviews = await db.reviews.find(
        {"listing_id": review.listing_id}, {"rating": 1}
    ).to_list(1000)
    avg_rating = sum(r["rating"] for r in all_reviews) / len(all_reviews)
    await db.listings.update_one(
        {"id": review.listing_id},
        {"$set": {"rating": avg_rating, "review_count": len(all_reviews)}},
    )

    return {"message": "Review submitted", "review_id": review_id}


@api_router.get("/reviews/listing/{listing_id}")
async def get_listing_reviews(listing_id: str, page: int = 1, limit: int = 20):
    skip = (page - 1) * limit
    reviews = (
        await db.reviews.find({"listing_id": listing_id}, {"_id": 0})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )
    total = await db.reviews.count_documents({"listing_id": listing_id})

    return {"reviews": reviews, "total": total, "page": page}


# ============ VIDEOS/REELS ROUTES ============
from fastapi import File, UploadFile
import cloudinary
import cloudinary.uploader

# Initialize Cloudinary
CLOUDINARY_CLOUD_NAME = os.environ.get("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY = os.environ.get("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.environ.get("CLOUDINARY_API_SECRET")

# ============ CLOUDINARY PRODUCTION CONFIG ============
import asyncio
from functools import partial

CLOUDINARY_CLOUD_NAME = os.environ.get("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY = os.environ.get("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.environ.get("CLOUDINARY_API_SECRET")
CLOUDINARY_UPLOAD_PRESET = os.environ.get(
    "CLOUDINARY_UPLOAD_PRESET", "gharsetu_unsigned"
)

if CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY:
    cloudinary.config(
        cloud_name=CLOUDINARY_CLOUD_NAME,
        api_key=CLOUDINARY_API_KEY,
        api_secret=CLOUDINARY_API_SECRET,
        secure=True,  # ✅ Always HTTPS
    )
    logger.info(f"✅ Cloudinary configured: {CLOUDINARY_CLOUD_NAME}")
else:
    logger.warning("⚠️ Cloudinary not configured - running in demo mode")


@api_router.post("/upload/signature")
async def get_upload_signature(
    payload: UploadSignatureRequest, user: dict = Depends(get_current_user)
):
    """Generate short-lived Cloudinary signature for direct frontend uploads."""
    if not CLOUDINARY_CLOUD_NAME or not CLOUDINARY_API_KEY or not CLOUDINARY_API_SECRET:
        raise HTTPException(status_code=503, detail="Cloudinary is not configured")

    await enforce_upload_rate_limit(
        user["id"], "upload_signature", max_requests=30, window_seconds=60
    )

    allowed_resource_types = {"image", "video", "auto"}
    resource_type = (
        payload.resource_type
        if payload.resource_type in allowed_resource_types
        else "auto"
    )
    folder = payload.folder.strip() if payload.folder else "listings"
    folder = folder.replace("..", "").strip("/") or "listings"
    if folder not in ALLOWED_UPLOAD_FOLDERS:
        raise HTTPException(status_code=400, detail="Invalid upload folder")
    ensure_folder_access(user, folder)
    cloudinary_folder = f"gharsetu/{folder}"

    timestamp = int(datetime.now(timezone.utc).timestamp())
    params_to_sign = {
        "folder": cloudinary_folder,
        "timestamp": timestamp,
    }
    signature = cloudinary.utils.api_sign_request(params_to_sign, CLOUDINARY_API_SECRET)

    return {
        "cloud_name": CLOUDINARY_CLOUD_NAME,
        "api_key": CLOUDINARY_API_KEY,
        "signature": signature,
        "timestamp": timestamp,
        "folder": cloudinary_folder,
        "resource_type": resource_type,
    }


@api_router.post("/upload/delete")
async def delete_uploaded_media(
    payload: UploadDeleteRequest,
    idempotency_key: Optional[str] = Header(default=None, alias="Idempotency-Key"),
    user: dict = Depends(get_current_user),
):
    """Delete uploaded Cloudinary media by public_id with idempotent retry queue."""
    if not CLOUDINARY_CLOUD_NAME or not CLOUDINARY_API_KEY or not CLOUDINARY_API_SECRET:
        raise HTTPException(status_code=503, detail="Cloudinary is not configured")

    await enforce_upload_rate_limit(
        user["id"], "upload_delete", max_requests=20, window_seconds=60
    )

    public_id = payload.public_id.strip() if payload.public_id else ""
    if not public_id:
        raise HTTPException(status_code=400, detail="public_id is required")

    # Only allow deleting assets in the app namespace.
    if not public_id.startswith("gharsetu/"):
        raise HTTPException(status_code=400, detail="Invalid public_id")

    folder_part = public_id.split("/", 2)[1] if public_id.count("/") >= 1 else ""
    if folder_part not in ALLOWED_UPLOAD_FOLDERS:
        raise HTTPException(status_code=400, detail="Invalid media folder")
    ensure_folder_access(user, folder_part)

    allowed_resource_types = {"image", "video", "raw"}
    resource_type = (
        payload.resource_type
        if payload.resource_type in allowed_resource_types
        else "image"
    )
    now = datetime.now(timezone.utc)
    job_id = build_delete_job_id(user["id"], public_id, resource_type, idempotency_key)

    existing_job = await db.media_delete_jobs.find_one({"id": job_id}, {"_id": 0})
    if existing_job and existing_job.get("status") == "completed":
        return {
            "success": True,
            "result": existing_job.get("result", "ok"),
            "public_id": public_id,
            "job_id": job_id,
            "idempotent_replay": True,
        }

    if not existing_job:
        await db.media_delete_jobs.insert_one(
            {
                "id": job_id,
                "user_id": user["id"],
                "public_id": public_id,
                "resource_type": resource_type,
                "status": "pending",
                "attempts": 0,
                "result": None,
                "last_error": None,
                "next_retry_at": now,
                "created_at": now,
                "updated_at": now,
            }
        )

    claimed_job = await db.media_delete_jobs.find_one_and_update(
        {
            "id": job_id,
            "status": {"$in": ["pending", "retry"]},
        },
        {
            "$set": {
                "status": "processing",
                "updated_at": now,
            }
        },
        return_document=ReturnDocument.AFTER,
    )

    if claimed_job:
        attempt_result = await process_media_delete_job(claimed_job)
        final_doc = await db.media_delete_jobs.find_one({"id": job_id}, {"_id": 0})
        return {
            "success": bool(final_doc and final_doc.get("status") == "completed"),
            "result": final_doc.get("result")
            if final_doc
            else attempt_result.get("result", "unknown"),
            "public_id": public_id,
            "job_id": job_id,
            "queued": bool(
                final_doc
                and final_doc.get("status") in {"retry", "pending", "processing"}
            ),
            "attempts": final_doc.get("attempts", 0) if final_doc else 0,
        }

    in_progress = await db.media_delete_jobs.find_one(
        {"id": job_id}, {"_id": 0, "status": 1, "attempts": 1}
    )
    return {
        "success": False,
        "result": "queued",
        "public_id": public_id,
        "job_id": job_id,
        "queued": True,
        "status": in_progress.get("status", "pending") if in_progress else "pending",
        "attempts": in_progress.get("attempts", 0) if in_progress else 0,
    }


@api_router.get("/admin/media-delete-jobs")
async def get_media_delete_jobs(
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    admin: dict = Depends(get_admin_user),
):
    """Admin endpoint to inspect media delete jobs and their states."""
    skip = (page - 1) * limit
    query: Dict[str, Any] = {}
    if status:
        allowed_statuses = {"pending", "processing", "retry", "completed", "failed"}
        if status not in allowed_statuses:
            raise HTTPException(status_code=400, detail="Invalid status filter")
        query["status"] = status

    jobs = (
        await db.media_delete_jobs.find(query, {"_id": 0})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )
    total = await db.media_delete_jobs.count_documents(query)

    status_counts_cursor = db.media_delete_jobs.aggregate(
        [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    )
    status_counts_docs = await status_counts_cursor.to_list(length=20)
    status_counts = {
        "pending": 0,
        "processing": 0,
        "retry": 0,
        "completed": 0,
        "failed": 0,
    }
    for item in status_counts_docs:
        key = item.get("_id")
        if key in status_counts:
            status_counts[key] = item.get("count", 0)

    return {
        "jobs": jobs,
        "total": total,
        "limit": limit,
        "page": page,
        "total_pages": (total + limit - 1) // limit if limit else 1,
        "status": status,
        "status_counts": status_counts,
        "max_attempts": DELETE_JOB_MAX_ATTEMPTS,
    }


@api_router.post("/admin/media-delete-jobs/{job_id}/retry")
async def retry_media_delete_job(job_id: str, admin: dict = Depends(get_admin_user)):
    """Admin endpoint to force retry a failed media delete job."""
    now = datetime.now(timezone.utc)
    job = await db.media_delete_jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Delete job not found")

    if job.get("status") == "completed":
        return {
            "success": True,
            "message": "Job already completed",
            "job_id": job_id,
        }

    if job.get("status") == "processing":
        raise HTTPException(status_code=409, detail="Job is currently processing")

    attempts = int(job.get("attempts", 0))
    if attempts >= DELETE_JOB_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=400,
            detail=f"Retry limit reached ({DELETE_JOB_MAX_ATTEMPTS} attempts)",
        )

    await db.media_delete_jobs.update_one(
        {"id": job_id},
        {
            "$set": {
                "status": "retry",
                "next_retry_at": now,
                "updated_at": now,
            }
        },
    )

    audit_doc = {
        "id": str(uuid.uuid4()),
        "action": "media_delete_job_retry",
        "actor_id": admin.get("id"),
        "actor_email": admin.get("email"),
        "target_id": job_id,
        "target_type": "media_delete_job",
        "meta": {
            "attempts": attempts,
            "previous_status": job.get("status", "unknown"),
            "public_id": job.get("public_id"),
        },
        "created_at": now,
    }
    await db.admin_audit_logs.insert_one(audit_doc)

    return {
        "success": True,
        "message": "Retry queued",
        "job_id": job_id,
    }


@api_router.post("/admin/media-delete-jobs/{job_id}/reset-retry")
async def reset_retry_media_delete_job(
    job_id: str, admin: dict = Depends(get_admin_user)
):
    """Admin endpoint to reset attempts and requeue a delete job."""
    now = datetime.now(timezone.utc)
    job = await db.media_delete_jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Delete job not found")

    if job.get("status") == "processing":
        raise HTTPException(status_code=409, detail="Job is currently processing")

    if job.get("status") == "completed":
        return {
            "success": True,
            "message": "Job already completed",
            "job_id": job_id,
        }

    previous_attempts = int(job.get("attempts", 0))
    previous_status = job.get("status", "unknown")

    await db.media_delete_jobs.update_one(
        {"id": job_id},
        {
            "$set": {
                "status": "retry",
                "attempts": 0,
                "next_retry_at": now,
                "updated_at": now,
                "last_error": None,
            }
        },
    )

    audit_doc = {
        "id": str(uuid.uuid4()),
        "action": "media_delete_job_reset_retry",
        "actor_id": admin.get("id"),
        "actor_email": admin.get("email"),
        "target_id": job_id,
        "target_type": "media_delete_job",
        "meta": {
            "previous_attempts": previous_attempts,
            "previous_status": previous_status,
            "public_id": job.get("public_id"),
        },
        "created_at": now,
    }
    await db.admin_audit_logs.insert_one(audit_doc)

    return {
        "success": True,
        "message": "Attempts reset and retry queued",
        "job_id": job_id,
    }


async def create_system_notification(
    user_id: str,
    title: str,
    message: str,
    type: str = "info",
    link: Optional[str] = None,
):
    """Create a professional system notification for an owner."""
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": title,
        "message": message,
        "type": type,
        "link": link,
        "read": False,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.notifications.insert_one(notification)
    return notification


@api_router.get("/admin/audit-logs")
async def get_admin_audit_logs(
    action: Optional[str] = None,
    q: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    admin: dict = Depends(get_admin_user),
):
    """Admin endpoint to inspect operational audit logs."""
    skip = (page - 1) * limit
    query: Dict[str, Any] = {}
    if action:
        query["action"] = action

    if q:
        search_text = q.strip()
        if search_text:
            query["$or"] = [
                {"actor_email": {"$regex": search_text, "$options": "i"}},
                {"actor_id": {"$regex": search_text, "$options": "i"}},
                {"target_id": {"$regex": search_text, "$options": "i"}},
                {"target_type": {"$regex": search_text, "$options": "i"}},
                {"meta.public_id": {"$regex": search_text, "$options": "i"}},
            ]

    date_filter: Dict[str, Any] = {}
    if from_date:
        try:
            from_dt = datetime.fromisoformat(from_date)
            date_filter["$gte"] = from_dt
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid from_date format")
    if to_date:
        try:
            to_dt = datetime.fromisoformat(to_date)
            date_filter["$lte"] = to_dt
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid to_date format")
    if date_filter:
        query["created_at"] = date_filter

    logs = (
        await db.admin_audit_logs.find(query, {"_id": 0})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )
    total = await db.admin_audit_logs.count_documents(query)

    action_counts_cursor = db.admin_audit_logs.aggregate(
        [{"$group": {"_id": "$action", "count": {"$sum": 1}}}]
    )
    action_counts_docs = await action_counts_cursor.to_list(length=100)
    action_counts = {
        item.get("_id", "unknown"): item.get("count", 0) for item in action_counts_docs
    }

    return {
        "logs": logs,
        "total": total,
        "limit": limit,
        "page": page,
        "total_pages": (total + limit - 1) // limit if limit else 1,
        "action": action,
        "q": q,
        "from_date": from_date,
        "to_date": to_date,
        "action_counts": action_counts,
    }


@api_router.get("/admin/debug/reels-sessions")
async def get_admin_reels_debug_sessions(
    stress_session_id: Optional[str] = None,
    user_id: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    include_captures: bool = Query(False),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    admin: dict = Depends(get_admin_user),
):
    skip = (page - 1) * limit
    query: Dict[str, Any] = {"type": "reels_interaction_debug"}
    if stress_session_id:
        query["stress_session_id"] = stress_session_id
    if user_id:
        query["user_id"] = user_id

    created_at_filter: Dict[str, datetime] = {}
    if from_date:
        try:
            created_at_filter["$gte"] = datetime.fromisoformat(
                from_date.replace("Z", "+00:00")
            )
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid from_date format")
    if to_date:
        try:
            created_at_filter["$lte"] = datetime.fromisoformat(
                to_date.replace("Z", "+00:00")
            )
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid to_date format")
    if created_at_filter:
        query["created_at"] = created_at_filter

    projection: Dict[str, Any] = {
        "_id": 0,
        "id": 1,
        "type": 1,
        "user_id": 1,
        "user_email": 1,
        "stress_session_id": 1,
        "stats": 1,
        "hit_rate_history": 1,
        "total_captures": 1,
        "created_at": 1,
    }
    if include_captures:
        projection["captures"] = 1

    reports = (
        await db.debug_session_reports.find(query, projection)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )
    total = await db.debug_session_reports.count_documents(query)

    return {
        "reports": reports,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit if limit else 1,
        "stress_session_id": stress_session_id,
        "user_id": user_id,
        "from_date": from_date,
        "to_date": to_date,
        "include_captures": include_captures,
    }


@api_router.get("/admin/audit-logs/export")
async def export_admin_audit_logs_csv(
    action: Optional[str] = None,
    q: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = Query(2000, ge=1, le=10000),
    admin: dict = Depends(get_admin_user),
):
    """Export admin audit logs as CSV for compliance/reporting workflows."""
    query: Dict[str, Any] = {}
    if action:
        query["action"] = action

    if q:
        search_text = q.strip()
        if search_text:
            query["$or"] = [
                {"actor_email": {"$regex": search_text, "$options": "i"}},
                {"actor_id": {"$regex": search_text, "$options": "i"}},
                {"target_id": {"$regex": search_text, "$options": "i"}},
                {"target_type": {"$regex": search_text, "$options": "i"}},
                {"meta.public_id": {"$regex": search_text, "$options": "i"}},
            ]

    date_filter: Dict[str, Any] = {}
    if from_date:
        try:
            from_dt = datetime.fromisoformat(from_date)
            date_filter["$gte"] = from_dt
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid from_date format")
    if to_date:
        try:
            to_dt = datetime.fromisoformat(to_date)
            date_filter["$lte"] = to_dt
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid to_date format")
    if date_filter:
        query["created_at"] = date_filter

    logs = (
        await db.admin_audit_logs.find(query, {"_id": 0})
        .sort("created_at", -1)
        .limit(limit)
        .to_list(limit)
    )

    csv_stream = io.StringIO()
    writer = csv.writer(csv_stream)
    writer.writerow(
        [
            "id",
            "action",
            "actor_id",
            "actor_email",
            "target_type",
            "target_id",
            "meta",
            "created_at",
        ]
    )

    for log in logs:
        writer.writerow(
            [
                log.get("id", ""),
                log.get("action", ""),
                log.get("actor_id", ""),
                log.get("actor_email", ""),
                log.get("target_type", ""),
                log.get("target_id", ""),
                json.dumps(log.get("meta", {}), ensure_ascii=False),
                str(log.get("created_at", "")),
            ]
        )

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"admin_audit_logs_{timestamp}.csv"

    return Response(
        content=csv_stream.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ============ IMAGE UPLOAD ROUTE ============
@api_router.post("/upload/image")
async def upload_image(
    file: UploadFile = File(...),
    folder: str = Form("listings"),
    user: dict = Depends(get_current_user),
):
    # 1. File type check
    ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPG/PNG/WebP allowed")

    # 2. Read and size check
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 10MB)")

    # 3. Magic byte validation
    MAGIC = [b"\xff\xd8\xff", b"\x89PNG", b"RIFF"]
    if not any(content.startswith(m) for m in MAGIC):
        raise HTTPException(status_code=400, detail="Invalid image file")

    image_id = str(uuid.uuid4())

    if not CLOUDINARY_CLOUD_NAME:
        return {
            "success": True,
            "url": f"https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&sig={image_id[:8]}",
            "public_id": image_id,
        }

    try:
        # 4. Async upload (non-blocking!)
        upload_func = partial(
            cloudinary.uploader.upload,
            content,
            resource_type="image",
            folder=f"gharsetu/{folder}",
            public_id=image_id,
            overwrite=False,
            transformation=[
                {
                    "width": 1200,
                    "crop": "limit",
                    "quality": "auto:good",
                    "fetch_format": "auto",
                }
            ],
            eager=[
                {"width": 400, "crop": "fill", "gravity": "auto", "quality": "auto"}
            ],
        )
        result = await asyncio.get_event_loop().run_in_executor(None, upload_func)

        return {
            "success": True,
            "url": result.get("secure_url"),
            "thumbnail_url": result.get("eager", [{}])[0].get(
                "secure_url", result.get("secure_url")
            ),
            "public_id": result.get("public_id"),
            "width": result.get("width"),
            "height": result.get("height"),
            "format": result.get("format"),
        }
    except Exception as e:
        logger.error(f"Cloudinary upload failed: {e}")
        raise HTTPException(status_code=500, detail="Image upload failed")


@api_router.post("/upload/images")
async def upload_multiple_images(
    files: List[UploadFile] = File(...),
    folder: str = Form("listings"),
    user: dict = Depends(get_current_user),
):
    if len(files) > 10:
        raise HTTPException(status_code=400, detail="Max 10 images allowed")

    ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
    results = []

    for file in files:
        if file.content_type not in ALLOWED_TYPES:
            results.append(
                {"success": False, "filename": file.filename, "error": "Invalid type"}
            )
            continue

        content = await file.read()
        if len(content) > 10 * 1024 * 1024:
            results.append(
                {"success": False, "filename": file.filename, "error": "Too large"}
            )
            continue

        image_id = str(uuid.uuid4())

        if not CLOUDINARY_CLOUD_NAME:
            results.append(
                {
                    "success": True,
                    "url": f"https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&sig={image_id[:8]}",
                    "public_id": image_id,
                    "filename": file.filename,
                }
            )
            continue

        try:
            upload_func = partial(
                cloudinary.uploader.upload,
                content,
                resource_type="image",
                folder=f"gharsetu/{folder}",
                public_id=image_id,
                transformation=[
                    {
                        "width": 1200,
                        "crop": "limit",
                        "quality": "auto:good",
                        "fetch_format": "auto",
                    }
                ],
                eager=[{"width": 400, "crop": "fill", "gravity": "auto"}],
            )
            result = await asyncio.get_event_loop().run_in_executor(None, upload_func)
            results.append(
                {
                    "success": True,
                    "url": result.get("secure_url"),
                    "thumbnail_url": result.get("eager", [{}])[0].get(
                        "secure_url", result.get("secure_url")
                    ),
                    "public_id": result.get("public_id"),
                    "filename": file.filename,
                }
            )
        except Exception as e:
            logger.error(f"Upload failed for {file.filename}: {e}")
            results.append(
                {"success": False, "filename": file.filename, "error": str(e)}
            )

    return {"images": results, "total": len(results)}


@api_router.post("/videos/upload")
async def upload_video(
    title: str = Form(...),
    description: str = Form(None),
    category: str = Form("home"),
    listing_id: str = Form(None),
    video: UploadFile = File(...),
    user: dict = Depends(get_owner_user),
):
    """Upload video reel with Cloudinary"""
    try:
        parsed_category = ListingCategory(category)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid category")

    ensure_category_allowed_for_role(
        user.get("role"), parsed_category, detail_prefix="Reel category"
    )

    if listing_id:
        listing = await db.listings.find_one(
            {"id": listing_id}, {"_id": 0, "owner_id": 1}
        )
        if not listing:
            raise HTTPException(status_code=404, detail="Linked listing not found")
        if (
            listing.get("owner_id") != user.get("id")
            and user.get("role") != UserRole.ADMIN
        ):
            raise HTTPException(
                status_code=403, detail="Cannot attach reel to another owner's listing"
            )

    # Check file type
    if not video.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="File must be a video")

    # Check file size (max 100MB)
    content = await video.read()
    if len(content) > 100 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Video too large (max 100MB)")

    video_id = str(uuid.uuid4())

    # Upload to Cloudinary
    video_public_id = ""
    video_version: Optional[int] = None
    thumbnail_url = ""

    if CLOUDINARY_CLOUD_NAME:
        try:
            upload_func = partial(
                cloudinary.uploader.upload,
                content,
                resource_type="video",
                folder="gharsetu/reels",
                public_id=video_id,
                chunk_size=6 * 1024 * 1024,
                eager=[
                    {
                        "width": 720,
                        "crop": "scale",
                        "quality": "auto:eco",
                        "fetch_format": "auto",
                    }
                ],
                eager_async=True,
            )
            result = await asyncio.get_event_loop().run_in_executor(None, upload_func)
            video_public_id = result.get("public_id", "")
            video_version = result.get("version")

            # Generate thumbnail
            thumbnail_url = cloudinary.utils.cloudinary_url(
                result["public_id"],
                resource_type="video",
                format="jpg",
                secure=True,
                transformation=[{"width": 400, "crop": "scale"}],
            )[0]
        except Exception as e:
            logger.error(f"Cloudinary upload failed: {e}")
            raise HTTPException(status_code=500, detail="Video upload failed")
    else:
        # Demo mode
        video_public_id = "demo/sample-video"
        video_version = None
        thumbnail_url = (
            "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600"
        )

    if CLOUDINARY_CLOUD_NAME and video_public_id:
        if video_version:
            video_playback_url = f"https://res.cloudinary.com/{CLOUDINARY_CLOUD_NAME}/video/upload/v{video_version}/{video_public_id}.mp4"
        else:
            video_playback_url = f"https://res.cloudinary.com/{CLOUDINARY_CLOUD_NAME}/video/upload/{video_public_id}.mp4"
    else:
        video_playback_url = "https://player.vimeo.com/external/434045526.sd.mp4?s=c27eecc69a27dbc4ff2b87d38afc35f1a9e7c02d&profile_id=165"

    video_doc = {
        "id": video_id,
        "owner_id": user["id"],
        "owner_name": user["name"],
        "title": title,
        "description": description or "",
        "category": parsed_category.value,
        "video_public_id": video_public_id,
        "video_version": video_version,
        "url": video_playback_url,
        "video_url": video_public_id,
        "thumbnail_url": thumbnail_url,
        "listing_id": listing_id or "",
        "likes": 0,
        "views": 0,
        "saves": 0,
        "shares": 0,
        "comments": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.videos.insert_one(video_doc)

    return {
        "success": True,
        "message": "Video uploaded successfully",
        "video_id": video_id,
        "video_public_id": video_public_id,
        "video_version": video_version,
        "url": video_playback_url,
        "thumbnail_url": thumbnail_url,
    }


@api_router.post("/videos")
async def create_video(video: VideoCreate, user: dict = Depends(get_owner_user)):
    ensure_category_allowed_for_role(
        user.get("role"), video.category, detail_prefix="Reel category"
    )

    video_id = str(uuid.uuid4())
    extracted_public_id, extracted_version = (
        _extract_cloudinary_video_public_id_and_version(video.video_url)
    )

    canonical_url = None
    if extracted_public_id:
        canonical_url = _build_cloudinary_video_playback_url(
            extracted_public_id, extracted_version
        )

    normalized_video_url = extracted_public_id or str(video.video_url or "").replace(
        "http://", "https://"
    )
    normalized_url = canonical_url or str(video.video_url or "").replace(
        "http://", "https://"
    )
    thumbnail_url = str(video.thumbnail_url or "").replace("http://", "https://")
    if extracted_public_id and not thumbnail_url and CLOUDINARY_CLOUD_NAME:
        if extracted_version is not None:
            thumbnail_url = f"https://res.cloudinary.com/{CLOUDINARY_CLOUD_NAME}/video/upload/v{int(extracted_version)}/{extracted_public_id}.jpg"
        else:
            thumbnail_url = f"https://res.cloudinary.com/{CLOUDINARY_CLOUD_NAME}/video/upload/{extracted_public_id}.jpg"

    video_doc = {
        "id": video_id,
        "owner_id": user["id"],
        "owner_name": user["name"],
        "owner_verified": user.get("aadhar_status") == VerificationStatus.VERIFIED,
        **video.model_dump(),
        "video_public_id": extracted_public_id,
        "video_version": extracted_version,
        "video_url": normalized_video_url,
        "url": normalized_url,
        "thumbnail_url": thumbnail_url,
        "likes": 0,
        "views": 0,
        "saves": 0,
        "shares": 0,
        "comments": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.videos.insert_one(video_doc)

    return {"message": "Video posted successfully", "video_id": video_id}


@api_router.get("/videos")
async def get_videos(
    category: Optional[ListingCategory] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    user: Optional[dict] = Depends(get_optional_current_user),
    response: Response = None,
):
    query = {}
    if category:
        query["category"] = category

    is_anonymous = not user
    cache_key = _build_hot_cache_key(
        "videos",
        {
            "category": str(
                category.value if isinstance(category, Enum) else category or ""
            ),
            "page": page,
            "limit": limit,
        },
    )
    if is_anonymous:
        cached_payload = await get_hot_cached_payload(cache_key)
        if cached_payload is not None:
            if response is not None:
                response.headers["X-Cache"] = "HIT"
                response.headers["Cache-Control"] = (
                    f"public, max-age={HOT_ENDPOINT_CACHE_TTL_SECONDS}"
                )
            return cached_payload

    skip = (page - 1) * limit
    projection = {
        "_id": 0,
        "id": 1,
        "owner_id": 1,
        "owner_name": 1,
        "owner_image": 1,
        "title": 1,
        "description": 1,
        "category": 1,
        "url": 1,
        "video_url": 1,
        "video_public_id": 1,
        "video_version": 1,
        "thumbnail_url": 1,
        "listing_id": 1,
        "likes": 1,
        "views": 1,
        "saves": 1,
        "shares": 1,
        "comments_count": 1,
        "created_at": 1,
        "location": 1,
        "hashtags": 1,
    }
    videos = (
        await db.videos.find(query, projection)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )
    videos = [_normalize_video_doc_for_response(video) for video in videos]
    total = await db.videos.count_documents(query)

    if user and videos:
        user_id = user["id"]
        video_ids = [v["id"] for v in videos]
        owner_ids = list({v.get("owner_id") for v in videos if v.get("owner_id")})

        liked_docs = await db.likes.find(
            {"user_id": user_id, "reel_id": {"$in": video_ids}},
            {"_id": 0, "reel_id": 1},
        ).to_list(len(video_ids))
        liked_set = {d["reel_id"] for d in liked_docs}

        follow_docs = await db.follows.find(
            {"follower_id": user_id, "following_id": {"$in": owner_ids}},
            {"_id": 0, "following_id": 1},
        ).to_list(len(owner_ids))
        following_set = {d["following_id"] for d in follow_docs}

        saved_set = set(user.get("saved_reels", []))

        for v in videos:
            v["user_liked"] = v["id"] in liked_set
            v["user_saved"] = v["id"] in saved_set
            v["user_following"] = v.get("owner_id") in following_set

    payload = {
        "videos": videos,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
    }
    if is_anonymous:
        await set_hot_cached_payload(cache_key, payload)
        if response is not None:
            response.headers["X-Cache"] = "MISS"
            response.headers["Cache-Control"] = (
                f"public, max-age={HOT_ENDPOINT_CACHE_TTL_SECONDS}"
            )
    return payload


@api_router.get("/videos/feed")
async def get_video_feed(
    user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=30),
):
    # Personalized feed based on user preferences
    preferences = user.get("preferences", {})

    query = {}
    if preferences.get("category"):
        query["category"] = preferences["category"]

    skip = (page - 1) * limit
    projection = {
        "_id": 0,
        "id": 1,
        "owner_id": 1,
        "owner_name": 1,
        "owner_image": 1,
        "title": 1,
        "description": 1,
        "category": 1,
        "url": 1,
        "video_url": 1,
        "video_public_id": 1,
        "video_version": 1,
        "thumbnail_url": 1,
        "listing_id": 1,
        "likes": 1,
        "views": 1,
        "saves": 1,
        "shares": 1,
        "comments_count": 1,
        "created_at": 1,
        "location": 1,
        "hashtags": 1,
    }
    videos = (
        await db.videos.find(query, projection)
        .sort([("views", -1), ("created_at", -1)])
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )
    videos = [_normalize_video_doc_for_response(video) for video in videos]

    if videos:
        user_id = user["id"]
        video_ids = [v["id"] for v in videos]
        owner_ids = list({v.get("owner_id") for v in videos if v.get("owner_id")})

        liked_docs = await db.likes.find(
            {"user_id": user_id, "reel_id": {"$in": video_ids}},
            {"_id": 0, "reel_id": 1},
        ).to_list(len(video_ids))
        liked_set = {d["reel_id"] for d in liked_docs}

        follow_docs = await db.follows.find(
            {"follower_id": user_id, "following_id": {"$in": owner_ids}},
            {"_id": 0, "following_id": 1},
        ).to_list(len(owner_ids))
        following_set = {d["following_id"] for d in follow_docs}

        saved_set = set(user.get("saved_reels", []))

        for v in videos:
            v["user_liked"] = v["id"] in liked_set
            v["user_saved"] = v["id"] in saved_set
            v["user_following"] = v.get("owner_id") in following_set

    return {"videos": videos, "page": page}


@api_router.get("/videos/saved")
async def get_saved_videos(user: dict = Depends(get_current_user)):
    saved_ids = user.get("saved_reels", [])
    if not saved_ids:
        return {"videos": []}

    videos = await db.videos.find({"id": {"$in": saved_ids}}, {"_id": 0}).to_list(100)
    return {"videos": videos}


@api_router.get("/videos/{video_id}")
async def get_video_by_id(
    video_id: str, user: Optional[dict] = Depends(get_optional_current_user)
):
    projection = {
        "_id": 0,
        "id": 1,
        "owner_id": 1,
        "owner_name": 1,
        "owner_image": 1,
        "title": 1,
        "description": 1,
        "category": 1,
        "url": 1,
        "video_url": 1,
        "thumbnail_url": 1,
        "listing_id": 1,
        "likes": 1,
        "views": 1,
        "saves": 1,
        "shares": 1,
        "comments_count": 1,
        "created_at": 1,
        "location": 1,
        "hashtags": 1,
    }
    video = await db.videos.find_one({"id": video_id}, projection)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if user:
        user_id = user["id"]
        like_doc = await db.likes.find_one(
            {"user_id": user_id, "reel_id": video_id}, {"_id": 0, "id": 1}
        )
        follow_doc = await db.follows.find_one(
            {"follower_id": user_id, "following_id": video.get("owner_id")},
            {"_id": 0, "id": 1},
        )
        video["user_liked"] = bool(like_doc)
        video["user_saved"] = video_id in set(user.get("saved_reels", []))
        video["user_following"] = bool(follow_doc)

    return video


@api_router.get("/interactions/snapshot")
async def get_interactions_snapshot(
    reel_ids: Optional[str] = Query(None, description="Comma-separated reel IDs"),
    owner_ids: Optional[str] = Query(None, description="Comma-separated owner IDs"),
    user: dict = Depends(get_current_user),
):
    # Lightweight hydration endpoint for global interaction state.
    raw_reel_ids = [s.strip() for s in (reel_ids or "").split(",") if s and s.strip()]
    raw_owner_ids = [s.strip() for s in (owner_ids or "").split(",") if s and s.strip()]

    # Bound the payload to keep endpoint predictable under heavy clients.
    reel_id_list = list(dict.fromkeys(raw_reel_ids))[:200]
    owner_id_list = list(dict.fromkeys(raw_owner_ids))[:200]

    user_id = user["id"]
    liked_reel_ids: List[str] = []
    following_owner_ids: List[str] = []

    if reel_id_list:
        liked_docs = await db.likes.find(
            {"user_id": user_id, "reel_id": {"$in": reel_id_list}},
            {"_id": 0, "reel_id": 1},
        ).to_list(len(reel_id_list))
        liked_reel_ids = [d["reel_id"] for d in liked_docs if d.get("reel_id")]

    if owner_id_list:
        follow_docs = await db.follows.find(
            {"follower_id": user_id, "following_id": {"$in": owner_id_list}},
            {"_id": 0, "following_id": 1},
        ).to_list(len(owner_id_list))
        following_owner_ids = [
            d["following_id"] for d in follow_docs if d.get("following_id")
        ]

    reel_id_set = set(reel_id_list)
    saved_reel_ids = [
        rid
        for rid in user.get("saved_reels", [])
        if not reel_id_set or rid in reel_id_set
    ]

    return {
        "liked_reel_ids": liked_reel_ids,
        "following_owner_ids": following_owner_ids,
        "saved_reel_ids": saved_reel_ids,
    }


@api_router.post("/debug/reels-session")
async def persist_reels_debug_session(
    payload: ReelsDebugReportIn,
    user: dict = Depends(get_current_user),
):
    await enforce_upload_rate_limit(
        user["id"], "debug_report", max_requests=20, window_seconds=60
    )

    now = datetime.now(timezone.utc)
    report_id = str(uuid.uuid4())
    report_doc = {
        "id": report_id,
        "type": "reels_interaction_debug",
        "user_id": user["id"],
        "user_email": user.get("email"),
        "stress_session_id": payload.stress_session_id,
        "stats": payload.stats,
        "hit_rate_history": payload.hit_rate_history,
        "total_captures": payload.total_captures,
        "captures": payload.captures,
        "created_at": now,
    }

    await db.debug_session_reports.insert_one(report_doc)
    return {
        "message": "Debug session report stored",
        "report_id": report_id,
        "created_at": now.isoformat(),
    }


@api_router.post("/videos/{video_id}/like")
async def like_video(video_id: str, user: dict = Depends(get_current_user)):
    video = await db.videos.find_one({"id": video_id})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    user_id = user["id"]
    await enforce_upload_rate_limit(
        user_id, "video_like", max_requests=60, window_seconds=60
    )

    # Serialize toggles per user+reel to avoid rapid-click flip races.
    lock = _get_interaction_lock(f"like:{user_id}:{video_id}")
    async with lock:
        removed = await db.likes.find_one_and_delete(
            {"user_id": user_id, "reel_id": video_id}
        )
        if removed:
            await db.videos.update_one(
                {"id": video_id, "likes": {"$gt": 0}}, {"$inc": {"likes": -1}}
            )
            updated = await db.videos.find_one({"id": video_id}, {"_id": 0, "likes": 1})
            return {
                "message": "Video unliked",
                "liked": False,
                "likes": updated.get("likes", 0) if updated else 0,
            }

        try:
            await db.likes.insert_one(
                {
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "reel_id": video_id,
                    "created_at": datetime.now(timezone.utc),
                }
            )
            await db.videos.update_one({"id": video_id}, {"$inc": {"likes": 1}})
        except DuplicateKeyError:
            pass

        updated = await db.videos.find_one({"id": video_id}, {"_id": 0, "likes": 1})
        return {
            "message": "Video liked",
            "liked": True,
            "likes": updated.get("likes", 0) if updated else 0,
        }


@api_router.post("/videos/{video_id}/save")
async def save_video(video_id: str, user: dict = Depends(get_current_user)):
    await enforce_upload_rate_limit(
        user["id"], "video_save", max_requests=80, window_seconds=60
    )

    video = await db.videos.find_one({"id": video_id})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    await db.users.update_one(
        {"id": user["id"]}, {"$addToSet": {"saved_reels": video_id}}
    )
    await db.videos.update_one({"id": video_id}, {"$inc": {"saves": 1}})

    return {"message": "Video saved"}


@api_router.delete("/videos/{video_id}/save")
async def unsave_video(video_id: str, user: dict = Depends(get_current_user)):
    await enforce_upload_rate_limit(
        user["id"], "video_unsave", max_requests=80, window_seconds=60
    )
    await db.users.update_one({"id": user["id"]}, {"$pull": {"saved_reels": video_id}})
    return {"message": "Video unsaved"}


# ============ COMMENTS ROUTES ============
class CommentCreate(BaseModel):
    comment: str = Field(..., min_length=1, max_length=1000)


@api_router.get("/videos/{video_id}/comments")
async def get_video_comments(video_id: str, page: int = 1, limit: int = 50):
    skip = (page - 1) * limit
    comments = (
        await db.comments.find({"video_id": video_id}, {"_id": 0})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )

    user_ids = list(
        {comment.get("user_id") for comment in comments if comment.get("user_id")}
    )
    user_map: Dict[str, Dict[str, Any]] = {}
    if user_ids:
        users = await db.users.find(
            {"id": {"$in": user_ids}},
            {"_id": 0, "id": 1, "profile_image": 1},
        ).to_list(len(user_ids))
        user_map = {item.get("id"): item for item in users if item.get("id")}

    for comment in comments:
        if not comment.get("user_profile_image"):
            comment["user_profile_image"] = (
                user_map.get(comment.get("user_id")) or {}
            ).get("profile_image", "")

    return {"comments": comments, "page": page}


@api_router.post("/videos/{video_id}/comments")
async def add_video_comment(
    video_id: str, comment_data: CommentCreate, user: dict = Depends(get_current_user)
):
    video = await db.videos.find_one({"id": video_id})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    comment = {
        "id": str(uuid.uuid4()),
        "video_id": video_id,
        "user_id": user["id"],
        "user_name": user["name"],
        "user_profile_image": user.get("profile_image", ""),
        "comment": comment_data.comment,
        "likes": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.comments.insert_one(comment)
    updated_video = await db.videos.find_one_and_update(
        {"id": video_id},
        {"$inc": {"comments_count": 1}},
        projection={"_id": 0, "comments_count": 1},
        return_document=ReturnDocument.AFTER,
    )

    # Notify video owner
    if video.get("owner_id") != user["id"]:
        notification = {
            "id": str(uuid.uuid4()),
            "user_id": video["owner_id"],
            "type": "new_comment",
            "title": "New Comment",
            "message": f"{user['name']} commented on your reel",
            "data": {"video_id": video_id, "comment_id": comment["id"]},
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.notifications.insert_one(notification)

    return {
        "message": "Comment added",
        "comment": {k: v for k, v in comment.items() if k != "_id"},
        "comments_count": int((updated_video or {}).get("comments_count", 0)),
    }


@api_router.delete("/videos/{video_id}/comments/{comment_id}")
async def delete_video_comment(
    video_id: str, comment_id: str, user: dict = Depends(get_current_user)
):
    comment = await db.comments.find_one({"id": comment_id, "video_id": video_id})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if comment["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    await db.comments.delete_one({"id": comment_id})
    updated_video = await db.videos.find_one_and_update(
        {"id": video_id},
        {"$inc": {"comments_count": -1}},
        projection={"_id": 0, "comments_count": 1},
        return_document=ReturnDocument.AFTER,
    )

    return {
        "message": "Comment deleted",
        "comments_count": max(0, int((updated_video or {}).get("comments_count", 0))),
    }


@api_router.post("/videos/{video_id}/view")
async def record_video_view(
    video_id: str,
    request: Request,
    user: Optional[dict] = Depends(get_optional_current_user),
):
    video = await db.videos.find_one({"id": video_id}, {"_id": 0, "id": 1})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # Count at most one view per viewer+reel, where viewer is user_id or IP fallback.
    now = datetime.now(timezone.utc)
    viewer_ip = request.client.host if request.client else "anon"
    viewer_user_id = user["id"] if user else None
    viewer_key = viewer_user_id or f"ip:{viewer_ip}"

    try:
        # High-concurrency idempotent view write without exception-heavy duplicate inserts.
        view_write = await db.views.update_one(
            {"viewer_key": viewer_key, "reel_id": video_id},
            {
                "$setOnInsert": {
                    "id": str(uuid.uuid4()),
                    "reel_id": video_id,
                    "user_id": viewer_user_id,
                    "ip": viewer_ip,
                    "viewer_key": viewer_key,
                    "created_at": now,
                }
            },
            upsert=True,
        )
        counted = bool(view_write.upserted_id)
        if counted:
            await db.videos.update_one({"id": video_id}, {"$inc": {"views": 1}})
        return {"message": "View recorded", "counted": counted}
    except Exception as e:
        logger.warning(f"View tracking degraded for reel {video_id}: {e}")
        # Fail-open so playback UX never breaks under load.
        return {"message": "View accepted", "counted": False}


@api_router.post("/videos/{video_id}/share")
async def share_video(video_id: str, user: dict = Depends(get_current_user)):
    video = await db.videos.find_one({"id": video_id}, {"_id": 0, "id": 1})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    user_id = user["id"]
    await enforce_upload_rate_limit(
        user_id, "video_share", max_requests=40, window_seconds=60
    )
    shared_now = False
    try:
        await db.shares.insert_one(
            {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "reel_id": video_id,
                "created_at": datetime.now(timezone.utc),
            }
        )
        await db.videos.update_one({"id": video_id}, {"$inc": {"shares": 1}})
        shared_now = True
    except DuplicateKeyError:
        # Already counted this user's share for this reel.
        shared_now = False

    updated = await db.videos.find_one({"id": video_id}, {"_id": 0, "shares": 1})
    return {
        "message": "Share tracked" if shared_now else "Share already tracked",
        "shared": True,
        "counted": shared_now,
        "shares": updated.get("shares", 0) if updated else 0,
    }


@api_router.patch("/videos/{video_id}/hide")
async def hide_reel(video_id: str, user: dict = Depends(get_current_user)):
    """Hide/unhide a reel. Owner can hide their own, admin can hide any."""
    video = await db.videos.find_one({"id": video_id})
    if not video:
        raise HTTPException(status_code=404, detail="Reel not found")

    # Check authorization: owner of reel or admin
    is_owner = video.get("owner_id") == user["id"]
    is_admin = user.get("role") == UserRole.ADMIN

    if not (is_owner or is_admin):
        raise HTTPException(status_code=403, detail="Not authorized to hide this reel")

    is_hidden = video.get("hidden", False)
    await db.videos.update_one({"id": video_id}, {"$set": {"hidden": not is_hidden}})

    return {
        "message": f"Reel {'unhidden' if is_hidden else 'hidden'} successfully",
        "hidden": not is_hidden,
        "video_id": video_id,
    }


@api_router.delete("/videos/{video_id}")
async def delete_reel(video_id: str, user: dict = Depends(get_current_user)):
    """Delete a reel. Owner can delete their own, admin can delete any."""
    video = await db.videos.find_one({"id": video_id})
    if not video:
        raise HTTPException(status_code=404, detail="Reel not found")

    # Check authorization: owner of reel or admin
    is_owner = video.get("owner_id") == user["id"]
    is_admin = user.get("role") == UserRole.ADMIN

    if not (is_owner or is_admin):
        raise HTTPException(
            status_code=403, detail="Not authorized to delete this reel"
        )

    # Delete the video
    await db.videos.delete_one({"id": video_id})

    # Remove from user's videos if applicable
    if is_owner:
        await db.users.update_one({"id": user["id"]}, {"$pull": {"videos": video_id}})

    return {"message": "Reel deleted successfully", "video_id": video_id}


# ============ USER FOLLOW ROUTES ============
@api_router.get("/users/{user_id}")
async def get_user_profile(
    user_id: str, current_user: Optional[dict] = Depends(get_optional_current_user)
):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get followers/following count
    followers_count = await db.follows.count_documents({"following_id": user_id})
    following_count = await db.follows.count_documents({"follower_id": user_id})

    # Get user's reels
    reels = (
        await db.videos.find({"owner_id": user_id}, {"_id": 0})
        .sort("created_at", -1)
        .limit(20)
        .to_list(20)
    )

    is_following = False
    if current_user and current_user.get("id") != user_id:
        is_following = bool(
            await db.follows.find_one(
                {"follower_id": current_user["id"], "following_id": user_id},
                {"_id": 0, "id": 1},
            )
        )

    return {
        **user,
        "followers_count": followers_count,
        "following_count": following_count,
        "reels": reels,
        "is_following": is_following,
    }


@api_router.post("/users/{user_id}/follow")
async def follow_user(user_id: str, user: dict = Depends(get_current_user)):
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")

    target_user = await db.users.find_one({"id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    follower_id = user["id"]
    await enforce_upload_rate_limit(
        follower_id, "user_follow", max_requests=30, window_seconds=60
    )

    # Serialize toggles per follower+following pair.
    lock = _get_interaction_lock(f"follow:{follower_id}:{user_id}")
    async with lock:
        removed = await db.follows.find_one_and_delete(
            {
                "follower_id": follower_id,
                "following_id": user_id,
            }
        )
        if removed:
            await db.users.update_one(
                {"id": follower_id, "following_count": {"$gt": 0}},
                {"$inc": {"following_count": -1}},
            )
            await db.users.update_one(
                {"id": user_id, "followers_count": {"$gt": 0}},
                {"$inc": {"followers_count": -1}},
            )
            updated = await db.users.find_one(
                {"id": user_id}, {"_id": 0, "followers_count": 1}
            )
            return {
                "message": "Unfollowed successfully",
                "following": False,
                "followers_count": updated.get("followers_count", 0) if updated else 0,
            }

        created_follow = False
        try:
            await db.follows.insert_one(
                {
                    "id": str(uuid.uuid4()),
                    "follower_id": follower_id,
                    "following_id": user_id,
                    "created_at": datetime.now(timezone.utc),
                }
            )
            await db.users.update_one(
                {"id": follower_id}, {"$inc": {"following_count": 1}}
            )
            await db.users.update_one({"id": user_id}, {"$inc": {"followers_count": 1}})
            created_follow = True
        except DuplicateKeyError:
            pass

        updated = await db.users.find_one(
            {"id": user_id}, {"_id": 0, "followers_count": 1}
        )

    if created_follow:
        notification = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "type": "new_follower",
            "title": "New Follower",
            "message": f"{user['name']} started following you",
            "data": {"follower_id": follower_id},
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.notifications.insert_one(notification)

    return {
        "message": "Following successfully",
        "following": True,
        "followers_count": updated.get("followers_count", 0) if updated else 0,
    }


@api_router.post("/users/{user_id}/follow/toggle")
async def toggle_follow_user(user_id: str, user: dict = Depends(get_current_user)):
    # Explicit toggle alias for client clarity.
    return await follow_user(user_id, user)


@api_router.delete("/users/{user_id}/follow")
async def unfollow_user(user_id: str, user: dict = Depends(get_current_user)):
    await enforce_upload_rate_limit(
        user["id"], "user_unfollow", max_requests=30, window_seconds=60
    )
    removed = await db.follows.find_one_and_delete(
        {"follower_id": user["id"], "following_id": user_id}
    )
    if removed:
        await db.users.update_one(
            {"id": user["id"], "following_count": {"$gt": 0}},
            {"$inc": {"following_count": -1}},
        )
        await db.users.update_one(
            {"id": user_id, "followers_count": {"$gt": 0}},
            {"$inc": {"followers_count": -1}},
        )
    return {"message": "Unfollowed successfully", "following": False}


@api_router.get("/users/{user_id}/followers")
async def get_followers(user_id: str, page: int = 1, limit: int = 20):
    skip = (page - 1) * limit
    follows = (
        await db.follows.find({"following_id": user_id}, {"_id": 0, "follower_id": 1})
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )
    follower_ids = [f.get("follower_id") for f in follows if f.get("follower_id")]
    if not follower_ids:
        return {"followers": [], "page": page}

    users = await db.users.find(
        {"id": {"$in": follower_ids}}, {"_id": 0, "name": 1, "id": 1}
    ).to_list(len(follower_ids))
    user_map = {u["id"]: u for u in users}
    followers = [user_map[fid] for fid in follower_ids if fid in user_map]

    return {"followers": followers, "page": page}


@api_router.get("/users/{user_id}/following")
async def get_following(user_id: str, page: int = 1, limit: int = 20):
    skip = (page - 1) * limit
    follows = (
        await db.follows.find({"follower_id": user_id}, {"_id": 0, "following_id": 1})
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )
    following_ids = [f.get("following_id") for f in follows if f.get("following_id")]
    if not following_ids:
        return {"following": [], "page": page}

    users = await db.users.find(
        {"id": {"$in": following_ids}}, {"_id": 0, "name": 1, "id": 1}
    ).to_list(len(following_ids))
    user_map = {u["id"]: u for u in users}
    following = [user_map[uid] for uid in following_ids if uid in user_map]

    return {"following": following, "page": page}


# ============ MESSAGING ROUTES ============
CHAT_BLOCKED_WORDS = [
    "call me",
    "whatsapp",
    "phone",
    "number",
    "contact me",
    "@gmail",
    "@yahoo",
    "@outlook",
    "+91",
]
CHAT_PHONE_PATTERN = re.compile(r"(?:\+?\d[\s-]*){10,}")
CHAT_EMAIL_PATTERN = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.IGNORECASE)


def is_blocked(message: str) -> bool:
    lowered = str(message or "").lower()
    return any(word in lowered for word in CHAT_BLOCKED_WORDS)


def detect_blocked_chat_content(content: str) -> Optional[str]:
    text = str(content or "").strip()
    if not text:
        return None

    if is_blocked(text):
        return "Blocked content: contact details are not allowed"

    if CHAT_PHONE_PATTERN.search(text):
        return "Phone numbers are not allowed in chat messages."

    if CHAT_EMAIL_PATTERN.search(text):
        return "Email addresses are not allowed in chat messages."

    return None


@api_router.post("/messages")
async def send_message(message: MessageCreate, user: dict = Depends(get_current_user)):
    message_persisted = False
    message_id = None
    conversation_id = None
    try:
        await enforce_message_rate_limit(user["id"], max_requests=1, window_seconds=1)

        normalized_receiver_id = str(message.receiver_id or "").strip()
        normalized_listing_id = str(message.listing_id or "").strip() or None
        raw_content = (
            message.content if message.content is not None else message.message
        )
        normalized_content = str(raw_content or "").strip()

        if not normalized_receiver_id or not normalized_content:
            raise HTTPException(status_code=400, detail="Invalid message data")
        if normalized_receiver_id == user["id"]:
            raise HTTPException(
                status_code=400, detail="Cannot send message to yourself"
            )

        blocked_reason = detect_blocked_chat_content(normalized_content)
        if blocked_reason:
            raise HTTPException(status_code=400, detail=blocked_reason)

        receiver = await db.users.find_one({"id": normalized_receiver_id})
        if not receiver:
            raise HTTPException(status_code=404, detail="Receiver not found")

        # Fetch listing info for notification context
        listing_info = None
        listing_owner_id = None
        if normalized_listing_id:
            listing_info = await db.listings.find_one(
                {"id": normalized_listing_id},
                {"_id": 0, "id": 1, "owner_id": 1, "title": 1},
            )
            if listing_info:
                listing_owner_id = listing_info.get("owner_id")

        # Find or create conversation
        participants_query = {
            "$or": [
                {
                    "participants": {
                        "$all": [user["id"], normalized_receiver_id],
                        "$size": 2,
                    }
                },
                {"users": {"$all": [user["id"], normalized_receiver_id], "$size": 2}},
            ]
        }

        if normalized_listing_id:
            conversation = await db.conversations.find_one(
                {
                    **participants_query,
                    "listing_id": normalized_listing_id,
                }
            )
            if not conversation:
                # Fallback: same participants, any listing
                conversation = await db.conversations.find_one(participants_query)
        else:
            conversation = await db.conversations.find_one(participants_query)

        if not conversation:
            conversation_id = str(uuid.uuid4())
            listing_title = listing_info.get("title") if listing_info else None
            try:
                upsert_filter = (
                    {**participants_query, "listing_id": normalized_listing_id}
                    if normalized_listing_id
                    else participants_query
                )
                await db.conversations.update_one(
                    upsert_filter,
                    {
                        "$setOnInsert": {
                            "id": conversation_id,
                            "participants": [user["id"], normalized_receiver_id],
                            "users": [user["id"], normalized_receiver_id],
                            "listing_id": normalized_listing_id,
                            "listing_title": listing_title,
                            "created_at": datetime.now(timezone.utc).isoformat(),
                        }
                    },
                    upsert=True,
                )
            except Exception:
                # Another request may have inserted the same conversation concurrently.
                logger.warning(
                    "Conversation upsert raced for sender=%s receiver=%s",
                    user.get("id"),
                    normalized_receiver_id,
                    exc_info=True,
                )

            if normalized_listing_id:
                conversation = await db.conversations.find_one(
                    {
                        **participants_query,
                        "listing_id": normalized_listing_id,
                    }
                )
                if not conversation:
                    conversation = await db.conversations.find_one(participants_query)
            else:
                conversation = await db.conversations.find_one(participants_query)
            if conversation:
                conversation_id = conversation.get("id") or conversation_id
        else:
            conversation_id = conversation["id"]

        # Save message
        message_id = str(uuid.uuid4())
        now_iso = datetime.now(timezone.utc).isoformat()

        message_doc = {
            "id": message_id,
            "conversation_id": conversation_id,
            "sender_id": user["id"],
            "user_id": user["id"],
            "sender_name": user.get("name", "User"),
            "receiver_id": normalized_receiver_id,
            "owner_id": listing_owner_id or normalized_receiver_id,
            "content": normalized_content,
            "message": normalized_content,
            "media_url": message.media_url,
            "listing_id": normalized_listing_id,
            "read": False,
            "is_read": False,
            "seen": False,
            "created_at": now_iso,
        }

        await db.messages.insert_one(message_doc)
        message_doc.pop("_id", None)
        message_persisted = True

        try:
            await sio.emit(
                "new_message", message_doc, room=f"conversation_{conversation_id}"
            )
        except Exception:
            logger.warning(
                "Failed to emit new_message for conversation %s",
                conversation_id,
                exc_info=True,
            )

        # Update conversation sidebar
        listing_title = listing_info.get("title") if listing_info else None
        try:
            await db.conversations.update_one(
                {"id": conversation_id},
                {
                    "$set": {
                        "last_message": normalized_content,
                        "last_message_at": now_iso,
                        "listing_id": normalized_listing_id,
                        "listing_title": listing_title,
                    }
                },
            )
        except Exception:
            logger.warning(
                "Failed to update conversation summary %s",
                conversation_id,
                exc_info=True,
            )

        # Build rich notification for receiver
        listing_title_str = listing_info.get("title", "") if listing_info else ""
        notif_title = f"New message from {user.get('name', 'User')}"
        notif_body = normalized_content[:100] + (
            "..." if len(normalized_content) > 100 else ""
        )
        if listing_title_str:
            notif_title = f"{user.get('name', 'User')} about: {listing_title_str[:40]}"

        try:
            await send_notification(
                normalized_receiver_id,
                "chat",
                notif_title,
                notif_body,
                {
                    "message_id": message_id,
                    "conversation_id": conversation_id,
                    "listing_id": normalized_listing_id,
                    "sender_id": user["id"],
                    "receiver_id": normalized_receiver_id,
                    "listing_title": listing_title_str,
                },
            )
        except Exception:
            logger.warning(
                "Chat notification pipeline failed for receiver %s",
                normalized_receiver_id,
                exc_info=True,
            )

        # Legacy websocket compat is best-effort only.
        try:
            await manager.send_personal_message(
                {"type": "new_message", "message": message_doc},
                normalized_receiver_id,
            )
        except Exception:
            logger.warning(
                "Failed legacy websocket fanout for %s",
                normalized_receiver_id,
                exc_info=True,
            )

        # Auto-reply
        if receiver.get("auto_reply_enabled") and receiver.get("auto_reply_message"):
            try:
                auto_id = str(uuid.uuid4())
                auto_doc = {
                    "id": auto_id,
                    "conversation_id": conversation_id,
                    "sender_id": normalized_receiver_id,
                    "sender_name": receiver.get("name", "Owner"),
                    "receiver_id": user["id"],
                    "content": receiver["auto_reply_message"],
                    "message": receiver["auto_reply_message"],
                    "is_auto_reply": True,
                    "listing_id": normalized_listing_id,
                    "read": False,
                    "seen": False,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
                await db.messages.insert_one(auto_doc)

                try:
                    await sio.emit(
                        "new_message", auto_doc, room=f"conversation_{conversation_id}"
                    )
                except Exception:
                    logger.warning(
                        "Failed to emit auto-reply new_message for %s",
                        conversation_id,
                        exc_info=True,
                    )

                # Notify sender about auto-reply
                try:
                    await send_notification(
                        user["id"],
                        "chat",
                        f"Auto-reply from {receiver.get('name', 'Owner')}",
                        receiver["auto_reply_message"][:100],
                        {
                            "conversation_id": conversation_id,
                            "listing_id": normalized_listing_id,
                            "sender_id": normalized_receiver_id,
                        },
                    )
                except Exception:
                    logger.warning(
                        "Failed to send auto-reply notification for %s",
                        user["id"],
                        exc_info=True,
                    )
            except Exception:
                logger.warning(
                    "Auto-reply pipeline failed for conversation %s",
                    conversation_id,
                    exc_info=True,
                )

        return {
            "message": "Message sent",
            "message_id": message_id,
            "conversation_id": conversation_id,
        }

    except HTTPException:
        raise
    except Exception as e:
        if message_persisted:
            logger.error(
                "MESSAGE DEGRADED SUCCESS sender=%s receiver=%s listing=%s conversation=%s message_id=%s err=%s",
                user.get("id"),
                getattr(message, "receiver_id", None),
                getattr(message, "listing_id", None),
                conversation_id,
                message_id,
                str(e),
            )
            return {
                "message": "Message sent",
                "message_id": message_id,
                "conversation_id": conversation_id,
                "degraded": True,
            }

        # Final fallback: attempt a minimal durable write path when primary
        # flow fails before persistence (for production resilience).
        sender_id = str(user.get("id") or "").strip()
        fallback_receiver_id = str(getattr(message, "receiver_id", "") or "").strip()
        fallback_raw_content = getattr(message, "content", None)
        if fallback_raw_content is None:
            fallback_raw_content = getattr(message, "message", None)
        fallback_content = str(fallback_raw_content or "").strip()
        fallback_listing_id = (
            str(getattr(message, "listing_id", "") or "").strip() or None
        )

        if (
            sender_id
            and fallback_receiver_id
            and fallback_content
            and fallback_receiver_id != sender_id
        ):
            try:
                fallback_participants_query = {
                    "$or": [
                        {
                            "participants": {
                                "$all": [sender_id, fallback_receiver_id],
                                "$size": 2,
                            }
                        },
                        {
                            "users": {
                                "$all": [sender_id, fallback_receiver_id],
                                "$size": 2,
                            }
                        },
                    ]
                }

                if fallback_listing_id:
                    fallback_conv = await db.conversations.find_one(
                        {
                            **fallback_participants_query,
                            "listing_id": fallback_listing_id,
                        }
                    )
                    if not fallback_conv:
                        fallback_conv = await db.conversations.find_one(
                            fallback_participants_query
                        )
                else:
                    fallback_conv = await db.conversations.find_one(
                        fallback_participants_query
                    )

                fallback_conversation_id = None
                if fallback_conv:
                    fallback_conversation_id = str(
                        fallback_conv.get("id") or ""
                    ).strip() or str(uuid.uuid4())
                else:
                    fallback_conversation_id = str(uuid.uuid4())
                    await db.conversations.insert_one(
                        {
                            "id": fallback_conversation_id,
                            "participants": [sender_id, fallback_receiver_id],
                            "users": [sender_id, fallback_receiver_id],
                            "listing_id": fallback_listing_id,
                            "created_at": datetime.now(timezone.utc).isoformat(),
                        }
                    )

                fallback_message_id = str(uuid.uuid4())
                fallback_now_iso = datetime.now(timezone.utc).isoformat()
                await db.messages.insert_one(
                    {
                        "id": fallback_message_id,
                        "conversation_id": fallback_conversation_id,
                        "sender_id": sender_id,
                        "user_id": sender_id,
                        "receiver_id": fallback_receiver_id,
                        "owner_id": fallback_receiver_id,
                        "content": fallback_content,
                        "message": fallback_content,
                        "listing_id": fallback_listing_id,
                        "read": False,
                        "is_read": False,
                        "seen": False,
                        "created_at": fallback_now_iso,
                    }
                )

                logger.error(
                    "MESSAGE FALLBACK SUCCESS sender=%s receiver=%s listing=%s conversation=%s message_id=%s primary_err=%s",
                    sender_id,
                    fallback_receiver_id,
                    fallback_listing_id,
                    fallback_conversation_id,
                    fallback_message_id,
                    str(e),
                )
                return {
                    "message": "Message sent",
                    "message_id": fallback_message_id,
                    "conversation_id": fallback_conversation_id,
                    "degraded": True,
                    "fallback_mode": "minimal",
                }
            except Exception as fallback_error:
                logger.exception(
                    "MESSAGE FALLBACK FAILED sender=%s receiver=%s listing=%s primary_err=%s fallback_err=%s",
                    sender_id,
                    fallback_receiver_id,
                    fallback_listing_id,
                    str(e),
                    str(fallback_error),
                )

        logger.error(
            "MESSAGE ERROR sender=%s receiver=%s listing=%s err=%s",
            user.get("id"),
            getattr(message, "receiver_id", None),
            getattr(message, "listing_id", None),
            str(e),
        )
        logger.exception(
            f"send_message failed sender={user.get('id')} receiver={getattr(message, 'receiver_id', None)}: {e}"
        )
        raise HTTPException(status_code=500, detail="Failed to send message")


@api_router.get("/notifications/unread-count")
async def get_unread_count(user: dict = Depends(get_current_user)):
    """Lightweight endpoint — just the unread count. No body. Suitable for 10-second polling."""
    count = await db.notifications.count_documents(
        {
            "user_id": user["id"],
            "$or": [{"read": False}, {"is_read": False}],
        }
    )
    return {"unread_count": count}


@api_router.get("/messages/conversations")
async def get_conversations(user: dict = Depends(get_current_user)):
    conversations = (
        await db.conversations.find(
            {"$or": [{"participants": user["id"]}, {"users": user["id"]}]}, {"_id": 0}
        )
        .sort("last_message_at", -1)
        .to_list(100)
    )

    enriched = []
    for conv in conversations:
        members = conv.get("participants") or conv.get("users") or []
        others = [p for p in members if p != user["id"]]
        other_id = others[0] if others else None
        if not other_id:
            enriched.append(conv)
            continue

        other_user = await db.users.find_one(
            {"id": other_id}, {"_id": 0, "name": 1, "id": 1, "profile_image": 1}
        )
        conv["other_user"] = other_user

        # Unread count scoped to this conversation
        unread = await db.messages.count_documents(
            {
                "conversation_id": conv["id"],
                "receiver_id": user["id"],
                "read": False,
            }
        )
        conv["unread_count"] = unread

        # Fetch listing title if not stored
        if conv.get("listing_id") and not conv.get("listing_title"):
            listing_ref = await db.listings.find_one(
                {"id": conv["listing_id"]}, {"_id": 0, "title": 1}
            )
            conv["listing_title"] = (listing_ref or {}).get("title")

        enriched.append(conv)

    return {"conversations": enriched}


@api_router.get("/messages/conversation/{conversation_id}")
async def get_conversation_messages(
    conversation_id: str,
    user: dict = Depends(get_current_user),
    page: int = 1,
    limit: int = 50,
):
    conversation = await db.conversations.find_one({"id": conversation_id})
    members = (
        []
        if not conversation
        else (conversation.get("participants") or conversation.get("users") or [])
    )
    if not conversation or user["id"] not in members:
        raise HTTPException(status_code=403, detail="Not authorized")

    skip = (page - 1) * limit
    messages = (
        await db.messages.find({"conversation_id": conversation_id}, {"_id": 0})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )

    # Mark as read
    read_result = await db.messages.update_many(
        {"conversation_id": conversation_id, "receiver_id": user["id"], "read": False},
        {"$set": {"read": True, "seen": True}},
    )

    if read_result.modified_count:
        await sio.emit(
            "messages_seen",
            {
                "conversation_id": conversation_id,
                "seen_by": user["id"],
                "seen_at": datetime.now(timezone.utc).isoformat(),
            },
            room=f"conversation_{conversation_id}",
        )

    return {"messages": messages[::-1], "page": page}


@api_router.get("/messages/{listing_id}")
async def get_listing_messages(
    listing_id: str,
    user_id: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    requested_user_id = str(user_id or user["id"]).strip()
    if requested_user_id != user["id"]:
        raise HTTPException(
            status_code=403, detail="Cannot read messages for another user"
        )

    messages = (
        await db.messages.find(
            {
                "listing_id": listing_id,
                "$or": [
                    {"sender_id": requested_user_id},
                    {"receiver_id": requested_user_id},
                ],
            },
            {"_id": 0},
        )
        .sort("created_at", 1)
        .to_list(500)
    )

    return messages


# ============ NOTIFICATIONS ROUTES ============
@api_router.get("/notifications")
async def get_notifications(
    user: dict = Depends(get_current_user), page: int = 1, limit: int = 20
):
    skip = (page - 1) * limit
    notifications = (
        await db.notifications.find({"user_id": user["id"]}, {"_id": 0})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )

    for item in notifications:
        is_read = bool(item.get("read", item.get("is_read", False)))
        item["read"] = is_read
        item["is_read"] = is_read

    unread_count = await db.notifications.count_documents(
        {
            "user_id": user["id"],
            "$or": [{"read": False}, {"is_read": False}],
        }
    )

    return {"notifications": notifications, "unread_count": unread_count, "page": page}


@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str, user: dict = Depends(get_current_user)
):
    await db.notifications.update_one(
        {"id": notification_id, "user_id": user["id"]},
        {"$set": {"read": True, "is_read": True}},
    )
    return {"message": "Notification marked as read"}


@api_router.put("/notifications/read-all")
async def mark_all_notifications_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many(
        {"user_id": user["id"], "$or": [{"read": False}, {"is_read": False}]},
        {"$set": {"read": True, "is_read": True}},
    )
    return {"message": "All notifications marked as read"}


@api_router.get("/notifications/{user_id}")
async def get_notifications_by_user_id(
    user_id: str, user: dict = Depends(get_current_user), limit: int = 50
):
    if str(user_id) != str(user.get("id")):
        raise HTTPException(
            status_code=403, detail="Cannot read another user's notifications"
        )

    notifications = (
        await db.notifications.find({"user_id": user["id"]}, {"_id": 0})
        .sort("created_at", -1)
        .limit(limit)
        .to_list(limit)
    )

    for item in notifications:
        is_read = bool(item.get("read", item.get("is_read", False)))
        item["read"] = is_read
        item["is_read"] = is_read

    return notifications


@api_router.post("/notifications/read")
async def mark_notifications_read_compat(
    payload: Dict[str, Any], user: dict = Depends(get_current_user)
):
    target_user_id = str(payload.get("user_id") or user["id"]).strip()
    if target_user_id != user["id"]:
        raise HTTPException(
            status_code=403, detail="Cannot update another user's notifications"
        )

    notification_id = str(payload.get("notification_id") or "").strip()
    if notification_id:
        await db.notifications.update_one(
            {"id": notification_id, "user_id": user["id"]},
            {"$set": {"read": True, "is_read": True}},
        )
        return {"success": True}

    await db.notifications.update_many(
        {"user_id": user["id"], "$or": [{"read": False}, {"is_read": False}]},
        {"$set": {"read": True, "is_read": True}},
    )
    return {"success": True}


# ============ AI CHATBOT ROUTE ============
@api_router.post("/chat")
async def chat_with_bot(msg: ChatMessage, user: dict = Depends(get_current_user)):
    try:
        try:
            chat_module = importlib.import_module("emergentintegrations.llm.chat")
            LlmChat = chat_module.LlmChat
            UserMessage = chat_module.UserMessage
        except ImportError:
            return {"response": "Chatbot is temporarily unavailable."}

        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            return {"response": "Chatbot is not configured. Please contact support."}

        chat = LlmChat(
            api_key=api_key,
            session_id=f"gharsetu-{user['id']}",
            system_message="""You are GharSetu AI Assistant - an intelligent property and services helper for Gujarat, India.

You can help users with:
🏠 HOME: Find flats (1-4 BHK), houses, villas, penthouses, farmhouses, PG/hostels
🏢 BUSINESS: Shops, offices, warehouses, showrooms, co-working spaces, restaurants
🏨 STAY: Hotels, guest houses, PG accommodation, resorts
🎉 EVENTS: Party plots, marriage halls, banquet halls, conference venues
🔧 SERVICES: Plumbers, electricians, painters, cleaners, AC repair, pest control

Features you can explain:
- Property search and filters
- Price negotiation system
- Booking and scheduling visits
- GharSetu Reels (property videos)
- Map-based search
- Price history and trends

Be helpful, concise, and provide specific suggestions. Respond in user's language (Gujarati/Hindi/English).
When suggesting properties, ask about: location, budget, property type, and specific requirements.""",
        ).with_model("openai", "gpt-4.1")

        # Always use text-only mode to prevent image input issues
        user_message = UserMessage(text=msg.message)
        response = await chat.send_message(user_message)

        # Save to search history
        await db.users.update_one(
            {"id": user["id"]},
            {
                "$push": {
                    "search_history": {
                        "query": msg.message,
                        "date": datetime.now(timezone.utc).isoformat(),
                    }
                }
            },
        )

        return {"response": response}
    except Exception as e:
        logger.error(f"Chatbot error: {str(e)}")
        error_msg = str(e).lower()
        if (
            "image" in error_msg
            or "vision" in error_msg
            or "does not support" in error_msg
        ):
            return {
                "response": "Sorry, I'm not able to process images right now. Please try sending a text message instead."
            }
        return {
            "response": "માફ કરશો, હું અત્યારે જવાબ આપી શકતો નથી. કૃપયા ફરીથી પ્રયાસ કરો."
        }


@api_router.post("/chat/voice")
async def voice_search(query: str, user: dict = Depends(get_current_user)):
    normalized = normalize_search_query(query)
    city_candidates = {"surat", "ahmedabad", "vadodara", "rajkot", "gandhinagar"}
    detected_city = next(
        (t for t in normalized.get("normalized_tokens", []) if t in city_candidates),
        None,
    )

    results = await smart_search_listings(
        db,
        query=query,
        city=detected_city,
        category=normalized.get("detected_category"),
        limit=10,
    )

    now_iso = datetime.now(timezone.utc).isoformat()

    await db.users.update_one(
        {"id": user["id"]},
        {
            "$push": {
                "search_history": {
                    "$each": [{"query": query, "date": now_iso}],
                    "$slice": -50,
                }
            }
        },
    )

    await db.search_history.insert_one(
        {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "query": query,
            "normalized_query": results.get(
                "normalized_query",
                normalized.get("normalized_query", query.lower().strip()),
            ),
            "language": results.get(
                "detected_language", normalized.get("detected_language", "en")
            ),
            "city": detected_city,
            "category": results.get("detected_category"),
            "source": "voice",
            "created_at": now_iso,
        }
    )

    await db.interactions.insert_one(
        {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "listing_id": None,
            "action": "search",
            "source": "voice",
            "query": query,
            "city": detected_city,
            "category": results.get("detected_category"),
            "price": None,
            "created_at": now_iso,
        }
    )

    return {
        "query": query,
        "normalized_query": results.get("normalized_query", query),
        "detected_language": results.get("detected_language", "en"),
        "parsed": {
            "location": detected_city,
            "category": results.get("detected_category"),
        },
        "did_you_mean": results.get("did_you_mean", ""),
        "results": results.get("listings", []),
        "total": results.get("total", 0),
    }


@api_router.get("/search/smart")
async def smart_search(
    query: str = Query(..., min_length=1),
    city: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = Query(20, ge=1, le=50),
):
    return await smart_search_listings(
        db,
        query=query,
        city=city,
        category=category,
        limit=limit,
    )


@api_router.get("/search/suggest")
async def search_suggestions(
    query: str = Query(..., min_length=1),
    city: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = Query(8, ge=1, le=20),
):
    return await suggest_search_terms(
        db,
        query=query,
        city=city,
        category=category,
        limit=limit,
    )


# ============ ADMIN ROUTES ============
OWNER_ROLES = [
    UserRole.PROPERTY_OWNER.value,
    UserRole.STAY_OWNER.value,
    UserRole.SERVICE_PROVIDER.value,
    UserRole.HOTEL_OWNER.value,
    UserRole.EVENT_OWNER.value,
]


async def log_admin_action(
    admin: Dict[str, Any],
    action: str,
    target_type: str,
    target_id: str,
    meta: Optional[Dict[str, Any]] = None,
):
    await db.admin_audit_logs.insert_one(
        {
            "id": str(uuid.uuid4()),
            "action": action,
            "actor_id": admin.get("id"),
            "actor_email": admin.get("email"),
            "target_type": target_type,
            "target_id": target_id,
            "meta": meta or {},
            "created_at": datetime.now(timezone.utc),
        }
    )


async def get_cached_admin_stats() -> Optional[Dict[str, Any]]:
    if not redis_client:
        return None
    try:
        cached_payload = await redis_client.get(ADMIN_STATS_CACHE_KEY)
        if not cached_payload:
            return None
        return json.loads(cached_payload)
    except Exception:
        return None


async def set_cached_admin_stats(payload: Dict[str, Any]) -> None:
    if not redis_client:
        return
    try:
        await redis_client.set(
            ADMIN_STATS_CACHE_KEY, json.dumps(payload), ex=ADMIN_STATS_CACHE_TTL_SECONDS
        )
    except Exception:
        return


async def invalidate_admin_stats_cache() -> None:
    if not redis_client:
        return
    try:
        await redis_client.delete(ADMIN_STATS_CACHE_KEY)
    except Exception:
        return


@api_router.get("/admin/users")
async def get_all_users(
    user: dict = Depends(get_admin_user),
    role: Optional[str] = None,
    email_verified: Optional[bool] = None,
    block_status: Optional[str] = None,
    aadhar_status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    sort_by: str = "created_at",
    sort_order: str = "desc",
):
    query: Dict[str, Any] = {"deleted": {"$ne": True}}

    if role:
        query["role"] = role
    if email_verified is not None:
        query["is_email_verified"] = email_verified
    if block_status and block_status != "none":
        query["block_status"] = block_status
    elif block_status == "none":
        query["block_status"] = {"$exists": False}
    if aadhar_status:
        query["aadhar_status"] = aadhar_status
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
        ]

    sort_dir = -1 if str(sort_order).lower() == "desc" else 1
    skip = (page - 1) * limit
    users = (
        await db.users.find(
            query,
            {"_id": 0, "password": 0, "verification_token": 0},
        )
        .sort(sort_by, sort_dir)
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )

    total = await db.users.count_documents(query)

    user_ids = [u.get("id") for u in users if u.get("id")]
    listing_counts = []
    if user_ids:
        listing_counts = await db.listings.aggregate(
            [
                {"$match": {"owner_id": {"$in": user_ids}}},
                {"$group": {"_id": "$owner_id", "count": {"$sum": 1}}},
            ]
        ).to_list(len(user_ids))
    count_map = {row.get("_id"): row.get("count", 0) for row in listing_counts}

    for user_row in users:
        user_row["listing_count"] = count_map.get(user_row.get("id"), 0)

    return {
        "users": users,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
    }


@api_router.get("/admin/listings")
async def get_all_listings_admin(
    user: dict = Depends(get_admin_user),
    status: Optional[str] = None,
    category: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    query: Dict[str, Any] = {}
    if status:
        query["status"] = status
    if category:
        query["category"] = category

    skip = (page - 1) * limit
    listings = (
        await db.listings.find(query, {"_id": 0})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )
    total = await db.listings.count_documents(query)

    owner_ids = list(
        {listing.get("owner_id") for listing in listings if listing.get("owner_id")}
    )
    owners = []
    if owner_ids:
        owners = await db.users.find(
            {"id": {"$in": owner_ids}},
            {
                "_id": 0,
                "id": 1,
                "name": 1,
                "email": 1,
                "phone": 1,
                "aadhar_status": 1,
                "role": 1,
            },
        ).to_list(len(owner_ids))
    owner_map = {owner_doc.get("id"): owner_doc for owner_doc in owners}
    for listing in listings:
        listing["owner_info"] = owner_map.get(listing.get("owner_id"), {})

    return {
        "listings": listings,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
    }


@api_router.put("/admin/listings/{listing_id}/status")
async def update_listing_status(
    listing_id: str,
    status: str = Query(...),
    reason: Optional[str] = Query(None),
    user: dict = Depends(get_admin_user),
):
    listing = await db.listings.find_one({"id": listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    await db.listings.update_one(
        {"id": listing_id},
        {
            "$set": {
                "status": status,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "status_reason": reason,
                "status_updated_by": user.get("id"),
            }
        },
    )
    await invalidate_admin_stats_cache()

    await log_admin_action(
        user,
        f"listing_{status}",
        "listing",
        listing_id,
        {"reason": reason, "owner_id": listing.get("owner_id")},
    )

    status_text = str(status).capitalize()
    message = f"Your listing '{listing.get('title')}' has been {status}."
    if reason:
        message += f" Reason: {reason}"
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": listing["owner_id"],
        "type": "listing_status",
        "title": f"Listing {status_text}",
        "message": message,
        "data": {"listing_id": listing_id},
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.notifications.insert_one(notification)

    return {"message": f"Listing {status}", "listing_id": listing_id}


@api_router.put("/admin/users/{user_id}/verify-aadhar")
async def verify_user_aadhar(
    user_id: str, status: str = Query(...), user: dict = Depends(get_admin_user)
):
    # Backward-compatible route: normalize legacy boolean-like values.
    normalized_status = str(status).lower()
    if normalized_status in {"true", "1", "verified"}:
        normalized_status = VerificationStatus.VERIFIED.value
    elif normalized_status in {"false", "0", "rejected"}:
        normalized_status = VerificationStatus.REJECTED.value
    elif normalized_status == "pending":
        normalized_status = VerificationStatus.PENDING.value
    else:
        raise HTTPException(status_code=400, detail="Invalid verification status")

    owner = await db.users.find_one({"id": user_id})
    if not owner:
        raise HTTPException(status_code=404, detail="User not found")

    update: Dict[str, Any] = {
        "aadhar_status": normalized_status,
        "is_verified": normalized_status == VerificationStatus.VERIFIED.value,
        "aadhar_reviewed_by": user.get("id"),
        "aadhar_reviewed_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.update_one({"id": user_id}, {"$set": update})
    await invalidate_admin_stats_cache()

    await log_admin_action(
        user,
        f"aadhar_{normalized_status}",
        "owner",
        user_id,
        {"aadhar_number_last4": str(owner.get("aadhar_number", ""))[-4:]},
    )

    await db.notifications.insert_one(
        {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "type": "admin_message",
            "title": "Aadhar Verification Updated",
            "message": f"Your Aadhar verification status is now '{normalized_status}'.",
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )

    return {"message": f"Aadhar verification status updated to {normalized_status}"}


@api_router.post("/admin/users/{user_id}/verify-email")
async def admin_verify_email(user_id: str, admin: dict = Depends(get_admin_user)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await db.users.update_one(
        {"id": user_id},
        {
            "$set": {
                "is_email_verified": True,
                "is_verified": True,
                "email_verified_by": "admin",
                "email_verified_at": datetime.now(timezone.utc).isoformat(),
            },
            "$unset": {"verification_token": ""},
        },
    )
    await invalidate_admin_stats_cache()

    await log_admin_action(
        admin,
        "email_verified",
        "user",
        user_id,
        {"user_email": user.get("email")},
    )

    await db.notifications.insert_one(
        {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "type": "admin_message",
            "title": "Email Verified",
            "message": "Your email has been verified by GharSetu admin.",
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )

    return {"message": "Email verified successfully", "user_id": user_id}


@api_router.get("/admin/owners/pending")
async def get_pending_owner_registrations(
    admin: dict = Depends(get_admin_user),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    skip = (page - 1) * limit
    query = {
        "role": {"$in": OWNER_ROLES},
        "aadhar_status": VerificationStatus.PENDING.value,
        "aadhar_number": {"$exists": True},
        "deleted": {"$ne": True},
    }
    owners = (
        await db.users.find(
            query,
            {"_id": 0, "password": 0, "verification_token": 0},
        )
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )
    total = await db.users.count_documents(query)

    owner_ids = [o.get("id") for o in owners if o.get("id")]
    listing_counts = []
    if owner_ids:
        listing_counts = await db.listings.aggregate(
            [
                {"$match": {"owner_id": {"$in": owner_ids}}},
                {"$group": {"_id": "$owner_id", "count": {"$sum": 1}}},
            ]
        ).to_list(len(owner_ids))
    count_map = {row.get("_id"): row.get("count", 0) for row in listing_counts}
    for owner in owners:
        owner["listing_count"] = count_map.get(owner.get("id"), 0)

    return {
        "owners": owners,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
    }


@api_router.put("/admin/owners/{user_id}/verify-aadhar")
async def admin_verify_owner_aadhar(
    user_id: str,
    payload: AdminVerifyOwner,
    admin: dict = Depends(get_admin_user),
):
    owner = await db.users.find_one({"id": user_id})
    if not owner:
        raise HTTPException(status_code=404, detail="Owner not found")
    if not owner.get("aadhar_number"):
        raise HTTPException(status_code=400, detail="No Aadhar submitted")

    status_value = str(payload.status).lower()
    if status_value not in {
        VerificationStatus.VERIFIED.value,
        VerificationStatus.REJECTED.value,
    }:
        raise HTTPException(
            status_code=400, detail="Status must be 'verified' or 'rejected'"
        )

    update = {
        "aadhar_status": status_value,
        "is_verified": status_value == VerificationStatus.VERIFIED.value,
        "aadhar_reviewed_by": admin.get("id"),
        "aadhar_reviewed_at": datetime.now(timezone.utc).isoformat(),
    }
    if payload.rejection_reason:
        update["aadhar_rejection_reason"] = payload.rejection_reason

    await db.users.update_one({"id": user_id}, {"$set": update})
    await invalidate_admin_stats_cache()
    await log_admin_action(
        admin,
        f"aadhar_{status_value}",
        "owner",
        user_id,
        {"aadhar_number_last4": str(owner.get("aadhar_number", ""))[-4:]},
    )

    title = (
        "Aadhar Verified!"
        if status_value == VerificationStatus.VERIFIED.value
        else "Aadhar Verification Failed"
    )
    message = (
        "Your Aadhar has been verified. You can now create listings."
        if status_value == VerificationStatus.VERIFIED.value
        else f"Aadhar verification rejected. Reason: {payload.rejection_reason or 'Documents unclear'}"
    )

    await db.notifications.insert_one(
        {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "type": "admin_message",
            "title": title,
            "message": message,
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )

    return {"message": f"Owner {status_value}", "user_id": user_id}


@api_router.get("/admin/users/{user_id}/profile")
async def get_user_full_profile(user_id: str, admin: dict = Depends(get_admin_user)):
    user = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "password": 0, "verification_token": 0},
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    listings = (
        await db.listings.find({"owner_id": user_id}, {"_id": 0})
        .sort("created_at", -1)
        .limit(50)
        .to_list(50)
    )
    bookings = (
        await db.bookings.find({"user_id": user_id}, {"_id": 0})
        .sort("created_at", -1)
        .limit(20)
        .to_list(20)
    )
    logs = (
        await db.admin_audit_logs.find({"target_id": user_id}, {"_id": 0})
        .sort("created_at", -1)
        .limit(20)
        .to_list(20)
    )

    total_views = sum(int(l.get("views", 0) or 0) for l in listings)
    total_likes = sum(int(l.get("likes", 0) or 0) for l in listings)

    return {
        "user": user,
        "listings": listings,
        "bookings": bookings,
        "admin_logs": logs,
        "stats": {
            "total_listings": len(listings),
            "total_bookings": len(bookings),
            "total_views": total_views,
            "total_likes": total_likes,
        },
    }


@api_router.post("/admin/users/{user_id}/block")
async def admin_block_user(
    user_id: str,
    payload: AdminBlockUser,
    admin: dict = Depends(get_admin_user),
):
    if payload.user_id and payload.user_id != user_id:
        raise HTTPException(
            status_code=400, detail="Payload user_id does not match path user_id"
        )

    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("role") == UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Cannot block another admin")

    block_type = str(payload.block_type).lower()
    if block_type not in {"temporary", "permanent"}:
        raise HTTPException(
            status_code=400, detail="block_type must be 'temporary' or 'permanent'"
        )

    update = {
        "block_status": block_type,
        "block_reason": payload.reason,
        "blocked_by": admin.get("id"),
        "blocked_at": datetime.now(timezone.utc).isoformat(),
    }
    if block_type == "temporary":
        duration_hours = int(payload.duration_hours or 24)
        unblock_at = datetime.now(timezone.utc) + timedelta(hours=duration_hours)
        update["unblock_at"] = unblock_at.isoformat()
        update["block_duration_hours"] = duration_hours

    await db.users.update_one({"id": user_id}, {"$set": update})
    await invalidate_admin_stats_cache()
    await log_admin_action(
        admin,
        f"user_{block_type}_blocked",
        "user",
        user_id,
        {"reason": payload.reason, "duration_hours": payload.duration_hours},
    )

    await db.notifications.insert_one(
        {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "type": "admin_message",
            "title": "Account Restricted",
            "message": f"Your account has been restricted. Reason: {payload.reason}",
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )

    return {"message": f"User {block_type} blocked", "user_id": user_id}


@api_router.post("/admin/users/{user_id}/unblock")
async def admin_unblock_user(user_id: str, admin: dict = Depends(get_admin_user)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await db.users.update_one(
        {"id": user_id},
        {
            "$unset": {
                "block_status": "",
                "block_reason": "",
                "blocked_by": "",
                "blocked_at": "",
                "unblock_at": "",
                "block_duration_hours": "",
            }
        },
    )
    await invalidate_admin_stats_cache()
    await log_admin_action(admin, "user_unblocked", "user", user_id)

    await db.notifications.insert_one(
        {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "type": "admin_message",
            "title": "Account Restored",
            "message": "Your account restriction has been lifted.",
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    return {"message": "User unblocked", "user_id": user_id}


@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(
    user_id: str,
    reason: str = Query(..., min_length=1),
    admin: dict = Depends(get_admin_user),
):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("role") == UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Cannot delete another admin")

    await db.users.update_one(
        {"id": user_id},
        {
            "$set": {
                "deleted": True,
                "deleted_at": datetime.now(timezone.utc).isoformat(),
                "deleted_by": admin.get("id"),
                "delete_reason": reason,
                "email": f"deleted_{user_id[:8]}@deleted.gharsetu.com",
                "phone": "",
                "name": "[Deleted User]",
            }
        },
    )

    await db.listings.update_many(
        {"owner_id": user_id},
        {"$set": {"status": ListingStatus.REJECTED.value, "is_available": False}},
    )
    await invalidate_admin_stats_cache()
    await log_admin_action(
        admin,
        "user_deleted",
        "user",
        user_id,
        {"reason": reason, "original_email": user.get("email")},
    )

    return {"message": "User deleted (soft)", "user_id": user_id}


@api_router.delete("/admin/listings/{listing_id}")
async def admin_remove_listing(
    listing_id: str,
    reason: str = Query(..., min_length=1),
    admin: dict = Depends(get_admin_user),
):
    listing = await db.listings.find_one({"id": listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    await db.listings.update_one(
        {"id": listing_id},
        {
            "$set": {
                "status": ListingStatus.REJECTED.value,
                "is_available": False,
                "removed_by_admin": True,
                "removed_reason": reason,
                "removed_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )
    await invalidate_admin_stats_cache()
    await log_admin_action(
        admin,
        "listing_removed",
        "listing",
        listing_id,
        {"reason": reason, "owner_id": listing.get("owner_id")},
    )

    await db.notifications.insert_one(
        {
            "id": str(uuid.uuid4()),
            "user_id": listing.get("owner_id"),
            "type": "admin_message",
            "title": "Listing Removed",
            "message": f"Your listing '{listing.get('title')}' was removed. Reason: {reason}",
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    return {"message": "Listing removed", "listing_id": listing_id}


@api_router.get("/admin/listings/pending")
async def get_pending_listings(
    admin: dict = Depends(get_admin_user),
    category: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    query: Dict[str, Any] = {"status": ListingStatus.PENDING.value}
    if category:
        query["category"] = category

    skip = (page - 1) * limit
    listings = (
        await db.listings.find(query, {"_id": 0})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )
    total = await db.listings.count_documents(query)

    owner_ids = list(
        {listing.get("owner_id") for listing in listings if listing.get("owner_id")}
    )
    owners = []
    if owner_ids:
        owners = await db.users.find(
            {"id": {"$in": owner_ids}},
            {
                "_id": 0,
                "id": 1,
                "name": 1,
                "email": 1,
                "phone": 1,
                "aadhar_status": 1,
                "role": 1,
            },
        ).to_list(len(owner_ids))
    owner_map = {owner_doc.get("id"): owner_doc for owner_doc in owners}

    for listing in listings:
        listing["owner_info"] = owner_map.get(listing.get("owner_id"), {})

    return {
        "listings": listings,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
    }


@api_router.post("/admin/notifications/send")
async def admin_send_notification(
    payload: AdminSendNotification,
    admin: dict = Depends(get_admin_user),
):
    now = datetime.now(timezone.utc).isoformat()
    notification_batch_id = str(uuid.uuid4())

    if payload.target in ("all", "users", "owners"):
        if payload.target == "all":
            query: Dict[str, Any] = {"deleted": {"$ne": True}}
        elif payload.target == "users":
            query = {"role": UserRole.USER.value, "deleted": {"$ne": True}}
        else:
            query = {"role": {"$in": OWNER_ROLES}, "deleted": {"$ne": True}}

        recipients_count = 0
        bulk_docs: List[Dict[str, Any]] = []
        cursor = db.users.find(query, {"_id": 0, "id": 1})
        async for user_doc in cursor:
            recipients_count += 1
            bulk_docs.append(
                {
                    "id": str(uuid.uuid4()),
                    "batch_id": notification_batch_id,
                    "user_id": user_doc.get("id"),
                    "type": payload.type,
                    "title": payload.title,
                    "message": payload.message,
                    "sent_by_admin": admin.get("id"),
                    "read": False,
                    "created_at": now,
                }
            )
            if len(bulk_docs) >= 500:
                await db.notifications.insert_many(bulk_docs)
                bulk_docs = []

        if bulk_docs:
            await db.notifications.insert_many(bulk_docs)
    else:
        specific_user = await db.users.find_one(
            {"id": payload.target, "deleted": {"$ne": True}}
        )
        if not specific_user:
            raise HTTPException(status_code=404, detail="User not found")

        await db.notifications.insert_one(
            {
                "id": str(uuid.uuid4()),
                "batch_id": notification_batch_id,
                "user_id": payload.target,
                "type": payload.type,
                "title": payload.title,
                "message": payload.message,
                "sent_by_admin": admin.get("id"),
                "read": False,
                "created_at": now,
            }
        )
        recipients_count = 1

    await log_admin_action(
        admin,
        "notification_sent",
        "notification",
        notification_batch_id,
        {
            "target": payload.target,
            "recipients": recipients_count,
            "title": payload.title,
        },
    )

    return {"message": "Notification sent", "recipients": recipients_count}


@api_router.get("/admin/notifications/sent")
async def get_admin_sent_notifications(
    admin: dict = Depends(get_admin_user),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    skip = (page - 1) * limit
    pipeline = [
        {"$match": {"sent_by_admin": {"$exists": True}}},
        {
            "$group": {
                "_id": "$batch_id",
                "title": {"$first": "$title"},
                "message": {"$first": "$message"},
                "type": {"$first": "$type"},
                "sent_by_admin": {"$first": "$sent_by_admin"},
                "sent_at": {"$max": "$created_at"},
                "recipient_count": {"$sum": 1},
            }
        },
        {"$sort": {"sent_at": -1}},
        {"$skip": skip},
        {"$limit": limit},
    ]
    notifications = await db.notifications.aggregate(pipeline).to_list(limit)
    total = len(
        await db.notifications.aggregate(
            [
                {"$match": {"sent_by_admin": {"$exists": True}}},
                {"$group": {"_id": "$batch_id"}},
            ]
        ).to_list(100000)
    )

    return {
        "notifications": notifications,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
    }


@api_router.get("/admin/activity-logs")
async def get_activity_logs(
    admin: dict = Depends(get_admin_user),
    actor_id: Optional[str] = None,
    action: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    query: Dict[str, Any] = {}
    if actor_id:
        query["actor_id"] = actor_id
    if action:
        query["action"] = {"$regex": action, "$options": "i"}

    date_filter: Dict[str, Any] = {}
    if from_date:
        try:
            date_filter["$gte"] = datetime.fromisoformat(
                from_date.replace("Z", "+00:00")
            )
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid from_date format")
    if to_date:
        try:
            date_filter["$lte"] = datetime.fromisoformat(to_date.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid to_date format")
    if date_filter:
        query["created_at"] = date_filter

    skip = (page - 1) * limit
    logs = (
        await db.admin_audit_logs.find(query, {"_id": 0})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )
    total = await db.admin_audit_logs.count_documents(query)
    return {
        "logs": logs,
        "total": total,
        "page": page,
        "total_pages": (total + limit - 1) // limit,
    }


@api_router.get("/admin/bookings")
async def get_all_bookings_admin(
    user: dict = Depends(get_admin_user),
    status: Optional[BookingStatus] = None,
    page: int = 1,
    limit: int = 50,
):
    query = {}
    if status:
        query["status"] = status

    skip = (page - 1) * limit
    bookings = (
        await db.bookings.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    )
    total = await db.bookings.count_documents(query)

    return {"bookings": bookings, "total": total, "page": page}


@api_router.get("/admin/chats")
async def get_admin_chats(
    user: dict = Depends(get_admin_user),
    listing_id: Optional[str] = None,
    owner_id: Optional[str] = None,
    participant_id: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
):
    query: Dict[str, Any] = {}
    if listing_id:
        query["listing_id"] = listing_id
    if owner_id:
        query["owner_id"] = owner_id
    if participant_id:
        query["$or"] = [{"sender_id": participant_id}, {"receiver_id": participant_id}]

    skip = (page - 1) * limit
    messages = (
        await db.messages.find(
            query,
            {
                "_id": 0,
                "id": 1,
                "conversation_id": 1,
                "user_id": 1,
                "sender_id": 1,
                "receiver_id": 1,
                "owner_id": 1,
                "listing_id": 1,
                "message": 1,
                "content": 1,
                "created_at": 1,
            },
        )
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )
    total = await db.messages.count_documents(query)

    return {"messages": messages, "total": total, "page": page, "limit": limit}


@api_router.get("/admin/chats/{conversation_id}")
async def get_admin_chat_conversation(
    conversation_id: str,
    user: dict = Depends(get_admin_user),
    page: int = 1,
    limit: int = 100,
):
    skip = (page - 1) * limit
    messages = (
        await db.messages.find(
            {"conversation_id": conversation_id},
            {
                "_id": 0,
                "id": 1,
                "conversation_id": 1,
                "user_id": 1,
                "sender_id": 1,
                "receiver_id": 1,
                "owner_id": 1,
                "listing_id": 1,
                "message": 1,
                "content": 1,
                "created_at": 1,
                "read": 1,
            },
        )
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )
    total = await db.messages.count_documents({"conversation_id": conversation_id})

    return {
        "conversation_id": conversation_id,
        "messages": messages,
        "total": total,
        "page": page,
        "limit": limit,
    }


@api_router.get("/admin/stats")
async def get_admin_stats(user: dict = Depends(get_admin_user)):
    cached_stats = await get_cached_admin_stats()
    if cached_stats:
        # Check if we should inject settings into cached stats
        settings = await db.settings.find_one({"id": "platform_config"}, {"_id": 0})
        if not settings:
            settings = {
                "id": "platform_config",
                "platform_fee": 50.0,
                "subscription_fee": 999.0,
                "boost_fee": 199.0,
                "service_fee_percent": 5.0,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.settings.insert_one(settings)
        cached_stats["settings"] = settings
        return cached_stats

    now = datetime.now(timezone.utc)
    seven_days_ago = (now - timedelta(days=7)).isoformat()

    total_users = await db.users.count_documents(
        {"role": UserRole.USER.value, "deleted": {"$ne": True}}
    )
    total_owners = await db.users.count_documents(
        {"role": {"$in": OWNER_ROLES}, "deleted": {"$ne": True}}
    )

    users_by_role: Dict[str, int] = {}
    for role in UserRole:
        users_by_role[role.value] = await db.users.count_documents(
            {"role": role.value, "deleted": {"$ne": True}}
        )

    owner_type_breakdown: Dict[str, int] = {}
    for role in OWNER_ROLES:
        owner_type_breakdown[role] = await db.users.count_documents(
            {"role": role, "deleted": {"$ne": True}}
        )

    pending_aadhar = await db.users.count_documents(
        {
            "role": {"$in": OWNER_ROLES},
            "aadhar_number": {"$exists": True},
            "aadhar_status": VerificationStatus.PENDING.value,
            "deleted": {"$ne": True},
        }
    )
    verified_owners = await db.users.count_documents(
        {
            "role": {"$in": OWNER_ROLES},
            "aadhar_status": VerificationStatus.VERIFIED.value,
            "deleted": {"$ne": True},
        }
    )
    rejected_owners = await db.users.count_documents(
        {
            "role": {"$in": OWNER_ROLES},
            "aadhar_status": VerificationStatus.REJECTED.value,
            "deleted": {"$ne": True},
        }
    )

    total_listings = await db.listings.count_documents({})
    pending_listings = await db.listings.count_documents(
        {"status": ListingStatus.PENDING.value}
    )
    approved_listings = await db.listings.count_documents(
        {"status": ListingStatus.APPROVED.value}
    )
    rejected_listings = await db.listings.count_documents(
        {"status": ListingStatus.REJECTED.value}
    )

    total_bookings = await db.bookings.count_documents({})
    bookings_by_status: Dict[str, int] = {}
    for status in BookingStatus:
        bookings_by_status[status.value] = await db.bookings.count_documents(
            {"status": status.value}
        )

    total_videos = await db.videos.count_documents({})
    total_reviews = await db.reviews.count_documents({})
    total_messages = await db.messages.count_documents({})

    category_stats: Dict[str, int] = {}
    for cat in ListingCategory:
        category_stats[cat.value] = await db.listings.count_documents(
            {"category": cat.value}
        )

    new_users_7d = await db.users.count_documents(
        {
            "role": UserRole.USER.value,
            "created_at": {"$gte": seven_days_ago},
            "deleted": {"$ne": True},
        }
    )
    new_owners_7d = await db.users.count_documents(
        {
            "role": {"$in": OWNER_ROLES},
            "created_at": {"$gte": seven_days_ago},
            "deleted": {"$ne": True},
        }
    )
    new_listings_7d = await db.listings.count_documents(
        {"created_at": {"$gte": seven_days_ago}}
    )

    daily_pipeline = [
        {"$match": {"created_at": {"$gte": seven_days_ago}, "deleted": {"$ne": True}}},
        {
            "$group": {
                "_id": {"$substr": ["$created_at", 0, 10]},
                "users": {
                    "$sum": {"$cond": [{"$eq": ["$role", UserRole.USER.value]}, 1, 0]}
                },
                "owners": {"$sum": {"$cond": [{"$in": ["$role", OWNER_ROLES]}, 1, 0]}},
            }
        },
        {"$sort": {"_id": 1}},
    ]
    daily_growth_docs = await db.users.aggregate(daily_pipeline).to_list(30)

    email_verified = await db.users.count_documents(
        {
            "is_email_verified": True,
            "role": UserRole.USER.value,
            "deleted": {"$ne": True},
        }
    )
    email_unverified = await db.users.count_documents(
        {
            "is_email_verified": {"$ne": True},
            "role": UserRole.USER.value,
            "deleted": {"$ne": True},
        }
    )

    blocked_temp = await db.users.count_documents(
        {"block_status": "temporary", "deleted": {"$ne": True}}
    )
    blocked_perm = await db.users.count_documents(
        {"block_status": "permanent", "deleted": {"$ne": True}}
    )

    top_cities = await db.listings.aggregate(
        [
            {"$group": {"_id": "$city", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 10},
        ]
    ).to_list(10)

    total_revenue_pipeline = [{"$group": {"_id": None, "total": {"$sum": "$amount"}}}]
    rev_result = await db.payments.aggregate(total_revenue_pipeline).to_list(1)
    total_revenue = (rev_result[0].get("total", 0) / 100) if rev_result else 0

    subscription_revenue = await db.subscriptions.aggregate(
        [
            {"$match": {"status": "active"}},
            {
                "$group": {
                    "_id": "$billing_month",
                    "revenue_paise": {"$sum": "$amount"},
                    "count": {"$sum": 1},
                }
            },
            {"$sort": {"_id": -1}},
            {"$limit": 12},
        ]
    ).to_list(12)

    commission_revenue = await db.commissions.aggregate(
        [
            {
                "$group": {
                    "_id": "$status",
                    "total_amount": {"$sum": "$commission_amount"},
                    "count": {"$sum": 1},
                }
            },
        ]
    ).to_list(10)
    commission_map = {row["_id"]: row for row in commission_revenue}

    active_subscription_owners = await db.users.count_documents(
        {
            "role": {"$in": list(SUBSCRIPTION_ROLES)},
            "subscription_status": {"$in": ["active", "trial"]},
            "deleted": {"$ne": True},
        }
    )
    blocked_subscription_owners = await db.users.count_documents(
        {
            "role": {"$in": list(SUBSCRIPTION_ROLES)},
            "subscription_status": "blocked",
            "deleted": {"$ne": True},
        }
    )

    response_payload = {
        "total_users": total_users,
        "total_owners": total_owners,
        "users_by_role": users_by_role,
        "owner_type_breakdown": owner_type_breakdown,
        "total_listings": total_listings,
        "pending_listings": pending_listings,
        "approved_listings": approved_listings,
        "rejected_listings": rejected_listings,
        "pending_aadhar": pending_aadhar,
        "verified_owners": verified_owners,
        "rejected_owners": rejected_owners,
        "email_verified": email_verified,
        "email_unverified": email_unverified,
        "blocked_temp": blocked_temp,
        "blocked_perm": blocked_perm,
        "total_bookings": total_bookings,
        "bookings_by_status": bookings_by_status,
        "total_videos": total_videos,
        "total_reviews": total_reviews,
        "total_messages": total_messages,
        "total_revenue": total_revenue,
        "subscription_revenue_by_month": [
            {
                "month": row["_id"],
                "revenue": row["revenue_paise"] / 100,
                "subscribers": row["count"],
            }
            for row in subscription_revenue
        ],
        "commission": {
            "pending": commission_map.get("pending", {}).get("total_amount", 0),
            "paid": commission_map.get("paid", {}).get("total_amount", 0),
            "pending_count": commission_map.get("pending", {}).get("count", 0),
        },
        "subscriber_counts": {
            "active_or_trial": active_subscription_owners,
            "blocked": blocked_subscription_owners,
        },
        "new_users_7d": new_users_7d,
        "new_owners_7d": new_owners_7d,
        "new_listings_7d": new_listings_7d,
        "daily_growth": [
            {
                "date": d.get("_id"),
                "users": d.get("users", 0),
                "owners": d.get("owners", 0),
            }
            for d in daily_growth_docs
        ],
        "category_stats": category_stats,
        "top_cities": [{"city": c["_id"], "count": c["count"]} for c in top_cities],
        "razorpay_enabled": bool(razorpay_client),
    }
    await set_cached_admin_stats(response_payload)
    return response_payload


@api_router.get("/admin/revenue")
async def get_admin_revenue(user: dict = Depends(get_admin_user)):
    """Get detailed revenue statistics for admin dashboard"""
    # Recent payments (listing fees, boosts, etc.)
    payments = (
        await db.payments.find({"status": "paid"}, {"_id": 0})
        .sort("paid_at", -1)
        .limit(50)
        .to_list(50)
    )

    # Recent subscriptions (these ARE the subscription payments)
    subscriptions = (
        await db.subscriptions.find({"status": "active"}, {"_id": 0})
        .sort("created_at", -1)
        .limit(50)
        .to_list(50)
    )

    # ✅ FIX: Enrich subscription records with owner info and merge into payments
    # so admin dashboard "Recent Transactions" shows subscription payments too
    owner_ids = list({s.get("user_id") for s in subscriptions if s.get("user_id")})
    owner_ids.extend([p.get("user_id") for p in payments if p.get("user_id")])
    owner_ids = list(set(owner_ids))
    owner_map = {}
    if owner_ids:
        owners_cursor = db.users.find(
            {"id": {"$in": owner_ids}},
            {"_id": 0, "id": 1, "name": 1, "email": 1, "role": 1, "phone": 1},
        )
        async for o in owners_cursor:
            owner_map[o["id"]] = o

    enriched_subscriptions = []
    for sub in subscriptions:
        owner = owner_map.get(sub.get("user_id"), {})
        enriched_subscriptions.append(
            {
                **sub,
                "payment_id": sub.get("razorpay_payment_id", ""),
                "order_id": sub.get("razorpay_order_id", ""),
                "user_name": owner.get("name", "Owner"),
                "user_phone": owner.get("phone", ""),
                "user_email": owner.get("email", ""),
                "owner_role": owner.get("role", ""),
                "booking_type": f"Subscription ({sub.get('plan', 'basic').replace('_', ' ').title()})",
                "paid_at": sub.get("activated_at") or sub.get("created_at"),
            }
        )

    # Also enrich regular payments with user info
    enriched_payments = []
    for pay in payments:
        owner = owner_map.get(pay.get("user_id"), {})
        enriched_payments.append(
            {
                **pay,
                "payment_id": pay.get("razorpay_payment_id", pay.get("payment_id", "")),
                "order_id": pay.get("razorpay_order_id", pay.get("order_id", "")),
                "user_name": owner.get("name", "Owner"),
                "user_phone": owner.get("phone", ""),
                "user_email": owner.get("email", ""),
            }
        )

    # Merge subscription payments into recent_payments for unified admin view
    all_payments = enriched_payments + enriched_subscriptions
    all_payments.sort(
        key=lambda x: x.get("paid_at") or x.get("created_at") or "", reverse=True
    )
    all_payments = all_payments[:50]

    # Revenue by type
    pipeline = [{"$group": {"_id": "$booking_type", "total": {"$sum": "$amount"}}}]
    revenue_by_type = await db.payments.aggregate(pipeline).to_list(10)

    # ✅ Also compute subscription revenue from subscriptions collection
    sub_revenue_pipeline = [
        {"$match": {"status": "active"}},
        {"$group": {"_id": "subscription", "total": {"$sum": "$amount"}}},
    ]
    sub_revenue = await db.subscriptions.aggregate(sub_revenue_pipeline).to_list(5)
    # Merge subscription revenue into revenue_by_type list
    sub_revenue_map = {r["_id"]: r["total"] for r in sub_revenue}
    merged_revenue = {r["_id"] or "other": r["total"] for r in revenue_by_type}
    for k, v in sub_revenue_map.items():
        merged_revenue[k] = merged_revenue.get(k, 0) + v
    revenue_by_type_final = [
        {"type": k, "amount": v / 100} for k, v in merged_revenue.items()
    ]

    # Daily revenue (last 30 days)
    start_date = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    daily_pipeline = [
        {"$match": {"status": "paid", "paid_at": {"$gte": start_date}}},
        {
            "$group": {
                "_id": {"$substr": ["$paid_at", 0, 10]},
                "total": {"$sum": "$amount"},
            }
        },
        {"$sort": {"_id": 1}},
    ]
    daily_revenue = await db.payments.aggregate(daily_pipeline).to_list(30)

    # Daily subscription revenue (last 30 days)
    daily_sub_pipeline = [
        {"$match": {"status": "active", "activated_at": {"$gte": start_date}}},
        {
            "$group": {
                "_id": {"$substr": ["$activated_at", 0, 10]},
                "total": {"$sum": "$amount"},
            }
        },
        {"$sort": {"_id": 1}},
    ]
    daily_sub_revenue = await db.subscriptions.aggregate(daily_sub_pipeline).to_list(30)
    # Merge daily revenues
    daily_map: dict = {}
    for r in daily_revenue:
        daily_map[r["_id"]] = daily_map.get(r["_id"], 0) + r["total"]
    for r in daily_sub_revenue:
        if r["_id"]:
            daily_map[r["_id"]] = daily_map.get(r["_id"], 0) + r["total"]
    daily_revenue_final = sorted(
        [{"date": k, "amount": v / 100} for k, v in daily_map.items()],
        key=lambda x: x["date"],
    )

    # Recent boost payments
    boosts = (
        await db.boosts.find({"status": "paid"}, {"_id": 0})
        .sort("paid_at", -1)
        .limit(50)
        .to_list(50)
    )

    # Owner subscription status summary (enriched with last payment info)
    owners_summary_pipeline = [
        {"$match": {"role": {"$in": list(SUBSCRIPTION_ROLES)}}},
        {
            "$group": {
                "_id": "$subscription_status",
                "count": {"$sum": 1},
                "total_users": {
                    "$push": {
                        "id": "$id",
                        "name": "$name",
                        "email": "$email",
                        "role": "$role",
                        "status": "$subscription_status",
                        "next_billing": "$next_billing_date",
                        "last_payment_date": "$last_payment_date",
                        "subscription_plan": "$subscription_plan",
                        "subscription_amount_paise": "$subscription_amount_paise",
                    }
                },
            }
        },
    ]
    owners_summary = await db.users.aggregate(owners_summary_pipeline).to_list(100)

    return {
        "recent_payments": all_payments,
        "recent_subscriptions": enriched_subscriptions,
        "recent_boosts": boosts,
        "owners_subscription_summary": owners_summary,
        "revenue_by_type": revenue_by_type_final,
        "daily_revenue": daily_revenue_final,
        "razorpay_enabled": bool(razorpay_client),
    }


import math


class CategorySettings(BaseModel):
    platform_fee: Optional[float] = 0.0
    subscription_fee: Optional[float] = 0.0
    basic_subscription_fee: Optional[float] = 199.0
    pro_subscription_fee: Optional[float] = 499.0
    # Service specific fees
    service_basic_fee: Optional[float] = 50.0
    service_verified_fee: Optional[float] = 99.0
    service_top_fee: Optional[float] = 149.0
    # Reel Boost fees
    reel_boost_1d: Optional[float] = 19.0
    reel_boost_3d: Optional[float] = 49.0
    reel_boost_7d: Optional[float] = 99.0

    boost_fee: Optional[float] = 0.0
    service_fee_percent: Optional[float] = 0.0
    listing_fee: Optional[float] = 0.0
    commission_rate: Optional[float] = 2.0

    @field_validator("*", mode="before")
    @classmethod
    def validate_floats(cls, v):
        if v is None or (isinstance(v, float) and math.isnan(v)):
            return 0.0
        try:
            return float(v)
        except (ValueError, TypeError):
            return 0.0

    class Config:
        extra = "allow"


class PlatformSettings(BaseModel):
    id: Optional[str] = "platform_config"
    global_config: Optional[CategorySettings] = None
    categories: Optional[Dict[str, CategorySettings]] = Field(default_factory=dict)
    updated_at: Optional[str] = None

    class Config:
        extra = "allow"


@api_router.get("/platform/fees")
async def get_platform_fees():
    """Public endpoint to get platform fees for different categories"""
    try:
        # Ultimate fallback defaults
        default_fee = {
            "platform_fee": 50.0,
            "subscription_fee": 999.0,
            "basic_subscription_fee": 199.0,
            "pro_subscription_fee": 499.0,
            "listing_fee": 199.0,
            "commission_rate": 2.0,
        }

        settings = await db.settings.find_one({"id": "platform_config"}, {"_id": 0})

        if not settings:
            return {"global_config": default_fee, "categories": {}}

        def sanitize(config):
            if not isinstance(config, dict):
                return default_fee
            return {
                "platform_fee": float(
                    config.get("platform_fee")
                    if config.get("platform_fee") is not None
                    else 50.0
                ),
                "subscription_fee": float(
                    config.get("subscription_fee")
                    if config.get("subscription_fee") is not None
                    else 999.0
                ),
                "basic_subscription_fee": float(
                    config.get("basic_subscription_fee")
                    if config.get("basic_subscription_fee") is not None
                    else 199.0
                ),
                "pro_subscription_fee": float(
                    config.get("pro_subscription_fee")
                    if config.get("pro_subscription_fee") is not None
                    else 499.0
                ),
                "listing_fee": float(
                    config.get("listing_fee")
                    if config.get("listing_fee") is not None
                    else 199.0
                ),
                "commission_rate": float(
                    config.get("commission_rate")
                    if config.get("commission_rate") is not None
                    else 2.0
                ),
            }

        global_cfg = settings.get("global_config")
        categories_raw = settings.get("categories") or {}

        return {
            "global_config": sanitize(global_cfg),
            "categories": {
                cat: sanitize(cfg)
                for cat, cfg in categories_raw.items()
                if isinstance(cfg, dict)
            },
        }
    except Exception as e:
        logger.error(f"CRITICAL: get_platform_fees failed: {e}", exc_info=True)
        return {
            "global_config": {
                "platform_fee": 50.0,
                "subscription_fee": 999.0,
                "basic_subscription_fee": 199.0,
                "pro_subscription_fee": 499.0,
                "listing_fee": 199.0,
                "commission_rate": 2.0,
            },
            "categories": {},
        }


@api_router.get("/admin/settings")
async def get_platform_settings(user: dict = Depends(get_admin_user)):
    settings = await db.settings.find_one({"id": "platform_config"}, {"_id": 0})
    if not settings:
        default_cat = {
            "platform_fee": 50.0,
            "subscription_fee": 999.0,
            "basic_subscription_fee": 199.0,
            "pro_subscription_fee": 499.0,
            "boost_fee": 199.0,
            "service_fee_percent": 5.0,
            "listing_fee": 0.0,
            "commission_rate": 2.0,
        }
        property_cat = {
            "platform_fee": 0.0,
            "subscription_fee": 999.0,
            "basic_subscription_fee": 999.0,
            "pro_subscription_fee": 999.0,
            "boost_fee": 199.0,
            "service_fee_percent": 0.0,
            "listing_fee": 199.0,
            "commission_rate": 0.0,
        }
        settings = {
            "id": "platform_config",
            "global_config": default_cat,
            "categories": {
                "stay": default_cat,
                "event": default_cat,
                "services": default_cat,
                "home": property_cat,
                "business": property_cat,
            },
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.settings.insert_one(settings)
    return settings


@api_router.post("/admin/settings")
async def update_platform_settings(
    settings: PlatformSettings, user: dict = Depends(get_admin_user)
):
    """Update platform-wide and category-specific configuration"""
    try:
        update_data = settings.model_dump()
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

        # Remove MongoDB specific fields if present
        update_data.pop("_id", None)

        await db.settings.update_one(
            {"id": "platform_config"}, {"$set": update_data}, upsert=True
        )

        # Try to clear cache if function exists, else ignore
        try:
            await delete_cached_admin_stats()
        except NameError:
            pass
        except Exception as e:
            logger.warning(f"Failed to clear cache: {e}")

        return {
            "message": "Settings updated successfully",
            "status": "success",
            "updated_at": update_data["updated_at"],
        }
    except Exception as e:
        logger.error(f"Error updating platform settings: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to update settings: {str(e)}"
        )


@api_router.post("/admin/create")
async def create_admin(admin_data: UserRegister):
    existing = await db.users.find_one({"role": UserRole.ADMIN})
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Admin already exists. Use invite system for additional admins.",
        )

    user_id = str(uuid.uuid4())
    admin_doc = {
        "id": user_id,
        "name": admin_data.name,
        "email": admin_data.email,
        "phone": admin_data.phone,
        "password": hash_password(admin_data.password),
        "gender": admin_data.gender,
        "address": admin_data.address,
        "city": admin_data.city,
        "state": admin_data.state,
        "role": UserRole.ADMIN,
        "is_verified": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.users.insert_one(admin_doc)
    token = create_token(user_id, UserRole.ADMIN)

    return {"message": "Admin created successfully", "token": token}


# ============ OWNER DASHBOARD ROUTES ============
@api_router.get("/owner/listings")
async def get_owner_listings(
    user_id: Optional[str] = None, user: dict = Depends(get_owner_user)
):
    requested_owner_id = user_id.strip() if user_id else ""
    if (
        requested_owner_id
        and requested_owner_id != user["id"]
        and user.get("role") != UserRole.ADMIN
    ):
        raise HTTPException(
            status_code=403, detail="Cannot access another owner's listings"
        )

    target_owner_id = requested_owner_id or user["id"]
    allowed_categories = list(get_allowed_listing_categories_for_role(user.get("role")))
    if not allowed_categories:
        raise HTTPException(
            status_code=403, detail="No categories allowed for this role"
        )

    query = {
        "owner_id": target_owner_id,
        "category": {"$in": allowed_categories},
    }
    listings = (
        await db.listings.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    )
    return {"listings": listings}


@api_router.get("/owner/stats")
async def get_owner_stats(user: dict = Depends(get_owner_user)):
    listings = await db.listings.find({"owner_id": user["id"]}, {"_id": 0}).to_list(100)

    total_views = sum(l.get("views", 0) for l in listings)
    total_likes = sum(l.get("likes", 0) for l in listings)
    total_saves = sum(l.get("saves", 0) for l in listings)
    total_inquiries = sum(l.get("inquiries", 0) for l in listings)
    total_shares = sum(l.get("shares", 0) for l in listings)

    bookings = await db.bookings.count_documents({"owner_id": user["id"]})
    pending_bookings = await db.bookings.count_documents(
        {"owner_id": user["id"], "status": BookingStatus.PENDING}
    )
    confirmed_bookings = await db.bookings.count_documents(
        {"owner_id": user["id"], "status": BookingStatus.CONFIRMED}
    )

    videos = await db.videos.find(
        {"owner_id": user["id"]}, {"_id": 0, "views": 1, "likes": 1}
    ).to_list(100)
    total_reel_views = sum(v.get("views", 0) for v in videos)
    total_reel_likes = sum(v.get("likes", 0) for v in videos)

    negotiations = await db.negotiations.count_documents(
        {"owner_id": user["id"], "status": NegotiationStatus.PENDING}
    )

    return {
        "total_listings": len(listings),
        "total_views": total_views,
        "total_likes": total_likes,
        "total_saves": total_saves,
        "total_inquiries": total_inquiries,
        "total_shares": total_shares,
        "total_bookings": bookings,
        "pending_bookings": pending_bookings,
        "confirmed_bookings": confirmed_bookings,
        "total_reels": len(videos),
        "total_reel_views": total_reel_views,
        "total_reel_likes": total_reel_likes,
        "pending_negotiations": negotiations,
    }


@api_router.get("/owner/analytics")
async def get_owner_analytics(user: dict = Depends(get_owner_user), days: int = 30):
    # Get daily views for last N days
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    listings = await db.listings.find({"owner_id": user["id"]}, {"_id": 0}).to_list(100)
    listing_ids = [l["id"] for l in listings]

    # Aggregate bookings by date
    pipeline = [
        {"$match": {"owner_id": user["id"], "created_at": {"$gte": start_date}}},
        {"$group": {"_id": {"$substr": ["$created_at", 0, 10]}, "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    booking_trend = await db.bookings.aggregate(pipeline).to_list(days)

    return {
        "period": f"Last {days} days",
        "total_listings": len(listings),
        "booking_trend": [
            {"date": b["_id"], "bookings": b["count"]} for b in booking_trend
        ],
        "top_listing": max(listings, key=lambda x: x.get("views", 0))
        if listings
        else None,
    }


# ============ CATEGORIES ============
@api_router.get("/categories")
async def get_categories():
    return {
        "categories": [
            {
                "id": "home",
                "name": "Home",
                "name_gu": "ઘર",
                "icon": "Home",
                "description": "Residential properties for rent or sale",
                "sub_categories": [
                    {"id": "1bhk", "name": "1 BHK", "name_gu": "1 BHK"},
                    {"id": "2bhk", "name": "2 BHK", "name_gu": "2 BHK"},
                    {"id": "3bhk", "name": "3 BHK", "name_gu": "3 BHK"},
                    {"id": "4bhk", "name": "4+ BHK", "name_gu": "4+ BHK"},
                    {"id": "rowhouse", "name": "Row House", "name_gu": "રો હાઉસ"},
                    {"id": "duplex", "name": "Duplex", "name_gu": "ડુપ્લેક્સ"},
                    {"id": "bungalow", "name": "Bungalow", "name_gu": "બંગલો"},
                    {"id": "penthouse", "name": "Penthouse", "name_gu": "પેન્ટહાઉસ"},
                    {"id": "plot", "name": "Residential Plot", "name_gu": "પ્લોટ"},
                    {"id": "farmhouse", "name": "Farmhouse", "name_gu": "ફાર્મહાઉસ"},
                    {"id": "pg", "name": "PG/Hostel", "name_gu": "PG/હોસ્ટેલ"},
                    {"id": "villa", "name": "Villa", "name_gu": "વિલા"},
                ],
            },
            {
                "id": "business",
                "name": "Business",
                "name_gu": "બિઝનેસ",
                "icon": "Building2",
                "description": "Commercial spaces for business",
                "sub_categories": [
                    {"id": "shop", "name": "Shop", "name_gu": "દુકાન"},
                    {"id": "mall_shop", "name": "Mall Shop", "name_gu": "મોલ શોપ"},
                    {"id": "showroom", "name": "Showroom", "name_gu": "શોરૂમ"},
                    {"id": "office", "name": "Office", "name_gu": "ઓફિસ"},
                    {
                        "id": "coworking",
                        "name": "Co-working Space",
                        "name_gu": "કો-વર્કિંગ",
                    },
                    {"id": "warehouse", "name": "Warehouse", "name_gu": "ગોડાઉન"},
                    {"id": "godown", "name": "Godown", "name_gu": "ગોડાઉન"},
                    {"id": "factory", "name": "Factory Shed", "name_gu": "ફેક્ટરી"},
                    {
                        "id": "industrial_land",
                        "name": "Industrial Land",
                        "name_gu": "ઔદ્યોગિક જમીન",
                    },
                    {
                        "id": "restaurant_space",
                        "name": "Restaurant Space",
                        "name_gu": "રેસ્ટોરન્ટ",
                    },
                    {"id": "cafe_space", "name": "Cafe Space", "name_gu": "કેફે"},
                    {
                        "id": "cloud_kitchen",
                        "name": "Cloud Kitchen",
                        "name_gu": "ક્લાઉડ કિચન",
                    },
                ],
            },
            {
                "id": "stay",
                "name": "Stay",
                "name_gu": "રહેવાનું",
                "icon": "Hotel",
                "description": "Hotels, rooms and accommodations",
                "sub_categories": [
                    {"id": "hotel", "name": "Hotel", "name_gu": "હોટેલ"},
                    {
                        "id": "budget_hotel",
                        "name": "Budget Hotel",
                        "name_gu": "બજેટ હોટેલ",
                    },
                    {
                        "id": "luxury_hotel",
                        "name": "Luxury Hotel",
                        "name_gu": "લક્ઝરી હોટેલ",
                    },
                    {"id": "room", "name": "Room", "name_gu": "રૂમ"},
                    {"id": "guesthouse", "name": "Guest House", "name_gu": "ગેસ્ટ હાઉસ"},
                    {"id": "resort", "name": "Resort", "name_gu": "રિસોર્ટ"},
                    {"id": "pg_stay", "name": "PG Accommodation", "name_gu": "PG"},
                    {"id": "homestay", "name": "Homestay", "name_gu": "હોમસ્ટે"},
                ],
            },
            {
                "id": "event",
                "name": "Event",
                "name_gu": "ઇવેન્ટ",
                "icon": "PartyPopper",
                "description": "Event venues for celebrations",
                "sub_categories": [
                    {"id": "partyplot", "name": "Party Plot", "name_gu": "પાર્ટી પ્લોટ"},
                    {
                        "id": "marriagehall",
                        "name": "Marriage Hall",
                        "name_gu": "લગ્ન હોલ",
                    },
                    {
                        "id": "banquethall",
                        "name": "Banquet Hall",
                        "name_gu": "બેંક્વેટ હોલ",
                    },
                    {
                        "id": "conference",
                        "name": "Conference Hall",
                        "name_gu": "કોન્ફરન્સ હોલ",
                    },
                    {
                        "id": "farmhouse_venue",
                        "name": "Farmhouse Venue",
                        "name_gu": "ફાર્મહાઉસ વેન્યુ",
                    },
                    {"id": "hotel_venue", "name": "Hotel Venue", "name_gu": "હોટેલ વેન્યુ"},
                    {
                        "id": "outdoor_venue",
                        "name": "Outdoor Venue",
                        "name_gu": "આઉટડોર વેન્યુ",
                    },
                    {
                        "id": "birthday_venue",
                        "name": "Birthday Party Venue",
                        "name_gu": "બર્થડે વેન્યુ",
                    },
                ],
            },
            {
                "id": "services",
                "name": "Services",
                "name_gu": "સેવાઓ",
                "icon": "Wrench",
                "description": "Home and professional services",
                "sub_categories": [
                    {"id": "plumber", "name": "Plumber", "name_gu": "પ્લમ્બર"},
                    {
                        "id": "electrician",
                        "name": "Electrician",
                        "name_gu": "ઇલેક્ટ્રિશિયન",
                    },
                    {"id": "ac_repair", "name": "AC Repair", "name_gu": "AC રિપેર"},
                    {
                        "id": "washing_machine",
                        "name": "Washing Machine Repair",
                        "name_gu": "વોશિંગ મશીન",
                    },
                    {"id": "ro_repair", "name": "RO Repair", "name_gu": "RO રિપેર"},
                    {"id": "cctv", "name": "CCTV Installation", "name_gu": "CCTV"},
                    {
                        "id": "home_cleaning",
                        "name": "Home Cleaning",
                        "name_gu": "ઘર સફાઈ",
                    },
                    {
                        "id": "bathroom_cleaning",
                        "name": "Bathroom Cleaning",
                        "name_gu": "બાથરૂમ સફાઈ",
                    },
                    {
                        "id": "sofa_cleaning",
                        "name": "Sofa Cleaning",
                        "name_gu": "સોફા સફાઈ",
                    },
                    {"id": "painting", "name": "Painting", "name_gu": "પેઇન્ટિંગ"},
                    {
                        "id": "false_ceiling",
                        "name": "False Ceiling",
                        "name_gu": "ફોલ્સ સિલિંગ",
                    },
                    {"id": "tile_work", "name": "Tile Work", "name_gu": "ટાઇલ વર્ક"},
                    {"id": "carpenter", "name": "Carpenter", "name_gu": "સુથાર"},
                    {
                        "id": "pest_control",
                        "name": "Pest Control",
                        "name_gu": "પેસ્ટ કંટ્રોલ",
                    },
                    {"id": "garden", "name": "Garden Maintenance", "name_gu": "ગાર્ડન"},
                    {
                        "id": "packers_movers",
                        "name": "Packers & Movers",
                        "name_gu": "પેકર્સ મૂવર્સ",
                    },
                ],
            },
        ]
    }


# ============ SEARCH HISTORY ============
@api_router.post("/search/history")
async def add_search_history(query: str, user: dict = Depends(get_current_user)):
    normalized = normalize_search_query(query)
    now_iso = datetime.now(timezone.utc).isoformat()

    await db.users.update_one(
        {"id": user["id"]},
        {
            "$push": {
                "search_history": {
                    "$each": [{"query": query, "date": now_iso}],
                    "$slice": -50,
                }
            }
        },
    )

    await db.search_history.insert_one(
        {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "query": query,
            "normalized_query": normalized.get(
                "normalized_query", (query or "").strip().lower()
            ),
            "language": normalized.get("detected_language", "en"),
            "city": next(
                (
                    token
                    for token in normalized.get("normalized_tokens", [])
                    if token
                    in {"surat", "ahmedabad", "vadodara", "rajkot", "gandhinagar"}
                ),
                None,
            ),
            "category": normalized.get("detected_category"),
            "created_at": now_iso,
        }
    )

    return {"message": "Search recorded"}


@api_router.get("/search/history")
async def get_search_history(user: dict = Depends(get_current_user)):
    user_data = await db.users.find_one({"id": user["id"]}, {"search_history": 1})
    return {"history": user_data.get("search_history", [])[-20:]}


# ============ HEALTH CHECK ============
@api_router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "2.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ============ WEBSOCKET FOR REAL-TIME ============
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_json()
            # Handle real-time messages
            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(user_id)


# ============ RAZORPAY PAYMENT INTEGRATION ============
import razorpay

# Initialize Razorpay client
razorpay_client = None
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")

if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    logger.info("Razorpay client initialized successfully")


class PaymentOrderRequest(BaseModel):
    amount: int = Field(..., description="Amount in paise (1 INR = 100 paise)")
    listing_id: Optional[str] = None
    booking_type: Optional[str] = "stay"
    booking_date: Optional[str] = None
    guests: Optional[int] = 1
    notes: Optional[str] = None
    payment_type: str = "booking"  # booking, listing_fee, subscription
    subscription_months: int = 1
    plan: Optional[str] = "basic"


class PaymentVerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@api_router.post("/payments/create-order")
async def create_payment_order(
    request: PaymentOrderRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Create Razorpay payment order for booking, listing fee, or subscription"""
    try:
        user = await get_current_user(credentials)
        user_id = user["id"]

        if not razorpay_client:
            logger.error("RAZORPAY ERROR: Client not initialized")
            raise HTTPException(
                status_code=500, detail="Payment gateway not configured"
            )

        # 1. Determination of Booking Type and Category
        booking_type = request.booking_type or "stay"
        listing = None

        if request.payment_type == "booking":
            if not request.listing_id:
                raise HTTPException(
                    status_code=400, detail="Listing ID required for booking"
                )
            listing = await db.listings.find_one({"id": request.listing_id})
            if not listing:
                raise HTTPException(status_code=404, detail="Listing not found")

            # Locking Logic
            lock_owner = str(listing.get("locked_by") or "").strip()
            lock_at = listing.get("locked_at")
            is_locked = listing.get("is_locked", False)
            if is_locked and lock_owner and lock_owner != user_id and lock_at:
                try:
                    locked_dt = datetime.fromisoformat(lock_at.replace("Z", "+00:00"))
                    if (
                        datetime.now(timezone.utc) - locked_dt
                    ).total_seconds() < 900:  # 15 min
                        raise HTTPException(
                            status_code=409,
                            detail="This listing is currently being booked by another user.",
                        )
                except (ValueError, TypeError):
                    pass  # Handle invalid dates gracefully

            await db.listings.update_one(
                {"id": request.listing_id},
                {
                    "$set": {
                        "is_locked": True,
                        "locked_by": user_id,
                        "locked_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }
                },
            )
            booking_type = listing.get("category") or booking_type

        elif request.payment_type == "listing_fee":
            if not request.listing_id:
                raise HTTPException(status_code=400, detail="Listing ID required")
            listing = await db.listings.find_one({"id": request.listing_id})
            if not listing:
                raise HTTPException(status_code=404, detail="Listing not found")
            booking_type = listing.get("category") or "home"

        elif request.payment_type == "subscription":
            booking_type = "subscription"

        # 2. Dynamic Fee Retrieval with Triple-Layer Fallback
        settings_doc = await db.settings.find_one({"id": "platform_config"})

        def get_fee(cat_id, fee_key, default_val):
            if not settings_doc:
                return default_val
            cat_cfg = settings_doc.get("categories", {}).get(cat_id.lower())
            if isinstance(cat_cfg, dict) and cat_cfg.get(fee_key) is not None:
                return float(cat_cfg[fee_key])
            global_cfg = settings_doc.get("global_config")
            if isinstance(global_cfg, dict) and global_cfg.get(fee_key) is not None:
                return float(global_cfg[fee_key])
            return default_val

        # 3. Final Amount Calculation
        total_amount_paise = 0
        platform_fee_paise = 0

        if request.payment_type == "booking":
            fee_val = get_fee(booking_type, "platform_fee", 50.0)
            platform_fee_paise = int(fee_val * 100)
            total_amount_paise = int(request.amount + platform_fee_paise)

        elif request.payment_type == "listing_fee":
            fee_val = get_fee(booking_type, "listing_fee", 199.0)
            total_amount_paise = int(fee_val * 100)

        elif request.payment_type == "subscription":
            booking_type = "subscription"
            # Determine plan and amount
            plan_name = (request.plan or "basic").lower()
            if plan_name == "pro":
                fee_val = get_fee("stay", "pro_subscription_fee", 499.0)
            elif plan_name == "basic":
                fee_val = get_fee("stay", "basic_subscription_fee", 199.0)
            elif plan_name == "service_basic":
                fee_val = get_fee("services", "service_basic_fee", 50.0)
            elif plan_name == "service_verified":
                fee_val = get_fee("services", "service_verified_fee", 99.0)
            elif plan_name == "service_top":
                fee_val = get_fee("services", "service_top_fee", 149.0)
            else:
                fee_val = get_fee("home", "subscription_fee", 999.0)
            total_amount_paise = int(fee_val * 100 * (request.subscription_months or 1))

        elif request.payment_type == "reel_boost":
            booking_type = "services"
            days = int(request.subscription_months or 1)
            if days == 1:
                fee_val = get_fee("services", "reel_boost_1d", 19.0)
            elif days == 3:
                fee_val = get_fee("services", "reel_boost_3d", 49.0)
            elif days == 7:
                fee_val = get_fee("services", "reel_boost_7d", 99.0)
            else:
                fee_val = 19.0 * days  # fallback
            total_amount_paise = int(fee_val * 100)

        else:
            total_amount_paise = int(request.amount)

        if total_amount_paise <= 0:
            raise HTTPException(
                status_code=400, detail="Invalid payment amount calculated"
            )

        # 4. Create Razorpay Order
        order_data = {
            "amount": total_amount_paise,
            "currency": "INR",
            "receipt": f"order_{uuid.uuid4().hex[:12]}",
            "notes": {
                "user_id": user_id,
                "listing_id": request.listing_id or "",
                "booking_type": booking_type,
                "payment_type": request.payment_type,
                "plan": request.plan or "",
            },
        }

        order = razorpay_client.order.create(data=order_data)

        # 5. Persistent Record Saving
        payment_record = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "user_name": user.get("name"),
            "user_email": user.get("email"),
            "listing_id": request.listing_id,
            "razorpay_order_id": order["id"],
            "amount": total_amount_paise,
            "currency": "INR",
            "booking_type": booking_type,
            "payment_type": request.payment_type,
            "plan": request.plan if request.payment_type == "subscription" else None,
            "subscription_months": request.subscription_months
            if request.payment_type == "subscription"
            else 1,
            "booking_date": request.booking_date,
            "status": "created",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        await db.payments.insert_one(payment_record)

        return {
            "order_id": order["id"],
            "amount": total_amount_paise,
            "key_id": RAZORPAY_KEY_ID,
            "payment_id": payment_record["id"],
            "payment_type": request.payment_type,
            "user_details": {
                "name": user.get("name"),
                "phone": user.get("phone"),
                "email": user.get("email"),
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"CRITICAL PAYMENT ERROR: create_payment_order failed: {e}", exc_info=True
        )
        raise HTTPException(
            status_code=500,
            detail="A professional server error occurred while initiating payment. Our team has been notified.",
        )


@api_router.post("/payments/verify")
async def verify_payment(
    request: PaymentVerifyRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Verify Razorpay payment and confirm booking or subscription"""
    user = await get_current_user(credentials)
    user_id = user["id"]

    if not razorpay_client:
        logger.error("RAZORPAY ERROR: Client not initialized")
        raise HTTPException(status_code=500, detail="Payment gateway not configured")

    try:
        # Verify signature
        params_dict = {
            "razorpay_order_id": request.razorpay_order_id,
            "razorpay_payment_id": request.razorpay_payment_id,
            "razorpay_signature": request.razorpay_signature,
        }

        razorpay_client.utility.verify_payment_signature(params_dict)

        # Update payment record
        payment = await db.payments.find_one(
            {"razorpay_order_id": request.razorpay_order_id}
        )

        if not payment:
            logger.error(
                f"VERIFY ERROR: Payment not found for order {request.razorpay_order_id}"
            )
            raise HTTPException(status_code=404, detail="Payment record not found")

        now_iso = datetime.now(timezone.utc).isoformat()
        await db.payments.update_one(
            {"razorpay_order_id": request.razorpay_order_id},
            {
                "$set": {
                    "razorpay_payment_id": request.razorpay_payment_id,
                    "razorpay_signature": request.razorpay_signature,
                    "status": "paid",
                    "paid_at": now_iso,
                }
            },
        )

        payment_type = payment.get("payment_type", "booking")

        if payment_type == "booking":
            booking_id = str(uuid.uuid4())
            booking = {
                "id": booking_id,
                "user_id": user_id,
                "user_name": user.get("name"),
                "user_phone": user.get("phone"),
                "listing_id": payment["listing_id"],
                "payment_id": payment["id"],
                "razorpay_order_id": request.razorpay_order_id,
                "razorpay_payment_id": request.razorpay_payment_id,
                "booking_date": payment.get("booking_date"),
                "amount_paid": payment["amount"],
                "status": "confirmed",
                "created_at": now_iso,
            }
            await db.bookings.insert_one(booking)

            # Dynamic Commission Recording
            listing = await db.listings.find_one({"id": payment["listing_id"]})
            if listing and listing.get("category") in {
                ListingCategory.STAY.value,
                ListingCategory.EVENT.value,
            }:
                # Fetch rate from settings or use default 2.0
                settings = await db.settings.find_one({"id": "platform_config"})
                cat_id = listing.get("category").lower()
                rate_val = 2.0
                if settings:
                    cat_cfg = settings.get("categories", {}).get(cat_id)
                    if (
                        isinstance(cat_cfg, dict)
                        and cat_cfg.get("commission_rate") is not None
                    ):
                        rate_val = float(cat_cfg["commission_rate"])
                    else:
                        rate_val = float(
                            settings.get("global_config", {}).get(
                                "commission_rate", 2.0
                            )
                        )

                commission_amount = int(payment["amount"] * (rate_val / 100))
                await db.commissions.insert_one(
                    {
                        "id": str(uuid.uuid4()),
                        "booking_id": booking_id,
                        "owner_id": listing["owner_id"],
                        "listing_id": listing["id"],
                        "total_amount": payment["amount"],
                        "commission_rate": rate_val,
                        "commission_amount": commission_amount,
                        "status": "pending",
                        "created_at": now_iso,
                    }
                )

            await db.listings.update_one(
                {"id": payment["listing_id"]},
                {
                    "$set": {
                        "is_locked": False,
                        "locked_by": None,
                        "locked_at": None,
                        "updated_at": now_iso,
                    },
                    "$addToSet": {"contact_unlocked_user_ids": user_id},
                },
            )
            return {
                "success": True,
                "message": "Booking confirmed!",
                "booking_id": booking_id,
            }

        elif payment_type == "listing_fee":
            await db.listings.update_one(
                {"id": payment["listing_id"]},
                {
                    "$set": {
                        "status": "approved",
                        "payment_status": "paid",
                        "listing_fee_paid": True,
                        "payment_required": None,
                        "fee_amount_paise": None,
                        "updated_at": now_iso,
                    }
                },
            )
            return {
                "success": True,
                "message": "Listing fee paid successfully! Your listing is now live.",
            }

        elif payment_type == "subscription":
            months = int(payment.get("subscription_months", 1))
            plan = payment.get("plan", SubscriptionPlan.BASIC.value)

            # Smart Billing Date Calculation
            current_next_billing = user.get("next_billing_date")
            start_date = datetime.now(timezone.utc)
            if current_next_billing:
                try:
                    parsed_date = datetime.fromisoformat(
                        current_next_billing.replace("Z", "+00:00")
                    )
                    if parsed_date > start_date:
                        start_date = parsed_date
                except:
                    pass

            expiry_date = _add_months(start_date, months)

            # Map features based on plan
            featured = False
            verified = user.get("verified", False)

            if plan == SubscriptionPlan.SERVICE_TOP.value:
                featured = True
                verified = True
            elif plan == SubscriptionPlan.SERVICE_VERIFIED.value:
                verified = True
            elif plan == SubscriptionPlan.PRO.value:
                featured = True

            await db.users.update_one(
                {"id": user_id},
                {
                    "$set": {
                        "subscription_status": "active",
                        "subscription_plan": plan,
                        "next_billing_date": expiry_date.isoformat(),
                        "last_payment_date": now_iso,
                        "subscription_start_date": user.get("subscription_start_date")
                        or now_iso,
                        "verified": verified,
                    }
                },
            )

            # Propagate visibility boost to all listings
            await db.listings.update_many(
                {"owner_id": user_id},
                {
                    "$set": {
                        "subscription_plan": plan,
                        "featured": featured,
                        "owner_verified": verified,
                        "status": "approved",
                        "payment_required": None,
                        "fee_amount_paise": None,
                    }
                },
            )

            # Also approve any listings that were awaiting payment
            await db.listings.update_many(
                {"owner_id": user_id, "status": "awaiting_payment"},
                {"$set": {"status": "approved"}},
            )

            await db.subscriptions.insert_one(
                {
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "payment_id": payment["id"],
                    "amount": payment["amount"],
                    "plan": plan,
                    "status": "active",
                    "paid_at": now_iso,
                    "expires_at": expiry_date.isoformat(),
                }
            )
            return {
                "success": True,
                "message": f"{plan.replace('service_', '').capitalize()} Plan activated!",
            }

        elif payment_type == "reel_boost":
            # Handle Reel Boost payment verification
            days = int(payment.get("subscription_months", 1))
            listing_id = payment.get("listing_id")

            boost_expiry = datetime.now(timezone.utc) + timedelta(days=days)

            if listing_id:
                await db.listings.update_one(
                    {"id": listing_id},
                    {
                        "$set": {
                            "status": ListingStatus.BOOSTED.value,
                            "boost_expires": boost_expiry.isoformat(),
                            "featured": True,
                        }
                    },
                )

            return {"success": True, "message": f"Reel boosted for {days} days!"}

        return {"success": True, "message": "Payment verified"}

    except razorpay.errors.SignatureVerificationError:
        logger.error(
            f"VERIFY ERROR: Signature mismatch for order {request.razorpay_order_id}"
        )
        raise HTTPException(
            status_code=400,
            detail="Security verification failed. Please contact support.",
        )
    except Exception as e:
        logger.error(f"VERIFY ERROR: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Professional error during verification. Please do not worry, your payment is recorded.",
        )

        return {"success": True, "message": "Payment verified"}

    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid payment signature")
    except Exception as e:
        logger.error(f"Payment verification failed: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Payment verification failed: {str(e)}"
        )


@api_router.get("/payments/config")
async def get_payment_config():
    """Get Razorpay configuration for frontend"""
    return {"key_id": RAZORPAY_KEY_ID, "enabled": bool(razorpay_client)}


# ============ NOTIFICATIONS API ============


@api_router.get("/notifications")
async def get_notifications(
    limit: int = Query(20, le=50),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Get user notifications"""
    user = await get_current_user(credentials)

    notifications = (
        await db.notifications.find({"user_id": user["id"]}, {"_id": 0})
        .sort("created_at", -1)
        .limit(limit)
        .to_list(limit)
    )

    for item in notifications:
        is_read = bool(item.get("read", item.get("is_read", False)))
        item["read"] = is_read
        item["is_read"] = is_read

    unread_count = await db.notifications.count_documents(
        {
            "user_id": user["id"],
            "$or": [{"read": False}, {"is_read": False}],
        }
    )

    return {"notifications": notifications, "unread_count": unread_count}


@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str, credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Mark notification as read"""
    user = await get_current_user(credentials)

    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": user["id"]},
        {"$set": {"read": True, "is_read": True}},
    )

    return {"success": result.modified_count > 0}


@api_router.put("/notifications/read-all")
async def mark_all_notifications_read(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Mark all notifications as read"""
    user = await get_current_user(credentials)

    result = await db.notifications.update_many(
        {"user_id": user["id"], "$or": [{"read": False}, {"is_read": False}]},
        {"$set": {"read": True, "is_read": True}},
    )

    return {"success": True, "count": result.modified_count}


# ============ AI PROPERTY RECOMMENDATION ============
def _recommendation_cache_key(user_id: str, limit: int) -> str:
    return f"recommendations:v3:{user_id}:{limit}"


async def _get_cached_recommendations_payload(
    cache_key: str,
) -> Optional[Dict[str, Any]]:
    if not redis_client:
        return None
    try:
        cached = await redis_client.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        return None
    return None


async def _set_cached_recommendations_payload(
    cache_key: str, payload: Dict[str, Any]
) -> None:
    if not redis_client:
        return
    try:
        await redis_client.set(
            cache_key, json.dumps(payload), ex=RECOMMENDATIONS_CACHE_TTL_SECONDS
        )
    except Exception:
        return


async def _clear_user_recommendation_cache(user_id: str) -> None:
    if not redis_client:
        return
    try:
        keys = await redis_client.keys(f"recommendations:v3:{user_id}:*")
        if keys:
            await redis_client.delete(*keys)
    except Exception:
        return


def _normalize_city_name(city: Optional[str]) -> str:
    return str(city or "").strip().lower()


def _compute_preferred_price_window(prices: List[float]) -> Optional[Dict[str, float]]:
    cleaned = [float(p) for p in prices if isinstance(p, (int, float)) and float(p) > 0]
    if not cleaned:
        return None
    cleaned.sort()
    median = cleaned[len(cleaned) // 2]
    return {
        "min": max(median * 0.65, 0),
        "max": median * 1.45,
        "median": median,
    }


async def _build_recommendation_payload(user_id: str, limit: int) -> Dict[str, Any]:
    search_history = (
        await db.search_history.find(
            {"user_id": user_id},
            {"_id": 0, "query": 1, "category": 1, "city": 1, "created_at": 1},
        )
        .sort("created_at", -1)
        .limit(60)
        .to_list(60)
    )

    interactions = (
        await db.interactions.find(
            {"user_id": user_id},
            {
                "_id": 0,
                "listing_id": 1,
                "action": 1,
                "city": 1,
                "category": 1,
                "price": 1,
                "created_at": 1,
            },
        )
        .sort("created_at", -1)
        .limit(300)
        .to_list(300)
    )

    wishlist_docs = await db.wishlists.find(
        {"user_id": user_id},
        {"_id": 0, "listing_id": 1},
    ).to_list(500)
    wishlist_ids = {
        doc.get("listing_id") for doc in wishlist_docs if doc.get("listing_id")
    }

    action_weights = {
        "view": 1.0,
        "search": 1.5,
        "map_marker_click": 1.7,
        "map_card_click": 2.1,
        "detail_view": 2.6,
        "wishlist_add": 3.0,
        "contact_reveal": 3.2,
    }

    category_counter: Counter = Counter()
    city_counter: Counter = Counter()
    viewed_listing_ids: Counter = Counter()
    observed_prices: List[float] = []

    for row in interactions:
        weight = action_weights.get(str(row.get("action") or "").strip(), 0.75)
        listing_id = row.get("listing_id")
        if listing_id:
            viewed_listing_ids[listing_id] += weight
        category = str(row.get("category") or "").strip().lower()
        city = _normalize_city_name(row.get("city"))
        if category:
            category_counter[category] += weight
        if city:
            city_counter[city] += weight
        price = row.get("price")
        if isinstance(price, (int, float)) and float(price) > 0:
            observed_prices.append(float(price))

    for row in search_history:
        category = str(row.get("category") or "").strip().lower()
        city = _normalize_city_name(row.get("city"))
        if category:
            category_counter[category] += 1.15
        if city:
            city_counter[city] += 1.1

    preferred_categories = [entry[0] for entry in category_counter.most_common(4)]
    preferred_cities = [entry[0] for entry in city_counter.most_common(4)]
    preferred_price_window = _compute_preferred_price_window(observed_prices)

    listing_query: Dict[str, Any] = {
        "status": {"$in": [ListingStatus.APPROVED.value, ListingStatus.BOOSTED.value]},
        "is_available": True,
    }
    if preferred_categories:
        listing_query["category"] = {"$in": preferred_categories}

    candidates = (
        await db.listings.find(
            listing_query,
            {
                "_id": 0,
                "id": 1,
                "title": 1,
                "category": 1,
                "city": 1,
                "location": 1,
                "price": 1,
                "views": 1,
                "likes": 1,
                "listing_type": 1,
                "images": 1,
                "latitude": 1,
                "longitude": 1,
                "created_at": 1,
            },
        )
        .limit(400)
        .to_list(400)
    )

    scored = []
    for listing in candidates:
        listing_id = listing.get("id")
        if not listing_id or listing_id in wishlist_ids:
            continue

        score = 0.0
        category = str(listing.get("category") or "").strip().lower()
        city = _normalize_city_name(listing.get("city"))
        price = float(listing.get("price") or 0)

        score += min(float(listing.get("views") or 0) / 3000.0, 2.5)
        score += min(float(listing.get("likes") or 0) / 700.0, 2.0)
        score += listing_boost_score(listing) * 0.75
        score += listing_freshness_score(listing) * 1.25

        if category and category_counter.get(category):
            score += min(category_counter[category], 8.0)
        if city and city_counter.get(city):
            score += min(city_counter[city], 8.0)

        if preferred_price_window and price > 0:
            if preferred_price_window["min"] <= price <= preferred_price_window["max"]:
                score += 2.2
            elif (
                abs(price - preferred_price_window["median"])
                / preferred_price_window["median"]
                < 0.25
            ):
                score += 1.2

        if viewed_listing_ids.get(listing_id):
            score -= min(viewed_listing_ids[listing_id] * 0.5, 2.0)

        listing["_recommendation_score"] = round(score, 3)
        scored.append((score, listing))

    scored.sort(key=lambda item: item[0], reverse=True)
    recommendations = [item[1] for item in scored[: max(limit, 1)]]

    category_reason = preferred_categories[:2]
    city_reason = preferred_cities[:2]
    reason_parts = []
    if category_reason:
        reason_parts.append(f"categories: {', '.join(category_reason)}")
    if city_reason:
        reason_parts.append(f"cities: {', '.join(city_reason)}")
    if preferred_price_window:
        reason_parts.append("price affinity")

    explanation = "Recommendations tuned from your recent behavior"
    if reason_parts:
        explanation = f"Recommendations tuned from {', '.join(reason_parts)}"

    return {
        "recommendations": recommendations,
        "ai_explanation": explanation,
        "context": {
            "categories": preferred_categories,
            "cities": preferred_cities,
            "price_window": preferred_price_window,
            "interaction_samples": len(interactions),
            "search_samples": len(search_history),
        },
        "total": len(recommendations),
    }


@api_router.post("/recommendations/track")
async def track_recommendation_interaction(
    event: RecommendationInteractionEvent,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    user = await get_current_user(credentials)

    action = event.action.strip().lower()
    if action not in RECOMMENDATION_ALLOWED_ACTIONS:
        raise HTTPException(status_code=400, detail="Unsupported interaction action")

    now_iso = datetime.now(timezone.utc).isoformat()
    normalized = normalize_search_query(event.query or "") if event.query else None

    payload = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "listing_id": (event.listing_id or "").strip() or None,
        "action": action,
        "source": (event.source or "").strip() or "frontend",
        "query": (event.query or "").strip() or None,
        "city": (event.city or "").strip().lower() or None,
        "category": (event.category or "").strip().lower() or None,
        "price": event.price,
        "metadata": event.metadata or {},
        "created_at": now_iso,
    }

    if normalized:
        payload["normalized_query"] = normalized.get("normalized_query")
        payload["detected_language"] = normalized.get("detected_language")
        if not payload["category"] and normalized.get("detected_category"):
            payload["category"] = normalized.get("detected_category")

    await db.interactions.insert_one(payload)

    if action == "search" and payload.get("query"):
        await db.search_history.insert_one(
            {
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "query": payload["query"],
                "normalized_query": payload.get(
                    "normalized_query", payload["query"].lower()
                ),
                "language": payload.get("detected_language", "en"),
                "city": payload.get("city"),
                "category": payload.get("category"),
                "source": payload.get("source", "frontend"),
                "created_at": now_iso,
            }
        )

    await _clear_user_recommendation_cache(user["id"])
    return {"ok": True}


@api_router.get("/recommendations")
async def get_ai_recommendations(
    limit: int = Query(6, ge=1, le=20),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Get recommendation results based on user behavior, search signals, and listing similarity."""
    user = await get_current_user(credentials)
    user_id = user["id"]
    cache_key = _recommendation_cache_key(user_id, limit)

    cached = await _get_cached_recommendations_payload(cache_key)
    if cached:
        return cached

    payload = await _build_recommendation_payload(user_id=user_id, limit=limit)
    await _set_cached_recommendations_payload(cache_key, payload)
    return payload


@api_router.get("/recommendations/similar/{listing_id}")
async def get_similar_properties(listing_id: str, limit: int = Query(4, le=8)):
    """Get similar properties to a given listing"""
    # Get the source listing
    listing = await db.listings.find_one({"id": listing_id}, {"_id": 0})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    # Find similar listings (same category, similar price range, same city)
    price = listing.get("price", 0)
    price_min = price * 0.7
    price_max = price * 1.3

    similar = (
        await db.listings.find(
            {
                "id": {"$ne": listing_id},
                "category": listing.get("category"),
                "city": listing.get("city"),
                "price": {"$gte": price_min, "$lte": price_max},
                "status": "approved",
            },
            {"_id": 0},
        )
        .limit(limit)
        .to_list(limit)
    )

    # If not enough, relax constraints
    if len(similar) < limit:
        more = (
            await db.listings.find(
                {
                    "id": {"$ne": listing_id},
                    "category": listing.get("category"),
                    "status": "approved",
                },
                {"_id": 0},
            )
            .limit(limit - len(similar))
            .to_list(limit - len(similar))
        )
        similar.extend(more)

    return {
        "similar": similar[:limit],
        "based_on": {
            "category": listing.get("category"),
            "city": listing.get("city"),
            "price_range": f"₹{int(price_min):,} - ₹{int(price_max):,}",
        },
    }


# ============ BOOST LISTING FEATURE ============
BOOST_PRICES = {
    "7_days": 9900,  # ₹99
    "15_days": 17900,  # ₹179
    "30_days": 29900,  # ₹299
}


class BoostRequest(BaseModel):
    listing_id: str
    duration: str = Field(..., description="7_days, 15_days, or 30_days")


@api_router.post("/listings/boost/create-order")
async def create_boost_order(
    request: BoostRequest, credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Create Razorpay order for boosting a listing"""
    user = await get_current_user(credentials)

    # Verify listing belongs to user
    listing = await db.listings.find_one(
        {"id": request.listing_id, "owner_id": user["id"]}
    )
    if not listing:
        raise HTTPException(
            status_code=404, detail="Listing not found or not owned by you"
        )

    if request.duration not in BOOST_PRICES:
        raise HTTPException(status_code=400, detail="Invalid boost duration")

    amount = BOOST_PRICES[request.duration]
    days = int(request.duration.split("_")[0])

    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Payment gateway not configured")

    try:
        order_data = {
            "amount": amount,
            "currency": "INR",
            "receipt": f"boost_{uuid.uuid4().hex[:12]}",
            "notes": {
                "user_id": user["id"],
                "listing_id": request.listing_id,
                "type": "boost",
                "duration": request.duration,
            },
        }

        order = razorpay_client.order.create(data=order_data)

        boost_record = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "listing_id": request.listing_id,
            "razorpay_order_id": order["id"],
            "amount": amount,
            "duration": request.duration,
            "days": days,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        await db.boosts.insert_one(boost_record)

        return {
            "order_id": order["id"],
            "amount": amount,
            "currency": "INR",
            "key_id": RAZORPAY_KEY_ID,
            "boost_id": boost_record["id"],
            "listing_title": listing.get("title"),
            "duration": f"{days} days",
            "price": f"₹{amount // 100}",
        }

    except Exception as e:
        logger.error(f"Boost order creation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/listings/boost/verify")
async def verify_boost_payment(
    request: PaymentVerifyRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Verify boost payment and activate boost"""
    user = await get_current_user(credentials)

    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Payment gateway not configured")

    try:
        # Verify signature
        razorpay_client.utility.verify_payment_signature(
            {
                "razorpay_order_id": request.razorpay_order_id,
                "razorpay_payment_id": request.razorpay_payment_id,
                "razorpay_signature": request.razorpay_signature,
            }
        )

        # Get boost record
        boost = await db.boosts.find_one(
            {"razorpay_order_id": request.razorpay_order_id}
        )
        if not boost:
            raise HTTPException(status_code=404, detail="Boost record not found")

        # Calculate expiry
        days = boost["days"]
        expires_at = datetime.now(timezone.utc) + timedelta(days=days)

        # Update boost status
        await db.boosts.update_one(
            {"id": boost["id"]},
            {
                "$set": {
                    "status": "active",
                    "razorpay_payment_id": request.razorpay_payment_id,
                    "activated_at": datetime.now(timezone.utc).isoformat(),
                    "expires_at": expires_at.isoformat(),
                }
            },
        )

        # Update listing with boost flag
        await db.listings.update_one(
            {"id": boost["listing_id"]},
            {"$set": {"is_boosted": True, "boost_expires_at": expires_at.isoformat()}},
        )

        return {
            "success": True,
            "message": f"Listing boosted for {days} days!",
            "boost": {
                "listing_id": boost["listing_id"],
                "expires_at": expires_at.isoformat(),
                "days_remaining": days,
            },
        }

    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid payment signature")
    except Exception as e:
        logger.error(f"Boost verification failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/listings/{listing_id}/boost-status")
async def get_boost_status(
    listing_id: str, credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get boost status for a listing"""
    user = await get_current_user(credentials)

    listing = await db.listings.find_one(
        {"id": listing_id, "owner_id": user["id"]}, {"_id": 0}
    )
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    is_boosted = listing.get("is_boosted", False)
    boost_expires_at = listing.get("boost_expires_at")

    if is_boosted and boost_expires_at:
        expires = datetime.fromisoformat(boost_expires_at.replace("Z", "+00:00"))
        if expires < datetime.now(timezone.utc):
            # Boost expired, update listing
            await db.listings.update_one(
                {"id": listing_id}, {"$set": {"is_boosted": False}}
            )
            is_boosted = False

    return {
        "is_boosted": is_boosted,
        "expires_at": boost_expires_at if is_boosted else None,
        "prices": {"7_days": "₹99", "15_days": "₹179", "30_days": "₹299"},
    }


# ============ SERVICE PROVIDER SUBSCRIPTION ============
SUBSCRIPTION_AMOUNT = 25100  # ₹251 in paise


class SubscriptionRequest(BaseModel):
    plan: str = Field("monthly", description="Subscription plan: monthly")


class CouponValidateRequest(BaseModel):
    coupon: str


@api_router.post("/subscriptions/create-order")
async def create_subscription_order(
    request: SubscriptionRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Create Razorpay order for subscription-based owner roles"""
    user = await get_current_user(credentials)
    role = user.get("role")  # Already normalized in get_current_user

    if role not in SUBSCRIPTION_ROLES:
        raise HTTPException(
            status_code=403,
            detail=f"Only owners and service providers can subscribe. Current role: {role}",
        )

    if not razorpay_client:
        logger.error(
            "RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is missing from environment variables"
        )
        raise HTTPException(status_code=500, detail="Payment gateway not configured")

    # Fetch dynamic subscription amount from settings
    settings = await db.settings.find_one({"id": "platform_config"})
    subscription_amount = SUBSCRIPTION_AMOUNT_PAISE

    plan = request.plan.lower()
    if plan == SubscriptionPlan.BASIC.value:
        subscription_amount = STAY_EVENT_BASIC_SUB_PAISE
    elif plan == SubscriptionPlan.PRO.value:
        subscription_amount = STAY_EVENT_PRO_SUB_PAISE
    elif plan == SubscriptionPlan.UNLIMITED.value:
        subscription_amount = SUBSCRIPTION_AMOUNT_PAISE
    elif plan == SubscriptionPlan.SERVICE_BASIC.value:
        subscription_amount = SERVICE_BASIC_SUB_PAISE
    elif plan == SubscriptionPlan.SERVICE_VERIFIED.value:
        subscription_amount = SERVICE_VERIFIED_SUB_PAISE
    elif plan == SubscriptionPlan.SERVICE_TOP.value:
        subscription_amount = SERVICE_TOP_SUB_PAISE

    if settings and "global_config" in settings:
        # Fallback to global if specific plan amounts aren't in settings
        pass

    try:
        order_data = {
            "amount": subscription_amount,
            "currency": "INR",
            "receipt": f"sub_{uuid.uuid4().hex[:12]}",
            "notes": {"user_id": user["id"], "type": "subscription", "plan": plan},
        }

        order = razorpay_client.order.create(data=order_data)

        subscription_record = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "razorpay_order_id": order["id"],
            "amount": subscription_amount,
            "plan": plan,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        await db.subscriptions.insert_one(subscription_record)

        return {
            "order_id": order["id"],
            "amount": subscription_amount,
            "currency": "INR",
            "key_id": RAZORPAY_KEY_ID,
            "subscription_id": subscription_record["id"],
            "plan_details": {
                "name": f"{plan.capitalize()} Subscription",
                "price": f"₹{subscription_amount // 100}/month",
                "features": [
                    "Featured placement"
                    if plan == SubscriptionPlan.PRO.value
                    else "Normal visibility",
                    "Unlimited properties and services"
                    if plan == SubscriptionPlan.PRO.value
                    else f"Up to {BASIC_PLAN_LISTING_LIMIT} listings",
                    "Verified badge",
                    "Analytics dashboard",
                    "Direct customer inquiries",
                ],
            },
        }

    except Exception as e:
        logger.error(f"Subscription order creation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/subscriptions/coupon/validate")
async def validate_subscription_coupon(body: CouponValidateRequest):
    code = body.coupon.strip().upper()
    coupon = VALID_COUPONS.get(code)
    if not coupon:
        raise HTTPException(status_code=400, detail="Invalid coupon code")
    return {
        "valid": True,
        "code": code,
        "benefit": f"First {coupon['free_months']} months FREE",
        "free_months": coupon["free_months"],
    }


@api_router.post("/subscriptions/verify")
async def verify_subscription_payment(
    request: PaymentVerifyRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Verify subscription payment and activate subscription"""
    user = await get_current_user(credentials)
    user_id = user.get("id")
    email = user.get("email")

    logger.info(f"PAYMENT VERIFY START: User={email} ({user_id}), Order={request.razorpay_order_id}")

    if not razorpay_client:
        logger.error("PAYMENT VERIFY ERROR: Razorpay client not configured")
        raise HTTPException(status_code=500, detail="Payment gateway not configured")

    try:
        # Verify signature
        logger.info(f"PAYMENT VERIFY: Verifying signature for order {request.razorpay_order_id}")
        razorpay_client.utility.verify_payment_signature(
            {
                "razorpay_order_id": request.razorpay_order_id,
                "razorpay_payment_id": request.razorpay_payment_id,
                "razorpay_signature": request.razorpay_signature,
            }
        )
        logger.info(f"PAYMENT VERIFY: Signature valid for order {request.razorpay_order_id}")

        # Update subscription status
        subscription = await db.subscriptions.find_one(
            {"razorpay_order_id": request.razorpay_order_id}
        )
        if not subscription:
            logger.error(f"PAYMENT VERIFY ERROR: Subscription record not found for order {request.razorpay_order_id}")
            raise HTTPException(status_code=404, detail="Subscription not found")

        now = datetime.now(timezone.utc)
        expiry_date = compute_next_billing_date(now)

        logger.info(f"PAYMENT VERIFY: Updating subscription {subscription['id']} to active")
        sub_update = await db.subscriptions.update_one(
            {"id": subscription["id"]},
            {
                "$set": {
                    "status": "active",
                    "razorpay_payment_id": request.razorpay_payment_id,
                    "activated_at": now.isoformat(),
                    "expires_at": expiry_date.isoformat(),
                }
            },
        )
        logger.info(f"PAYMENT VERIFY: Subscription update result: modified={sub_update.modified_count}")

        # Update user subscription status
        plan = subscription.get("plan", SubscriptionPlan.BASIC.value)
        is_featured = plan in {
            SubscriptionPlan.PRO.value,
            SubscriptionPlan.UNLIMITED.value,
            SubscriptionPlan.SERVICE_TOP.value,
        }

        # CRITICAL FIX: First refresh user data from DB to get latest subscription status
        fresh_user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not fresh_user:
            logger.error(f"PAYMENT VERIFY ERROR: User {user_id} not found in DB during verification")
            raise HTTPException(status_code=404, detail="User not found")

        logger.info(f"PAYMENT VERIFY: Updating user {email} status to active, plan={plan}")
        user_update = await db.users.update_one(
            {"id": user_id},
            {
                "$set": {
                    "subscription": "active",
                    "subscription_status": "active",
                    "subscription_plan": plan,
                    "subscription_expires": expiry_date.isoformat(),
                    "next_billing_date": expiry_date.isoformat(),
                    "last_payment_date": now.isoformat(),
                    "subscription_start_date": fresh_user.get("subscription_start_date") or now.isoformat(),
                    "block_status": None,
                    "block_until": None,
                    "auto_renew": True,
                }
            },
        )
        logger.info(f"PAYMENT VERIFY: User update result: modified={user_update.modified_count}")

        # Update all owner's listings visibility based on the plan
        logger.info(f"PAYMENT VERIFY: Updating visibility for all listings of owner {user_id}")
        listings_update = await db.listings.update_many(
            {"owner_id": user_id},
            {
                "$set": {
                    "subscription_plan": plan,
                    "featured": is_featured,
                    "status": "approved",
                    "payment_required": None,
                    "fee_amount_paise": None,
                }
            },
        )
        logger.info(f"PAYMENT VERIFY: Listings update result: modified={listings_update.modified_count}")

        # Approve any listings that were awaiting payment
        await db.listings.update_many(
            {"owner_id": user_id, "status": "awaiting_payment"},
            {"$set": {"status": "approved"}},
        )

        # Notify user of successful activation
        await create_system_notification(
            user_id=user_id,
            title="Subscription Activated!",
            message=f"Your {plan.replace('_', ' ').capitalize()} plan is now active. Thank you for your payment!",
            type="success",
            link="/owner/dashboard",
        )

        # Return a guaranteed-active status directly (avoids read-after-write race condition
        # that could occur if get_subscription_status re-fetches before DB propagates)
        logger.info(f"PAYMENT VERIFY SUCCESS: Returning active status for {email}")

        return {
            "success": True,
            "message": "Subscription activated successfully!",
            "subscription": {
                "status": "active",
                "has_subscription": True,
                "subscription_plan": plan,
                "model": "subscription",
                "next_billing_date": expiry_date.isoformat(),
                "last_payment_date": now.isoformat(),
                "price": f"₹{subscription.get('amount', SUBSCRIPTION_AMOUNT_PAISE) // 100}/month",
                "amount_monthly": f"₹{subscription.get('amount', SUBSCRIPTION_AMOUNT_PAISE) // 100}",
            },
        }

    except razorpay.errors.SignatureVerificationError:
        logger.error(f"PAYMENT VERIFY ERROR: Invalid signature for order {request.razorpay_order_id}")
        raise HTTPException(status_code=400, detail="Invalid payment signature")
    except Exception as e:
        logger.error(f"PAYMENT VERIFY CRITICAL ERROR for user {email}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@api_router.put("/subscriptions/auto-renew")
async def toggle_subscription_auto_renew(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    user = await get_current_user(credentials)

    if str(user.get("role") or "") not in SUBSCRIPTION_ROLES:
        raise HTTPException(
            status_code=403, detail="Subscription not applicable to your role"
        )

    current = bool(user.get("auto_renew", True))
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"auto_renew": not current}},
    )
    return {"auto_renew": not current}


@api_router.post("/subscriptions/self-repair")
async def self_repair_subscription(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    Self-service endpoint: any owner can call this to sync their subscription_status
    from the subscriptions collection into their user document.
    Called automatically by the frontend on login if status looks wrong.
    """
    user = await get_current_user(credentials)
    user_id = user.get("id")
    role = user.get("role")

    if role not in SUBSCRIPTION_ROLES:
        return {"repaired": False, "reason": "role_not_applicable"}

    # Find the most recent active subscription record
    active_subs = await db.subscriptions.find(
        {"user_id": user_id, "status": "active"}
    ).sort("activated_at", -1).limit(1).to_list(1)

    if not active_subs:
        return {"repaired": False, "status": user.get("subscription_status", "pending")}

    sub = active_subs[0]
    plan = sub.get("plan", SubscriptionPlan.BASIC.value)
    expiry_date = sub.get("expires_at")

    await db.users.update_one(
        {"id": user_id},
        {
            "$set": {
                "subscription": "active",
                "subscription_status": "active",
                "subscription_plan": plan,
                "subscription_expires": expiry_date,
                "next_billing_date": expiry_date,
                "last_payment_date": sub.get("activated_at"),
                "block_status": None,
                "block_until": None,
            }
        },
    )

    # Also approve any listings that were awaiting payment
    await db.listings.update_many(
        {"owner_id": user_id, "status": {"$in": ["awaiting_payment", "pending"]}},
        {"$set": {"status": "approved"}},
    )

    logger.info(f"SELF-REPAIR: Fixed subscription for {user.get('email')} -> active, plan={plan}")
    return {
        "repaired": True,
        "status": "active",
        "subscription_plan": plan,
        "next_billing_date": expiry_date,
    }


@api_router.post("/admin/subscriptions/migrate-owners")
async def migrate_owner_subscriptions(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    ONE-TIME ADMIN MIGRATION: Fixes all existing owners in DB.
    - Normalizes role strings (e.g. 'Property Owner' -> 'property_owner')
    - Initializes missing subscription data (gives 5-month trial from their join date)
    - Resets owners stuck in bad states
    Run this once after deploying. Safe to run multiple times (idempotent).
    """
    admin_user = await get_current_user(credentials)
    if normalize_role(admin_user.get("role")) != UserRole.ADMIN.value:
        raise HTTPException(status_code=403, detail="Admin only")

    now = datetime.now(timezone.utc)
    results = {
        "normalized_roles": 0,
        "initialized_trials": 0,
        "already_ok": 0,
        "errors": [],
    }

    # Step 1: Normalize all role strings in the DB
    role_mapping = {
        "Property Owner": "property_owner",
        "Stay Owner": "stay_owner",
        "Service Provider": "service_provider",
        "Hotel Owner": "hotel_owner",
        "Event Owner": "event_owner",
    }
    for bad_role, good_role in role_mapping.items():
        update_result = await db.users.update_many(
            {"role": bad_role}, {"$set": {"role": good_role}}
        )
        if update_result.modified_count:
            results["normalized_roles"] += update_result.modified_count
            logger.info(
                f"Normalized {update_result.modified_count} users from '{bad_role}' to '{good_role}'"
            )

    # Step 2: Find all owners missing subscription data or stuck in bad states
    owner_cursor = db.users.find(
        {
            "role": {"$in": list(SUBSCRIPTION_ROLES)},
            "$or": [
                {"subscription_status": {"$exists": False}},
                {"subscription_status": None},
                {"subscription_status": ""},
            ],
        },
        {"_id": 0},
    )

    async for owner in owner_cursor:
        try:
            user_id = owner.get("id")
            role = normalize_role(owner.get("role"))
            if not user_id or role not in SUBSCRIPTION_ROLES:
                continue

            # Use their join date to calculate trial — they joined 5 months ago? trial may be ending soon
            join_date_str = owner.get("created_at")
            join_date = _parse_iso_datetime(join_date_str) or now
            trial_end = _add_months(join_date, 5)
            next_billing = trial_end.replace(
                day=1, hour=0, minute=0, second=0, microsecond=0
            )

            # If trial already expired from their join date, set status to expired so they can pay
            if trial_end <= now:
                sub_status = "expired"
                trial_months_remaining = 0
            else:
                sub_status = "trial"
                trial_months_remaining = max(0, round((trial_end - now).days / 30))

            init_doc = {
                "subscription_model": "subscription",
                "subscription_status": sub_status,
                "trial_months_remaining": trial_months_remaining,
                "trial_end_date": trial_end.isoformat(),
                "subscription_start_date": None,
                "next_billing_date": next_billing.isoformat(),
                "last_payment_date": None,
                "auto_renew": True,
                "coupon_used": "GRUVORA5",
                "block_status": None,
                "block_until": None,
                "subscription_amount_paise": SUBSCRIPTION_AMOUNT_PAISE,
            }

            if role in COMMISSION_ROLES:
                init_doc["subscription_model"] = "hybrid"
                init_doc["commission_rate"] = COMMISSION_RATE

            await db.users.update_one({"id": user_id}, {"$set": init_doc})
            results["initialized_trials"] += 1
            logger.info(
                f"Migrated owner {owner.get('email')} -> status={sub_status}, trial_end={trial_end.date()}"
            )

        except Exception as e:
            results["errors"].append({"user_id": owner.get("id"), "error": str(e)})

    # Step 3: Count how many are already OK
    ok_count = await db.users.count_documents(
        {
            "role": {"$in": list(SUBSCRIPTION_ROLES)},
            "subscription_status": {"$in": ["active", "trial", "expired", "pending"]},
        }
    )
    results["already_ok"] = ok_count - results["initialized_trials"]

    logger.info(f"Migration complete: {results}")
    return {
        "success": True,
        "message": "Migration complete. All existing owners have been fixed.",
        "results": results,
    }


@api_router.post("/admin/subscriptions/fix-user")
async def fix_user_subscription(
    request: Dict[str, Any],
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    Admin endpoint to manually fix a user's subscription status.
    Use this when a user has paid but subscription still shows as inactive.

    Body: { "user_id": "xxx", "status": "active" | "trial" | "expired" | "pending" }
    """
    admin_user = await get_current_user(credentials)
    if normalize_role(admin_user.get("role")) != UserRole.ADMIN.value:
        raise HTTPException(status_code=403, detail="Admin only")

    user_id = request.get("user_id")
    new_status = request.get("status", "active")

    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")

    target_user = await db.users.find_one({"id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    now = datetime.now(timezone.utc)
    expiry_date = _add_months(now, 1)

    update_doc = {
        "subscription_status": new_status,
        "last_payment_date": now.isoformat(),
        "next_billing_date": expiry_date.isoformat(),
        "block_status": None,
        "block_until": None,
        "auto_renew": True,
    }

    if new_status == "active":
        update_doc["subscription_start_date"] = now.isoformat()
        update_doc["subscription_expires"] = expiry_date.isoformat()

    await db.users.update_one({"id": user_id}, {"$set": update_doc})

    logger.info(f"Admin fixed subscription for user {user_id}: status={new_status}")

    return {
        "success": True,
        "message": f"Subscription status set to '{new_status}' for user {target_user.get('email')}",
        "user": {
            "email": target_user.get("email"),
            "role": target_user.get("role"),
            "subscription_status": new_status,
        },
    }


@api_router.get("/subscriptions/invoices")
async def get_subscription_invoices(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    user = await get_current_user(credentials)

    invoices = (
        await db.subscriptions.find(
            {"user_id": user["id"], "status": "active"},
            {"_id": 0},
        )
        .sort("paid_at", -1)
        .to_list(24)
    )

    return {"invoices": invoices}


@api_router.get("/subscriptions/status")
async def get_subscription_status(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Get current user's subscription status with auto-initialization for owners."""
    try:
        user = await get_current_user(credentials)
        user_id = user.get("id")
        email = user.get("email")
        role = user.get("role")
        
        logger.info(f"FETCH STATUS: User={email}, Role={role}")

        # 1. SELF-HEALING: Check if user has an active subscription record but status is not active in user doc
        if role in SUBSCRIPTION_ROLES and user.get("subscription_status") != "active":
            # Motor 3.x: find_one does NOT support sort= kwarg; use find().sort().limit(1)
            latest_active_sub = await db.subscriptions.find(
                {"user_id": user_id, "status": "active"}
            ).sort("activated_at", -1).limit(1).to_list(1)
            latest_active_sub = latest_active_sub[0] if latest_active_sub else None

            if latest_active_sub:
                logger.info(f"SELF-HEALING: Found active sub for {email}. Fixing status...")
                expiry_date = latest_active_sub.get("expires_at")
                plan = latest_active_sub.get("plan", SubscriptionPlan.BASIC.value)
                
                await db.users.update_one(
                    {"id": user_id},
                    {
                        "$set": {
                            "subscription": "active",
                            "subscription_status": "active",
                            "subscription_plan": plan,
                            "subscription_expires": expiry_date,
                            "next_billing_date": expiry_date,
                            "last_payment_date": latest_active_sub.get("activated_at"),
                            "block_status": None,
                            "block_until": None,
                        }
                    }
                )
                # Re-fetch updated user; fall back to patching in-memory if DB re-fetch fails
                refreshed = await db.users.find_one({"id": user_id}, {"_id": 0})
                if refreshed:
                    user = refreshed
                # Always ensure in-memory user reflects active status
                user["subscription_status"] = "active"
                user["subscription_plan"] = plan
                user["next_billing_date"] = expiry_date
                logger.info(f"SELF-HEALING COMPLETE: {email} is now active")

        # 2. Auto-initialize trial if missing
        if role in SUBSCRIPTION_ROLES and not user.get("subscription_status"):
            init_doc = build_subscription_init_doc(role=role)
            await db.users.update_one({"id": user_id}, {"$set": init_doc})
            user.update(init_doc)
            logger.info(f"AUTO-INIT: 5-month trial for {email}")

        # 3. Role-based Model Determination
        is_hybrid = role in COMMISSION_ROLES and role in SUBSCRIPTION_ROLES
        is_commission = role in COMMISSION_ROLES and not is_hybrid
        
        status = str(user.get("subscription_status") or "pending")
        has_active_sub = status in {"active", "trial"}

        # 4. Response Data Construction
        response_data = {
            "has_subscription": has_active_sub,
            "status": status,
            "model": "hybrid" if is_hybrid else ("commission" if is_commission else "subscription"),
            "role": role
        }

        # 5. Commission Details
        if role in COMMISSION_ROLES:
            pending_commission = await db.commissions.aggregate(
                [
                    {"$match": {"owner_id": user_id, "status": "pending"}},
                    {"$group": {"_id": None, "total": {"$sum": "$commission_amount"}}},
                ]
            ).to_list(1)
            pending_total = pending_commission[0]["total"] if pending_commission else 0
            response_data.update({
                "commission_rate": f"{int(COMMISSION_RATE * 100)}%",
                "pending_commission_amount": pending_total,
                "commission_message": f"You pay {int(COMMISSION_RATE * 100)}% commission per confirmed deal.",
            })

        # 6. Subscription Details
        if role in SUBSCRIPTION_ROLES:
            settings = await db.settings.find_one({"id": "platform_config"})
            subscription_amount = SUBSCRIPTION_AMOUNT_PAISE
            basic_fee = STAY_EVENT_BASIC_SUB_PAISE
            pro_fee = STAY_EVENT_PRO_SUB_PAISE
            
            if settings:
                global_config = settings.get("global_config", {})
                try:
                    subscription_amount = int(float(global_config.get("subscription_fee", 999.0)) * 100)
                except (ValueError, TypeError):
                    pass
            
            plan = user.get("subscription_plan", SubscriptionPlan.BASIC.value)
            plan_amount = basic_fee if plan == SubscriptionPlan.BASIC.value else pro_fee
            if role == UserRole.PROPERTY_OWNER.value:
                plan_amount = subscription_amount

            trial_days_remaining = None
            trial_end = user.get("trial_end_date")
            if status == "trial" and trial_end:
                trial_end_dt = _parse_iso_datetime(trial_end)
                if trial_end_dt:
                    trial_days_remaining = max(0, (trial_end_dt - datetime.now(timezone.utc)).days)

            response_data.update({
                "amount_monthly": f"₹{plan_amount // 100}",
                "trial_end_date": trial_end,
                "trial_days_remaining": trial_days_remaining,
                "next_billing_date": user.get("next_billing_date"),
                "last_payment_date": user.get("last_payment_date"),
                "subscription_plan": plan,
                "price": f"₹{plan_amount // 100}/month",
                "message": "Active subscription" if has_active_sub else "No active subscription",
                "features": [
                    "Featured placement" if plan == SubscriptionPlan.PRO.value else "Normal visibility",
                    "Unlimited listings" if plan == SubscriptionPlan.PRO.value or role == UserRole.PROPERTY_OWNER.value else "Limited listings",
                    "Verified badge",
                    "Analytics dashboard",
                    "Direct customer inquiries",
                ]
            })

        return response_data
    except Exception as e:
        logger.error(f"CRITICAL: get_subscription_status failed for {credentials.credentials[:10]}...: {e}", exc_info=True)
        # Professional fallback to prevent 500 error and allow UI to handle it gracefully
        return {
            "has_subscription": False,
            "status": "pending",
            "model": "subscription",
            "error": str(e),
        }


# ============ RATE LIMITING MIDDLEWARE ============
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

WAF_SKIP_PATH_PREFIXES = (
    "/api/health",
    "/api/docs",
    "/api/openapi.json",
    "/socket.io",
)
WAF_MAX_JSON_BODY_BYTES = int(os.environ.get("WAF_MAX_JSON_BODY_BYTES", "2097152"))
WAF_MAX_QUERY_LENGTH = int(os.environ.get("WAF_MAX_QUERY_LENGTH", "4096"))
WAF_ENFORCE_ALLOWLIST = (
    os.environ.get("WAF_ENFORCE_ALLOWLIST", "false").lower() == "true"
)
IP_ALLOWLIST = {
    ip.strip() for ip in os.environ.get("IP_ALLOWLIST", "").split(",") if ip.strip()
}
IP_DENYLIST = {
    ip.strip() for ip in os.environ.get("IP_DENYLIST", "").split(",") if ip.strip()
}
WAF_BLOCK_PATTERNS = [
    re.compile(r"<\s*script\b", re.IGNORECASE),
    re.compile(r"javascript\s*:", re.IGNORECASE),
    re.compile(r"on(?:error|load|click|mouseover)\s*=", re.IGNORECASE),
    re.compile(
        r"(?:\bunion\b\s+\bselect\b|\bdrop\b\s+\btable\b|\binsert\b\s+\binto\b)",
        re.IGNORECASE,
    ),
    re.compile(r"\b(or|and)\b\s+['\"]?\d+['\"]?\s*=\s*['\"]?\d+", re.IGNORECASE),
    re.compile(r"(\.\./|%2e%2e%2f|%252e%252e%252f)", re.IGNORECASE),
    re.compile(r"\b(select\s+.+\s+from)\b", re.IGNORECASE),
]


def _get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        # Use first client IP in chain: client, proxy1, proxy2
        return forwarded_for.split(",", 1)[0].strip() or "unknown"
    return request.client.host if request.client else "unknown"


def _matches_attack_pattern(value: str) -> bool:
    if not value:
        return False
    return any(pattern.search(value) for pattern in WAF_BLOCK_PATTERNS)


def _extract_user_id_for_rate_limit(request: Request) -> Optional[str]:
    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        return None

    token = normalize_auth_token(auth_header[7:])
    if not token:
        return None

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except Exception:
        return None

    user_id = payload.get("user_id")
    return str(user_id) if user_id else None


class WAFMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        path = request.url.path or ""
        path_lower = path.lower()
        client_ip = _get_client_ip(request)

        if path_lower.startswith(WAF_SKIP_PATH_PREFIXES):
            return await call_next(request)

        if client_ip in IP_DENYLIST:
            logger.warning("WAF blocked denylisted ip=%s path=%s", client_ip, path)
            return JSONResponse(
                status_code=403,
                content={"detail": "Access denied."},
            )

        if WAF_ENFORCE_ALLOWLIST and IP_ALLOWLIST and client_ip not in IP_ALLOWLIST:
            logger.warning("WAF blocked non-allowlisted ip=%s path=%s", client_ip, path)
            return JSONResponse(
                status_code=403,
                content={"detail": "Access denied."},
            )

        query = request.url.query or ""
        if len(query) > WAF_MAX_QUERY_LENGTH:
            return JSONResponse(
                status_code=413,
                content={"detail": "Query string too large."},
            )

        combined_path_query = f"{path}?{query}"
        if _matches_attack_pattern(combined_path_query):
            logger.warning(
                "WAF blocked request path/query from ip=%s path=%s", client_ip, path
            )
            return JSONResponse(
                status_code=403,
                content={"detail": "Request blocked by security policy."},
            )

        content_type = (request.headers.get("content-type") or "").lower()

        if "application/json" in content_type and request.method in {
            "POST",
            "PUT",
            "PATCH",
        }:
            body = await request.body()
            if len(body) > WAF_MAX_JSON_BODY_BYTES:
                return JSONResponse(
                    status_code=413,
                    content={"detail": "Request body too large."},
                )

            body_text = body.decode("utf-8", errors="ignore")
            if _matches_attack_pattern(body_text):
                logger.warning(
                    "WAF blocked request body from ip=%s path=%s", client_ip, path
                )
                return JSONResponse(
                    status_code=403,
                    content={"detail": "Request blocked by security policy."},
                )

        return await call_next(request)


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_requests: int = 120, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: Dict[str, List[datetime]] = defaultdict(list)

    def _resolve_policy(self, path: str) -> Tuple[str, int, int]:
        # route_key, max_requests, window_seconds
        if path.startswith("/api/auth/"):
            return "auth", 20, 60
        if path.startswith("/api/videos/upload"):
            return "upload", 10, 60
        if path.startswith("/api/subscriptions/verify"):
            return "payment", 15, 60
        if path.startswith("/api/chat"):
            return "chat", 60, 60
        return "default", self.max_requests, self.window_seconds

    def _resolve_subject(self, request: Request) -> Tuple[str, str]:
        user_id = _extract_user_id_for_rate_limit(request)
        if user_id:
            return f"user:{user_id}", "user"
        return f"ip:{_get_client_ip(request)}", "ip"

    async def dispatch(self, request, call_next):
        path = request.url.path
        if path == "/api/health" or path.startswith("/socket.io"):
            return await call_next(request)

        route_key, route_limit, route_window = self._resolve_policy(path)
        subject_key, subject_type = self._resolve_subject(request)
        bucket = f"{subject_key}:{route_key}"

        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(seconds=route_window)

        self._requests[bucket] = [t for t in self._requests[bucket] if t > cutoff]

        used = len(self._requests[bucket])
        remaining = max(0, route_limit - used)

        if used >= route_limit:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please slow down."},
                headers={
                    "Retry-After": str(route_window),
                    "X-RateLimit-Limit": str(route_limit),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Window": str(route_window),
                    "X-RateLimit-Scope": subject_type,
                },
            )

        self._requests[bucket].append(now)
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(route_limit)
        response.headers["X-RateLimit-Remaining"] = str(max(0, remaining - 1))
        response.headers["X-RateLimit-Window"] = str(route_window)
        response.headers["X-RateLimit-Scope"] = subject_type
        return response


app.add_middleware(RateLimitMiddleware, max_requests=120, window_seconds=60)
app.add_middleware(WAFMiddleware)

# Include the router in the main app


# ============ SECURITY HEADERS MIDDLEWARE ============
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)

        csp = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "media-src 'self' https://res.cloudinary.com; "
            "connect-src 'self' https://gruvora.com https://www.gruvora.com "
            "https://api.gruvora.com "
            "https://gruvora-living-production.up.railway.app wss:; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        )

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=()"
        response.headers["Content-Security-Policy"] = csp
        # Cross-Origin-Opener-Policy: same-origin can break popups and cross-site navigations.
        # Relaxing it to 'same-origin-allow-popups' if needed, or keeping 'same-origin' if safe.
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups"
        response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains; preload"
            )
        return response


app.add_middleware(SecurityHeadersMiddleware)

# CORS configuration added LAST to be the outermost middleware (handling responses from all other middlewares).
default_origins = [
    "https://gruvora.com",
    "https://www.gruvora.com",
    "https://api.gruvora.com",
    "https://gruvora-living-ewir9bpkg-rahul11738s-projects.vercel.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://www.gruvora.com/",
    "https://gruvora.com/",
]
env_origins = [
    o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()
]
origins = list(dict.fromkeys(default_origins + env_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://([a-z0-9-]+\.)?gruvora\.com|https://.*\.vercel\.app|https://.*\.up\.railway\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(api_router)

# ============ SOCKET.IO EVENT HANDLERS ============


@sio.event
async def connect(sid, environ):
    logger.info(f"Socket.IO client connected: {sid}")


@sio.event
async def disconnect(sid):
    # Remove user from connected users
    user_id = None
    for uid, s in list(connected_users.items()):
        if s == sid:
            user_id = uid
            del connected_users[uid]
            break
    if user_id and redis_client:
        try:
            await redis_client.delete(f"active_user:{user_id}")
        except Exception:
            logger.warning("Failed to clear active user key for %s", user_id)
    logger.info(f"Socket.IO client disconnected: {sid}, user: {user_id}")


@sio.event
async def authenticate(sid, data):
    """Authenticate user with JWT token"""
    try:
        token = normalize_auth_token((data or {}).get("token"))
        if not token:
            await sio.emit("auth_error", {"message": "Token required"}, to=sid)
            await sio.disconnect(sid)
            return

        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")

        if user_id:
            connected_users[user_id] = sid
            await sio.enter_room(sid, f"user_{user_id}")
            if redis_client:
                try:
                    await redis_client.set(f"active_user:{user_id}", "online", ex=300)
                except Exception:
                    logger.warning("Failed to mark active user key for %s", user_id)
            await sio.emit("authenticated", {"user_id": user_id}, to=sid)
            logger.info(f"User {user_id} authenticated on socket {sid}")

            # Send any unread notifications
            notifications = (
                await db.notifications.find(
                    {
                        "user_id": user_id,
                        "$or": [{"read": False}, {"is_read": False}],
                    }
                )
                .sort("created_at", -1)
                .limit(10)
                .to_list(10)
            )

            for notif in notifications:
                notif["_id"] = str(notif["_id"])

            if notifications:
                await sio.emit(
                    "unread_notifications",
                    {"notifications": notifications, "count": len(notifications)},
                    to=sid,
                )
        else:
            await sio.emit("auth_error", {"message": "Invalid token payload"}, to=sid)
            await sio.disconnect(sid)
    except jwt.ExpiredSignatureError:
        await sio.emit("auth_error", {"message": "Token expired"}, to=sid)
        await sio.disconnect(sid)
    except jwt.InvalidTokenError as e:
        # Client token issues are expected (stale login, rotated secret); avoid server error noise.
        logger.warning(f"Socket auth invalid token on sid={sid}: {e}")
        await sio.emit("auth_error", {"message": "Invalid token"}, to=sid)
        await sio.disconnect(sid)
    except Exception as e:
        logger.error(f"Socket auth error: {e}")
        await sio.emit("auth_error", {"message": "Authentication failed"}, to=sid)
        await sio.disconnect(sid)


@sio.event
async def mark_notification_read(sid, data):
    """Mark notification as read"""
    notification_id = data.get("notification_id")
    if notification_id:
        await db.notifications.update_one(
            {"id": notification_id}, {"$set": {"read": True, "is_read": True}}
        )
        await sio.emit(
            "notification_marked_read", {"notification_id": notification_id}, to=sid
        )


@sio.event
async def join_chat(sid, data):
    """Join a chat room"""
    payload = data or {}
    chat_id = payload.get("chat_id")
    conversation_id = payload.get("conversation_id")
    if chat_id:
        await sio.enter_room(sid, f"chat_{chat_id}")
        await sio.emit("joined_chat", {"chat_id": chat_id}, to=sid)
    if conversation_id:
        await sio.enter_room(sid, f"conversation_{conversation_id}")
        await sio.emit("joined_chat", {"conversation_id": conversation_id}, to=sid)


@sio.event
async def leave_chat(sid, data):
    """Leave a chat room"""
    payload = data or {}
    chat_id = payload.get("chat_id")
    conversation_id = payload.get("conversation_id")
    if chat_id:
        await sio.leave_room(sid, f"chat_{chat_id}")
    if conversation_id:
        await sio.leave_room(sid, f"conversation_{conversation_id}")


@sio.event
async def typing(sid, data):
    payload = data or {}
    conversation_id = payload.get("conversation_id")
    user_id = payload.get("user_id")
    if not conversation_id or not user_id:
        return
    await sio.emit(
        "typing",
        {
            "conversation_id": conversation_id,
            "user_id": user_id,
            "is_typing": bool(payload.get("is_typing")),
        },
        room=f"conversation_{conversation_id}",
        skip_sid=sid,
    )


@sio.event
async def send_message(sid, data):
    """Send chat message"""
    chat_id = data.get("chat_id")
    message = data.get("message")
    sender_id = data.get("sender_id")

    if chat_id and message:
        # Save message to DB
        msg_doc = {
            "id": str(uuid.uuid4()),
            "chat_id": chat_id,
            "sender_id": sender_id,
            "message": message,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.messages.insert_one(msg_doc)

        # Broadcast to chat room
        await sio.emit("new_message", msg_doc, room=f"chat_{chat_id}")


# Helper function to send notifications
async def send_notification(
    user_id: str, notification_type: str, title: str, message: str, data: dict = None
):
    """Persist notification to DB then push it to the owner's socket room."""
    payload = data or {}
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": notification_type,
        "title": title,
        "message": message,
        "listing_id": payload.get("listing_id"),
        "listing_title": payload.get("listing_title", ""),
        "sender_id": payload.get("sender_id"),
        "conversation_id": payload.get("conversation_id"),
        "data": payload,
        "read": False,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.notifications.insert_one(notification)

    emit_payload = {k: v for k, v in notification.items() if k != "_id"}

    try:
        await sio.emit("notification", emit_payload, room=f"user_{user_id}")
        await sio.emit("new_notification", emit_payload, room=f"user_{user_id}")
        if user_id in connected_users:
            sid = connected_users[user_id]
            await sio.emit("notification", emit_payload, to=sid)
            await sio.emit("new_notification", emit_payload, to=sid)
    except Exception as exc:
        logger.warning("Socket emit failed for notification to %s: %s", user_id, exc)

    return emit_payload


# Mount Socket.IO on the app
socket_app = socketio.ASGIApp(sio, app)


async def startup_services():
    global redis_client, delete_worker_task
    if redis_asyncio and redis_url:
        try:
            redis_client = redis_asyncio.from_url(
                redis_url, encoding="utf-8", decode_responses=True
            )
            await redis_client.ping()
            logger.info("Redis rate limiter enabled")
        except Exception as e:
            redis_client = None
            logger.warning(f"Redis unavailable, using in-memory rate limiter: {e}")
    else:
        logger.warning("Redis client not configured, using in-memory rate limiter")

    await db.media_delete_jobs.create_index("id", unique=True)
    await db.media_delete_jobs.create_index([("status", 1), ("next_retry_at", 1)])
    await db.media_delete_jobs.create_index([("created_at", -1)])
    await db.admin_audit_logs.create_index("id", unique=True)
    await db.admin_audit_logs.create_index([("action", 1), ("created_at", -1)])
    await db.admin_audit_logs.create_index([("created_at", -1)])

    # Reels interaction indexes for duplicate prevention and high-write concurrency.
    await db.videos.create_index("id", unique=True)
    await db.videos.create_index([("created_at", -1)])
    await db.videos.create_index([("views", -1), ("created_at", -1)])
    await db.likes.create_index([("user_id", 1), ("reel_id", 1)], unique=True)
    await db.likes.create_index([("reel_id", 1), ("created_at", -1)])
    await db.follows.create_index(
        [("follower_id", 1), ("following_id", 1)], unique=True
    )
    await db.follows.create_index([("following_id", 1), ("created_at", -1)])
    await db.shares.create_index([("user_id", 1), ("reel_id", 1)], unique=True)
    await db.shares.create_index([("reel_id", 1), ("created_at", -1)])
    await db.views.create_index([("viewer_key", 1), ("reel_id", 1)], unique=True)
    await db.views.create_index([("user_id", 1), ("reel_id", 1)])
    await db.views.create_index([("ip", 1), ("reel_id", 1)])
    await db.views.create_index([("reel_id", 1), ("created_at", -1)])
    await db.debug_session_reports.create_index("id", unique=True)
    await db.debug_session_reports.create_index(
        [("type", 1), ("stress_session_id", 1), ("created_at", -1)]
    )
    await db.debug_session_reports.create_index([("user_id", 1), ("created_at", -1)])
    await db.users.create_index("id", unique=True)
    await db.users.create_index([("role", 1), ("created_at", -1)])
    await db.users.create_index([("aadhar_status", 1), ("role", 1)])
    await db.subscriptions.create_index("id", unique=True)
    await db.subscriptions.create_index(
        [("user_id", 1), ("billing_month", 1), ("status", 1)]
    )
    await db.subscriptions.create_index(
        [("razorpay_order_id", 1)], unique=True, sparse=True
    )
    await db.commissions.create_index("id", unique=True)
    await db.commissions.create_index(
        [("owner_id", 1), ("status", 1), ("created_at", -1)]
    )
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])

    from cron.billing_cron import setup_billing_scheduler

    setup_billing_scheduler()
    await db.users.create_index([("block_status", 1)])
    await db.users.create_index([("is_email_verified", 1), ("role", 1)])
    await db.users.create_index([("deleted", 1)])
    await db.conversations.create_index("id", unique=True)
    await db.conversations.create_index([("participants", 1), ("last_message_at", -1)])
    await db.conversations.create_index([("users", 1), ("last_message_at", -1)])
    await db.messages.create_index("id", unique=True)
    await db.messages.create_index([("conversation_id", 1), ("created_at", -1)])
    await db.messages.create_index(
        [("receiver_id", 1), ("read", 1), ("created_at", -1)]
    )
    await db.messages.create_index(
        [("listing_id", 1), ("owner_id", 1), ("created_at", -1)]
    )
    await db.notifications.create_index("id", unique=True)
    await db.notifications.create_index(
        [("user_id", 1), ("read", 1), ("created_at", -1)]
    )
    await db.notifications.create_index([("sent_by_admin", 1), ("created_at", -1)])
    await db.interactions.create_index("id", unique=True)
    await db.interactions.create_index([("user_id", 1), ("created_at", -1)])
    await db.interactions.create_index(
        [("user_id", 1), ("action", 1), ("created_at", -1)]
    )
    await db.interactions.create_index(
        [("listing_id", 1), ("created_at", -1)], sparse=True
    )
    await db.search_history.create_index("id", unique=True)
    await db.search_history.create_index([("user_id", 1), ("created_at", -1)])
    await db.search_history.create_index(
        [("user_id", 1), ("city", 1), ("category", 1), ("created_at", -1)]
    )
    await db.wishlists.create_index([("user_id", 1), ("listing_id", 1)], unique=True)

    # Search-related indexes for smart query filters and fast suggestions.
    await db.listings.create_index(
        [("status", 1), ("is_available", 1), ("city", 1), ("category", 1)]
    )
    await db.listings.create_index([("status", 1), ("created_at", -1)])
    await db.listings.create_index([("owner_id", 1), ("status", 1)])
    await db.listings.create_index([("category", 1), ("status", 1)])
    await db.listings.create_index([("removed_by_admin", 1)])
    await db.listings.create_index([("title", 1)])
    await db.listings.create_index([("sub_category", 1)])
    await db.listings.create_index([("location", 1)])
    await db.listings.create_index([("title_en", 1)], sparse=True)
    await db.listings.create_index([("title_gu", 1)], sparse=True)
    await db.listings.create_index([("title_hi", 1)], sparse=True)
    await db.listings.create_index(
        [("is_locked", 1), ("locked_by", 1), ("updated_at", -1)]
    )
    await db.listings.create_index(
        [("category", 1), ("status", 1), ("category_specific_fields.property_type", 1)]
    )
    await db.listings.create_index(
        [
            ("category", 1),
            ("status", 1),
            ("category_specific_fields.stay_type", 1),
            ("category_specific_fields.available_rooms", -1),
        ]
    )
    await db.listings.create_index(
        [
            ("category", 1),
            ("category_specific_fields.service_type", 1),
            ("category_specific_fields.service_radius_km", 1),
        ]
    )
    await db.listings.create_index(
        [
            ("category", 1),
            ("category_specific_fields.venue_type", 1),
            ("category_specific_fields.indoor_capacity", -1),
        ]
    )
    await db.listings.create_index([("pricing.amount", 1)])
    await db.listings.create_index([("pricing.type", 1)])
    await db.admin_audit_logs.create_index([("actor_id", 1), ("created_at", -1)])
    await db.admin_audit_logs.create_index([("target_id", 1), ("created_at", -1)])
    try:
        await db.listings.create_index(
            [
                ("title", "text"),
                ("description", "text"),
                ("location", "text"),
                ("city", "text"),
                ("sub_category", "text"),
            ],
            default_language="none",
            name="listings_text_idx",
        )
    except Exception as e:
        logger.warning(f"Could not create listings text index: {e}")

    delete_worker_task = asyncio.create_task(media_delete_retry_worker())


async def shutdown_db_client():
    global redis_client, delete_worker_task
    if delete_worker_task:
        delete_worker_task.cancel()
        try:
            await delete_worker_task
        except asyncio.CancelledError:
            pass
        delete_worker_task = None

    client.close()
    if redis_client:
        await redis_client.close()
