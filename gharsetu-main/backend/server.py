from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Query, status, WebSocket, WebSocketDisconnect, Form, Header, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any, Set
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import json
import csv
import io
from enum import Enum
import asyncio
from collections import defaultdict
import hashlib
import socketio
from pymongo import ReturnDocument
try:
    import redis.asyncio as redis_asyncio
except ImportError:
    redis_asyncio = None

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'gharsetu-secret-key-2024')
JWT_ALGORITHM = "HS256"

# Socket.IO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=False,
    engineio_logger=False
)

# Store connected users
connected_users: Dict[str, str] = {}  # user_id -> sid
JWT_EXPIRATION_HOURS = 24

# Create the main app
app = FastAPI(title="GharSetu API", version="2.0.0", description="Full-scale real estate & services marketplace")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============ ENUMS ============
class UserRole(str, Enum):
    USER = "user"
    PROPERTY_OWNER = "property_owner"
    SERVICE_PROVIDER = "service_provider"
    HOTEL_OWNER = "hotel_owner"
    EVENT_OWNER = "event_owner"
    ADMIN = "admin"

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

class UserLogin(BaseModel):
    email: EmailStr
    password: str

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

OWNER_UPLOAD_ROLES = {
    UserRole.PROPERTY_OWNER,
    UserRole.SERVICE_PROVIDER,
    UserRole.HOTEL_OWNER,
    UserRole.EVENT_OWNER,
    UserRole.ADMIN,
}

async def enforce_upload_rate_limit(user_id: str, action: str, max_requests: int = 30, window_seconds: int = 60) -> None:
    """Redis-backed rate limit guard with in-memory fallback."""
    if redis_client:
        key = f"rl:{action}:{user_id}"
        current_count = await redis_client.incr(key)
        if current_count == 1:
            await redis_client.expire(key, window_seconds)
        if current_count > max_requests:
            raise HTTPException(status_code=429, detail="Too many upload requests. Please retry shortly.")
        return

    # Fallback for local/dev if Redis is unavailable.
    now = datetime.now(timezone.utc)
    key = f"{action}:{user_id}"
    window = _upload_rate_limit_windows[key]
    cutoff = now - timedelta(seconds=window_seconds)

    while window and window[0] < cutoff:
        window.pop(0)

    if len(window) >= max_requests:
        raise HTTPException(status_code=429, detail="Too many upload requests. Please retry shortly.")

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

def build_delete_job_id(user_id: str, public_id: str, resource_type: str, idempotency_key: Optional[str] = None) -> str:
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
        delete_result = await asyncio.get_event_loop().run_in_executor(None, delete_call)
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

        retry_delay = DELETE_RETRY_DELAYS_SECONDS[min(attempts - 1, len(DELETE_RETRY_DELAYS_SECONDS) - 1)]
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

        retry_delay = DELETE_RETRY_DELAYS_SECONDS[min(attempts - 1, len(DELETE_RETRY_DELAYS_SECONDS) - 1)]
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
    receiver_id: str
    content: str
    listing_id: Optional[str] = None
    media_url: Optional[str] = None

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

# ============ HELPER FUNCTIONS ============
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token_data = decode_token(credentials.credentials)
    user = await db.users.find_one({"id": token_data["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

async def get_admin_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    user = await get_current_user(credentials)
    if user.get("role") != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def get_owner_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    user = await get_current_user(credentials)
    owner_roles = [UserRole.PROPERTY_OWNER, UserRole.SERVICE_PROVIDER, UserRole.HOTEL_OWNER, UserRole.EVENT_OWNER, UserRole.ADMIN]
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
        "created_at": datetime.now(timezone.utc).isoformat()
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
            "is_verified": False
        },
        "verification_token": verification_token
    }

@api_router.post("/auth/register/owner")
async def register_owner(owner: OwnerRegister):
    existing = await db.users.find_one({"email": owner.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    verification_token = str(uuid.uuid4())
    
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
        "subscription": None,
        "subscription_expires": None,
        "listings": [],
        "total_views": 0,
        "total_bookings": 0,
        "total_revenue": 0,
        "rating": 0,
        "review_count": 0,
        "auto_reply_enabled": False,
        "auto_reply_message": "Thank you for your interest! I will get back to you soon.",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    token = create_token(user_id, owner.role)
    
    return {
        "message": "Owner registration successful. Pending Aadhaar verification.",
        "token": token,
        "user": {
            "id": user_id,
            "name": owner.name,
            "email": owner.email,
            "role": owner.role,
            "is_verified": False,
            "aadhar_status": VerificationStatus.PENDING
        },
        "verification_token": verification_token
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
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "is_verified": user.get("is_verified", False)
        }
    }

@api_router.get("/auth/verify/{token}")
async def verify_email(token: str):
    user = await db.users.find_one({"verification_token": token})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid verification token")
    
    await db.users.update_one(
        {"verification_token": token},
        {"$set": {"is_email_verified": True, "is_verified": True}, "$unset": {"verification_token": ""}}
    )
    
    return {"message": "Email verified successfully"}

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    safe_user = {k: v for k, v in user.items() if k not in ["password", "verification_token"]}
    return safe_user

@api_router.put("/auth/profile")
async def update_profile(updates: Dict[str, Any], user: dict = Depends(get_current_user)):
    allowed_fields = ["name", "phone", "address", "city", "state", "preferences", "notifications_enabled", "auto_reply_enabled", "auto_reply_message"]
    update_data = {k: v for k, v in updates.items() if k in allowed_fields}
    
    if update_data:
        await db.users.update_one({"id": user["id"]}, {"$set": update_data})
    
    return {"message": "Profile updated successfully"}

# ============ LISTINGS ROUTES ============
@api_router.post("/listings")
async def create_listing(listing: ListingCreate, user: dict = Depends(get_owner_user)):
    listing_id = str(uuid.uuid4())
    
    listing_doc = {
        "id": listing_id,
        "owner_id": user["id"],
        "owner_name": user["name"],
        "owner_phone": user.get("phone", ""),
        "owner_verified": user.get("aadhar_status") == VerificationStatus.VERIFIED,
        **listing.model_dump(),
        "status": ListingStatus.PENDING,
        "is_available": True,
        "views": 0,
        "likes": 0,
        "saves": 0,
        "inquiries": 0,
        "shares": 0,
        "price_history": [{"price": listing.price, "date": datetime.now(timezone.utc).isoformat()}],
        "boost_expires": None,
        "featured": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.listings.insert_one(listing_doc)
    await db.users.update_one({"id": user["id"]}, {"$push": {"listings": listing_id}})
    
    return {"message": "Listing created successfully", "listing_id": listing_id}

@api_router.get("/listings")
async def get_listings(
    category: Optional[ListingCategory] = None,
    listing_type: Optional[ListingType] = None,
    sub_category: Optional[str] = None,
    city: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    search: Optional[str] = None,
    amenities: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius: Optional[float] = 10,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    page: int = 1,
    limit: int = 20
):
    query = {"status": {"$in": [ListingStatus.APPROVED, ListingStatus.BOOSTED]}, "is_available": True}
    
    if category:
        query["category"] = category
    if listing_type:
        query["listing_type"] = listing_type
    if sub_category:
        query["sub_category"] = sub_category
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if min_price:
        query["price"] = {"$gte": min_price}
    if max_price:
        query["price"] = {**query.get("price", {}), "$lte": max_price}
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"location": {"$regex": search, "$options": "i"}}
        ]
    if amenities:
        amenity_list = amenities.split(",")
        query["amenities"] = {"$all": amenity_list}
    
    # Sort boosted listings first
    sort_direction = -1 if sort_order == "desc" else 1
    skip = (page - 1) * limit
    
    # Get boosted listings first
    boosted = await db.listings.find(
        {**query, "status": ListingStatus.BOOSTED, "boost_expires": {"$gt": datetime.now(timezone.utc).isoformat()}}
    , {"_id": 0}).limit(5).to_list(5)
    
    # Then regular listings
    regular = await db.listings.find(query, {"_id": 0}).sort(sort_by, sort_direction).skip(skip).limit(limit - len(boosted)).to_list(limit)
    
    listings = boosted + regular
    total = await db.listings.count_documents(query)
    
    return {
        "listings": listings,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

@api_router.get("/listings/trending")
async def get_trending_listings(limit: int = 10, category: Optional[ListingCategory] = None):
    query = {"status": {"$in": [ListingStatus.APPROVED, ListingStatus.BOOSTED]}, "is_available": True}
    if category:
        query["category"] = category
    
    listings = await db.listings.find(query, {"_id": 0}).sort([("views", -1), ("likes", -1)]).limit(limit).to_list(limit)
    return {"listings": listings}

@api_router.get("/listings/recommended")
async def get_recommended_listings(user: dict = Depends(get_current_user), limit: int = 10):
    # AI-based recommendations based on user history
    preferences = user.get("preferences", {})
    search_history = user.get("search_history", [])
    wishlist = user.get("wishlist", [])
    
    query = {"status": {"$in": [ListingStatus.APPROVED, ListingStatus.BOOSTED]}, "is_available": True}
    
    # If user has preferences, use them
    if preferences.get("city"):
        query["city"] = preferences["city"]
    if preferences.get("category"):
        query["category"] = preferences["category"]
    if preferences.get("max_budget"):
        query["price"] = {"$lte": preferences["max_budget"]}
    
    listings = await db.listings.find(query, {"_id": 0}).sort([("views", -1), ("likes", -1)]).limit(limit).to_list(limit)
    
    return {"listings": listings, "reason": "Based on your preferences"}

@api_router.get("/listings/nearby")
async def get_nearby_listings(lat: float, lng: float, radius: float = 5, limit: int = 20):
    # Simple distance-based query (for production, use MongoDB geospatial queries)
    query = {
        "status": {"$in": [ListingStatus.APPROVED, ListingStatus.BOOSTED]},
        "is_available": True,
        "latitude": {"$exists": True},
        "longitude": {"$exists": True}
    }
    
    listings = await db.listings.find(query, {"_id": 0}).limit(limit * 3).to_list(limit * 3)
    
    # Filter by distance (simplified)
    nearby = []
    for listing in listings:
        if listing.get("latitude") and listing.get("longitude"):
            # Simple distance calculation
            dlat = abs(listing["latitude"] - lat)
            dlng = abs(listing["longitude"] - lng)
            if dlat < radius/111 and dlng < radius/111:  # Rough approximation
                nearby.append(listing)
    
    return {"listings": nearby[:limit]}

@api_router.get("/listings/map")
async def get_map_listings(
    min_lat: float, max_lat: float,
    min_lng: float, max_lng: float,
    category: Optional[ListingCategory] = None,
    limit: int = 100
):
    query = {
        "status": {"$in": [ListingStatus.APPROVED, ListingStatus.BOOSTED]},
        "is_available": True,
        "latitude": {"$gte": min_lat, "$lte": max_lat},
        "longitude": {"$gte": min_lng, "$lte": max_lng}
    }
    if category:
        query["category"] = category
    
    listings = await db.listings.find(
        query,
        {"_id": 0, "id": 1, "title": 1, "price": 1, "category": 1, "latitude": 1, "longitude": 1, "images": 1, "listing_type": 1}
    ).limit(limit).to_list(limit)
    
    return {"listings": listings}

@api_router.get("/listings/heatmap")
async def get_property_heatmap(city: str = "Surat"):
    # Get property density by area
    pipeline = [
        {"$match": {"city": {"$regex": city, "$options": "i"}, "status": {"$in": [ListingStatus.APPROVED, ListingStatus.BOOSTED]}}},
        {"$group": {"_id": "$location", "count": {"$sum": 1}, "avg_price": {"$avg": "$price"}}},
        {"$sort": {"count": -1}},
        {"$limit": 50}
    ]
    
    results = await db.listings.aggregate(pipeline).to_list(50)
    
    return {
        "hotspots": [{"area": r["_id"], "listings": r["count"], "avg_price": r["avg_price"]} for r in results],
        "city": city
    }

@api_router.get("/listings/{listing_id}")
async def get_listing(listing_id: str):
    listing = await db.listings.find_one({"id": listing_id}, {"_id": 0})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    await db.listings.update_one({"id": listing_id}, {"$inc": {"views": 1}})
    listing["views"] = listing.get("views", 0) + 1
    
    # Get similar listings
    similar = await db.listings.find(
        {
            "id": {"$ne": listing_id},
            "category": listing["category"],
            "city": listing["city"],
            "status": {"$in": [ListingStatus.APPROVED, ListingStatus.BOOSTED]}
        },
        {"_id": 0}
    ).limit(4).to_list(4)
    
    # Get reviews
    reviews = await db.reviews.find({"listing_id": listing_id}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    
    listing["similar_listings"] = similar
    listing["reviews"] = reviews
    
    return listing

@api_router.get("/listings/{listing_id}/price-history")
async def get_price_history(listing_id: str):
    listing = await db.listings.find_one({"id": listing_id}, {"_id": 0, "price_history": 1})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    return {"price_history": listing.get("price_history", [])}

@api_router.put("/listings/{listing_id}")
async def update_listing(listing_id: str, update: ListingUpdate, user: dict = Depends(get_owner_user)):
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
            {"$push": {"price_history": {"price": update_data["price"], "date": datetime.now(timezone.utc).isoformat()}}}
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
    await db.users.update_one({"id": listing["owner_id"]}, {"$pull": {"listings": listing_id}})
    
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
    
    boost_expires = (datetime.now(timezone.utc) + timedelta(days=boost.boost_days)).isoformat()
    
    await db.listings.update_one(
        {"id": boost.listing_id},
        {"$set": {"status": ListingStatus.BOOSTED, "boost_expires": boost_expires, "boost_type": boost.boost_type}}
    )
    
    return {"message": f"Listing boosted for {boost.boost_days} days", "expires": boost_expires}

# ============ WISHLIST ROUTES ============
@api_router.post("/wishlist/{listing_id}")
async def add_to_wishlist(listing_id: str, user: dict = Depends(get_current_user)):
    listing = await db.listings.find_one({"id": listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    await db.users.update_one({"id": user["id"]}, {"$addToSet": {"wishlist": listing_id}})
    await db.listings.update_one({"id": listing_id}, {"$inc": {"saves": 1}})
    
    return {"message": "Added to wishlist"}

@api_router.delete("/wishlist/{listing_id}")
async def remove_from_wishlist(listing_id: str, user: dict = Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$pull": {"wishlist": listing_id}})
    return {"message": "Removed from wishlist"}

@api_router.get("/wishlist")
async def get_wishlist(user: dict = Depends(get_current_user)):
    wishlist_ids = user.get("wishlist", [])
    if not wishlist_ids:
        return {"listings": []}
    
    listings = await db.listings.find({"id": {"$in": wishlist_ids}}, {"_id": 0}).to_list(100)
    return {"listings": listings}

# ============ BOOKING ROUTES ============
@api_router.post("/bookings")
async def create_booking(booking: BookingCreate, user: dict = Depends(get_current_user)):
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
        "created_at": datetime.now(timezone.utc).isoformat()
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
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {"message": "Booking request sent", "booking_id": booking_id}

@api_router.get("/bookings")
async def get_user_bookings(user: dict = Depends(get_current_user)):
    bookings = await db.bookings.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"bookings": bookings}

@api_router.get("/bookings/owner")
async def get_owner_bookings(user: dict = Depends(get_owner_user)):
    bookings = await db.bookings.find({"owner_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"bookings": bookings}

@api_router.put("/bookings/{booking_id}/status")
async def update_booking_status(booking_id: str, status: BookingStatus, user: dict = Depends(get_owner_user)):
    booking = await db.bookings.find_one({"id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking["owner_id"] != user["id"] and user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.bookings.update_one({"id": booking_id}, {"$set": {"status": status}})
    
    # Send notification to user
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": booking["user_id"],
        "type": "booking_update",
        "title": f"Booking {status}",
        "message": f"Your booking for {booking['listing_title']} has been {status}",
        "data": {"booking_id": booking_id},
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
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
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.visits.insert_one(visit_doc)
    
    return {"message": "Visit scheduled", "visit_id": visit_id}

@api_router.get("/visits")
async def get_visits(user: dict = Depends(get_current_user)):
    visits = await db.visits.find({"user_id": user["id"]}, {"_id": 0}).sort("visit_date", 1).to_list(50)
    return {"visits": visits}

@api_router.get("/visits/owner")
async def get_owner_visits(user: dict = Depends(get_owner_user)):
    visits = await db.visits.find({"owner_id": user["id"]}, {"_id": 0}).sort("visit_date", 1).to_list(50)
    return {"visits": visits}

# ============ NEGOTIATION ROUTES ============
@api_router.post("/negotiations")
async def create_negotiation(negotiation: NegotiationCreate, user: dict = Depends(get_current_user)):
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
        "history": [{
            "action": "offer",
            "price": negotiation.offered_price,
            "by": user["id"],
            "message": negotiation.message,
            "date": datetime.now(timezone.utc).isoformat()
        }],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.negotiations.insert_one(negotiation_doc)
    
    # Notify owner
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": listing["owner_id"],
        "type": "negotiation",
        "title": "New Price Offer",
        "message": f"{user['name']} offered ₹{negotiation.offered_price:,.0f} for {listing['title']}",
        "data": {"negotiation_id": negotiation_id, "listing_id": negotiation.listing_id},
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {"message": "Offer sent", "negotiation_id": negotiation_id}

@api_router.put("/negotiations/{negotiation_id}/respond")
async def respond_negotiation(negotiation_id: str, response: NegotiationResponse, user: dict = Depends(get_owner_user)):
    negotiation = await db.negotiations.find_one({"id": negotiation_id})
    if not negotiation:
        raise HTTPException(status_code=404, detail="Negotiation not found")
    
    if negotiation["owner_id"] != user["id"] and user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {
        "status": response.status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    history_entry = {
        "action": response.status,
        "by": user["id"],
        "message": response.message,
        "date": datetime.now(timezone.utc).isoformat()
    }
    
    if response.status == NegotiationStatus.COUNTER and response.counter_price:
        update_data["current_price"] = response.counter_price
        history_entry["price"] = response.counter_price
    
    await db.negotiations.update_one(
        {"id": negotiation_id},
        {"$set": update_data, "$push": {"history": history_entry}}
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
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {"message": f"Response sent: {response.status}"}

@api_router.get("/negotiations")
async def get_negotiations(user: dict = Depends(get_current_user)):
    negotiations = await db.negotiations.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"negotiations": negotiations}

@api_router.get("/negotiations/owner")
async def get_owner_negotiations(user: dict = Depends(get_owner_user)):
    negotiations = await db.negotiations.find({"owner_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"negotiations": negotiations}

# ============ REVIEWS ROUTES ============
@api_router.post("/reviews")
async def create_review(review: ReviewCreate, user: dict = Depends(get_current_user)):
    listing = await db.listings.find_one({"id": review.listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    # Check if user has booked this listing
    booking = await db.bookings.find_one({
        "user_id": user["id"],
        "listing_id": review.listing_id,
        "status": BookingStatus.COMPLETED
    })
    
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
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.reviews.insert_one(review_doc)
    
    # Update listing rating
    all_reviews = await db.reviews.find({"listing_id": review.listing_id}, {"rating": 1}).to_list(1000)
    avg_rating = sum(r["rating"] for r in all_reviews) / len(all_reviews)
    await db.listings.update_one(
        {"id": review.listing_id},
        {"$set": {"rating": avg_rating, "review_count": len(all_reviews)}}
    )
    
    return {"message": "Review submitted", "review_id": review_id}

@api_router.get("/reviews/listing/{listing_id}")
async def get_listing_reviews(listing_id: str, page: int = 1, limit: int = 20):
    skip = (page - 1) * limit
    reviews = await db.reviews.find({"listing_id": listing_id}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.reviews.count_documents({"listing_id": listing_id})
    
    return {"reviews": reviews, "total": total, "page": page}

# ============ VIDEOS/REELS ROUTES ============
from fastapi import File, UploadFile
import cloudinary
import cloudinary.uploader

# Initialize Cloudinary
CLOUDINARY_CLOUD_NAME = os.environ.get('CLOUDINARY_CLOUD_NAME')
CLOUDINARY_API_KEY = os.environ.get('CLOUDINARY_API_KEY')
CLOUDINARY_API_SECRET = os.environ.get('CLOUDINARY_API_SECRET')

# ============ CLOUDINARY PRODUCTION CONFIG ============
import asyncio
from functools import partial

CLOUDINARY_CLOUD_NAME = os.environ.get('CLOUDINARY_CLOUD_NAME')
CLOUDINARY_API_KEY = os.environ.get('CLOUDINARY_API_KEY')
CLOUDINARY_API_SECRET = os.environ.get('CLOUDINARY_API_SECRET')
CLOUDINARY_UPLOAD_PRESET = os.environ.get('CLOUDINARY_UPLOAD_PRESET', 'gharsetu_unsigned')

if CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY:
    cloudinary.config(
        cloud_name=CLOUDINARY_CLOUD_NAME,
        api_key=CLOUDINARY_API_KEY,
        api_secret=CLOUDINARY_API_SECRET,
        secure=True  # ✅ Always HTTPS
    )
    logger.info(f"✅ Cloudinary configured: {CLOUDINARY_CLOUD_NAME}")
else:
    logger.warning("⚠️ Cloudinary not configured - running in demo mode")

@api_router.post("/upload/signature")
async def get_upload_signature(
    payload: UploadSignatureRequest,
    user: dict = Depends(get_current_user)
):
    """Generate short-lived Cloudinary signature for direct frontend uploads."""
    if not CLOUDINARY_CLOUD_NAME or not CLOUDINARY_API_KEY or not CLOUDINARY_API_SECRET:
        raise HTTPException(status_code=503, detail="Cloudinary is not configured")

    await enforce_upload_rate_limit(user["id"], "upload_signature", max_requests=30, window_seconds=60)

    allowed_resource_types = {"image", "video", "auto"}
    resource_type = payload.resource_type if payload.resource_type in allowed_resource_types else "auto"
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
    user: dict = Depends(get_current_user)
):
    """Delete uploaded Cloudinary media by public_id with idempotent retry queue."""
    if not CLOUDINARY_CLOUD_NAME or not CLOUDINARY_API_KEY or not CLOUDINARY_API_SECRET:
        raise HTTPException(status_code=503, detail="Cloudinary is not configured")

    await enforce_upload_rate_limit(user["id"], "upload_delete", max_requests=20, window_seconds=60)

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
    resource_type = payload.resource_type if payload.resource_type in allowed_resource_types else "image"
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
        await db.media_delete_jobs.insert_one({
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
        })

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
            "result": final_doc.get("result") if final_doc else attempt_result.get("result", "unknown"),
            "public_id": public_id,
            "job_id": job_id,
            "queued": bool(final_doc and final_doc.get("status") in {"retry", "pending", "processing"}),
            "attempts": final_doc.get("attempts", 0) if final_doc else 0,
        }

    in_progress = await db.media_delete_jobs.find_one({"id": job_id}, {"_id": 0, "status": 1, "attempts": 1})
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
    admin: dict = Depends(get_admin_user)
):
    """Admin endpoint to inspect media delete jobs and their states."""
    skip = (page - 1) * limit
    query: Dict[str, Any] = {}
    if status:
        allowed_statuses = {"pending", "processing", "retry", "completed", "failed"}
        if status not in allowed_statuses:
            raise HTTPException(status_code=400, detail="Invalid status filter")
        query["status"] = status

    jobs = await db.media_delete_jobs.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.media_delete_jobs.count_documents(query)

    status_counts_cursor = db.media_delete_jobs.aggregate([
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ])
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
async def retry_media_delete_job(
    job_id: str,
    admin: dict = Depends(get_admin_user)
):
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
    job_id: str,
    admin: dict = Depends(get_admin_user)
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

@api_router.get("/admin/audit-logs")
async def get_admin_audit_logs(
    action: Optional[str] = None,
    q: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    admin: dict = Depends(get_admin_user)
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

    logs = await db.admin_audit_logs.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.admin_audit_logs.count_documents(query)

    action_counts_cursor = db.admin_audit_logs.aggregate([
        {"$group": {"_id": "$action", "count": {"$sum": 1}}}
    ])
    action_counts_docs = await action_counts_cursor.to_list(length=100)
    action_counts = {item.get("_id", "unknown"): item.get("count", 0) for item in action_counts_docs}

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

@api_router.get("/admin/audit-logs/export")
async def export_admin_audit_logs_csv(
    action: Optional[str] = None,
    q: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = Query(2000, ge=1, le=10000),
    admin: dict = Depends(get_admin_user)
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

    logs = await db.admin_audit_logs.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)

    csv_stream = io.StringIO()
    writer = csv.writer(csv_stream)
    writer.writerow([
        "id",
        "action",
        "actor_id",
        "actor_email",
        "target_type",
        "target_id",
        "meta",
        "created_at",
    ])

    for log in logs:
        writer.writerow([
            log.get("id", ""),
            log.get("action", ""),
            log.get("actor_id", ""),
            log.get("actor_email", ""),
            log.get("target_type", ""),
            log.get("target_id", ""),
            json.dumps(log.get("meta", {}), ensure_ascii=False),
            str(log.get("created_at", "")),
        ])

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
    user: dict = Depends(get_current_user)
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
    MAGIC = [b'\xff\xd8\xff', b'\x89PNG', b'RIFF']
    if not any(content.startswith(m) for m in MAGIC):
        raise HTTPException(status_code=400, detail="Invalid image file")

    image_id = str(uuid.uuid4())

    if not CLOUDINARY_CLOUD_NAME:
        return {
            "success": True,
            "url": f"https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&sig={image_id[:8]}",
            "public_id": image_id
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
            transformation=[{
                "width": 1200,
                "crop": "limit",
                "quality": "auto:good",
                "fetch_format": "auto"
            }],
            eager=[
                {"width": 400, "crop": "fill", 
                 "gravity": "auto", "quality": "auto"}
            ]
        )
        result = await asyncio.get_event_loop().run_in_executor(None, upload_func)

        return {
            "success": True,
            "url": result.get('secure_url'),
            "thumbnail_url": result.get('eager', [{}])[0].get('secure_url', result.get('secure_url')),
            "public_id": result.get('public_id'),
            "width": result.get('width'),
            "height": result.get('height'),
            "format": result.get('format')
        }
    except Exception as e:
        logger.error(f"Cloudinary upload failed: {e}")
        raise HTTPException(status_code=500, detail="Image upload failed")


@api_router.post("/upload/images")
async def upload_multiple_images(
    files: List[UploadFile] = File(...),
    folder: str = Form("listings"),
    user: dict = Depends(get_current_user)
):
    if len(files) > 10:
        raise HTTPException(status_code=400, detail="Max 10 images allowed")

    ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
    results = []

    for file in files:
        if file.content_type not in ALLOWED_TYPES:
            results.append({"success": False, "filename": file.filename, "error": "Invalid type"})
            continue

        content = await file.read()
        if len(content) > 10 * 1024 * 1024:
            results.append({"success": False, "filename": file.filename, "error": "Too large"})
            continue

        image_id = str(uuid.uuid4())

        if not CLOUDINARY_CLOUD_NAME:
            results.append({
                "success": True,
                "url": f"https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&sig={image_id[:8]}",
                "public_id": image_id,
                "filename": file.filename
            })
            continue

        try:
            upload_func = partial(
                cloudinary.uploader.upload,
                content,
                resource_type="image",
                folder=f"gharsetu/{folder}",
                public_id=image_id,
                transformation=[{"width": 1200, "crop": "limit", 
                                  "quality": "auto:good", "fetch_format": "auto"}],
                eager=[{"width": 400, "crop": "fill", "gravity": "auto"}]
            )
            result = await asyncio.get_event_loop().run_in_executor(None, upload_func)
            results.append({
                "success": True,
                "url": result.get('secure_url'),
                "thumbnail_url": result.get('eager', [{}])[0].get('secure_url', result.get('secure_url')),
                "public_id": result.get('public_id'),
                "filename": file.filename
            })
        except Exception as e:
            logger.error(f"Upload failed for {file.filename}: {e}")
            results.append({"success": False, "filename": file.filename, "error": str(e)})

    return {"images": results, "total": len(results)}

@api_router.post("/videos/upload")
async def upload_video(
    title: str = Form(...),
    description: str = Form(None),
    category: str = Form("home"),
    listing_id: str = Form(None),
    video: UploadFile = File(...),
    authorization: str = Header(None)
):
    """Upload video reel with Cloudinary"""
    # Get user from token
    user = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            user = await db.users.find_one({"id": payload.get("user_id")})
        except:
            pass
    
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Check file type
    if not video.content_type.startswith('video/'):
        raise HTTPException(status_code=400, detail="File must be a video")
    
    # Check file size (max 100MB)
    content = await video.read()
    if len(content) > 100 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Video too large (max 100MB)")
    
    video_id = str(uuid.uuid4())
    
    # Upload to Cloudinary
    video_url = ""
    thumbnail_url = ""
    
    if CLOUDINARY_CLOUD_NAME:
        try:
            result = cloudinary.uploader.upload(
                content,
                resource_type="video",
                folder="gharsetu/reels",
                public_id=video_id,
                eager=[{"width": 720, "crop": "scale"}],
                eager_async=True
            )
            video_url = result.get('secure_url', '')
            
            # Generate thumbnail
            thumbnail_url = cloudinary.utils.cloudinary_url(
                result['public_id'],
                resource_type="video",
                format="jpg",
                transformation=[{"width": 400, "crop": "scale"}]
            )[0]
        except Exception as e:
            logger.error(f"Cloudinary upload failed: {e}")
            raise HTTPException(status_code=500, detail="Video upload failed")
    else:
        # Demo mode
        video_url = "https://player.vimeo.com/external/434045526.sd.mp4?s=c27eecc69a27dbc4ff2b87d38afc35f1a9e7c02d&profile_id=165"
        thumbnail_url = "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600"
    
    video_doc = {
        "id": video_id,
        "owner_id": user["id"],
        "owner_name": user["name"],
        "title": title,
        "description": description or "",
        "category": category,
        "url": video_url,
        "video_url": video_url,
        "thumbnail_url": thumbnail_url,
        "listing_id": listing_id or "",
        "likes": 0,
        "views": 0,
        "saves": 0,
        "shares": 0,
        "comments": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.videos.insert_one(video_doc)
    
    return {
        "success": True,
        "message": "Video uploaded successfully", 
        "video_id": video_id,
        "url": video_url,
        "thumbnail_url": thumbnail_url
    }

@api_router.post("/videos")
async def create_video(video: VideoCreate, user: dict = Depends(get_owner_user)):
    video_id = str(uuid.uuid4())
    video_doc = {
        "id": video_id,
        "owner_id": user["id"],
        "owner_name": user["name"],
        "owner_verified": user.get("aadhar_status") == VerificationStatus.VERIFIED,
        **video.model_dump(),
        "likes": 0,
        "views": 0,
        "saves": 0,
        "shares": 0,
        "comments": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.videos.insert_one(video_doc)
    
    return {"message": "Video posted successfully", "video_id": video_id}

@api_router.get("/videos")
async def get_videos(
    category: Optional[ListingCategory] = None,
    page: int = 1,
    limit: int = 20
):
    query = {}
    if category:
        query["category"] = category
    
    skip = (page - 1) * limit
    videos = await db.videos.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.videos.count_documents(query)
    
    return {"videos": videos, "total": total, "page": page, "pages": (total + limit - 1) // limit}

@api_router.get("/videos/feed")
async def get_video_feed(user: dict = Depends(get_current_user), page: int = 1, limit: int = 10):
    # Personalized feed based on user preferences
    preferences = user.get("preferences", {})
    
    query = {}
    if preferences.get("category"):
        query["category"] = preferences["category"]
    
    skip = (page - 1) * limit
    videos = await db.videos.find(query, {"_id": 0}).sort([("views", -1), ("created_at", -1)]).skip(skip).limit(limit).to_list(limit)
    
    return {"videos": videos, "page": page}

@api_router.post("/videos/{video_id}/like")
async def like_video(video_id: str, user: dict = Depends(get_current_user)):
    video = await db.videos.find_one({"id": video_id})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    await db.videos.update_one({"id": video_id}, {"$inc": {"likes": 1}})
    
    return {"message": "Video liked"}

@api_router.post("/videos/{video_id}/save")
async def save_video(video_id: str, user: dict = Depends(get_current_user)):
    video = await db.videos.find_one({"id": video_id})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    await db.users.update_one({"id": user["id"]}, {"$addToSet": {"saved_reels": video_id}})
    await db.videos.update_one({"id": video_id}, {"$inc": {"saves": 1}})
    
    return {"message": "Video saved"}

@api_router.delete("/videos/{video_id}/save")
async def unsave_video(video_id: str, user: dict = Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$pull": {"saved_reels": video_id}})
    return {"message": "Video unsaved"}

@api_router.get("/videos/saved")
async def get_saved_videos(user: dict = Depends(get_current_user)):
    saved_ids = user.get("saved_reels", [])
    if not saved_ids:
        return {"videos": []}
    
    videos = await db.videos.find({"id": {"$in": saved_ids}}, {"_id": 0}).to_list(100)
    return {"videos": videos}

# ============ COMMENTS ROUTES ============
class CommentCreate(BaseModel):
    comment: str = Field(..., min_length=1, max_length=1000)

@api_router.get("/videos/{video_id}/comments")
async def get_video_comments(video_id: str, page: int = 1, limit: int = 50):
    skip = (page - 1) * limit
    comments = await db.comments.find(
        {"video_id": video_id}, 
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {"comments": comments, "page": page}

@api_router.post("/videos/{video_id}/comments")
async def add_video_comment(
    video_id: str,
    comment_data: CommentCreate,
    user: dict = Depends(get_current_user)
):
    video = await db.videos.find_one({"id": video_id})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    comment = {
        "id": str(uuid.uuid4()),
        "video_id": video_id,
        "user_id": user["id"],
        "user_name": user["name"],
        "comment": comment_data.comment,
        "likes": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.comments.insert_one(comment)
    await db.videos.update_one({"id": video_id}, {"$inc": {"comments_count": 1}})
    
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
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)
    
    return {"message": "Comment added", "comment": {k: v for k, v in comment.items() if k != "_id"}}

@api_router.delete("/videos/{video_id}/comments/{comment_id}")
async def delete_video_comment(
    video_id: str,
    comment_id: str,
    user: dict = Depends(get_current_user)
):
    comment = await db.comments.find_one({"id": comment_id, "video_id": video_id})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    if comment["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.comments.delete_one({"id": comment_id})
    await db.videos.update_one({"id": video_id}, {"$inc": {"comments_count": -1}})
    
    return {"message": "Comment deleted"}

@api_router.post("/videos/{video_id}/view")
async def record_video_view(video_id: str):
    await db.videos.update_one({"id": video_id}, {"$inc": {"views": 1}})
    return {"message": "View recorded"}

# ============ USER FOLLOW ROUTES ============
@api_router.get("/users/{user_id}")
async def get_user_profile(user_id: str):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get followers/following count
    followers_count = await db.follows.count_documents({"following_id": user_id})
    following_count = await db.follows.count_documents({"follower_id": user_id})
    
    # Get user's reels
    reels = await db.videos.find({"owner_id": user_id}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    
    return {
        **user,
        "followers_count": followers_count,
        "following_count": following_count,
        "reels": reels
    }

@api_router.post("/users/{user_id}/follow")
async def follow_user(user_id: str, user: dict = Depends(get_current_user)):
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    
    target_user = await db.users.find_one({"id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if already following
    existing = await db.follows.find_one({
        "follower_id": user["id"],
        "following_id": user_id
    })
    
    if existing:
        return {"message": "Already following"}
    
    follow_doc = {
        "id": str(uuid.uuid4()),
        "follower_id": user["id"],
        "following_id": user_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.follows.insert_one(follow_doc)
    
    # Notify user
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": "new_follower",
        "title": "New Follower",
        "message": f"{user['name']} started following you",
        "data": {"follower_id": user["id"]},
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {"message": "Following successfully"}

@api_router.delete("/users/{user_id}/follow")
async def unfollow_user(user_id: str, user: dict = Depends(get_current_user)):
    await db.follows.delete_one({
        "follower_id": user["id"],
        "following_id": user_id
    })
    return {"message": "Unfollowed successfully"}

@api_router.get("/users/{user_id}/followers")
async def get_followers(user_id: str, page: int = 1, limit: int = 20):
    skip = (page - 1) * limit
    follows = await db.follows.find({"following_id": user_id}).skip(skip).limit(limit).to_list(limit)
    
    followers = []
    for f in follows:
        follower = await db.users.find_one({"id": f["follower_id"]}, {"_id": 0, "name": 1, "id": 1})
        if follower:
            followers.append(follower)
    
    return {"followers": followers, "page": page}

@api_router.get("/users/{user_id}/following")
async def get_following(user_id: str, page: int = 1, limit: int = 20):
    skip = (page - 1) * limit
    follows = await db.follows.find({"follower_id": user_id}).skip(skip).limit(limit).to_list(limit)
    
    following = []
    for f in follows:
        user_doc = await db.users.find_one({"id": f["following_id"]}, {"_id": 0, "name": 1, "id": 1})
        if user_doc:
            following.append(user_doc)
    
    return {"following": following, "page": page}

# ============ MESSAGING ROUTES ============
@api_router.post("/messages")
async def send_message(message: MessageCreate, user: dict = Depends(get_current_user)):
    receiver = await db.users.find_one({"id": message.receiver_id})
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver not found")
    
    message_id = str(uuid.uuid4())
    
    # Create or get conversation
    conversation = await db.conversations.find_one({
        "$or": [
            {"participants": [user["id"], message.receiver_id]},
            {"participants": [message.receiver_id, user["id"]]}
        ]
    })
    
    if not conversation:
        conversation_id = str(uuid.uuid4())
        await db.conversations.insert_one({
            "id": conversation_id,
            "participants": [user["id"], message.receiver_id],
            "listing_id": message.listing_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    else:
        conversation_id = conversation["id"]
    
    message_doc = {
        "id": message_id,
        "conversation_id": conversation_id,
        "sender_id": user["id"],
        "sender_name": user["name"],
        "receiver_id": message.receiver_id,
        "content": message.content,
        "media_url": message.media_url,
        "listing_id": message.listing_id,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.messages.insert_one(message_doc)
    
    # Update conversation
    await db.conversations.update_one(
        {"id": conversation_id},
        {"$set": {"last_message": message.content, "last_message_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Check for auto-reply
    if receiver.get("auto_reply_enabled") and receiver.get("auto_reply_message"):
        auto_reply_id = str(uuid.uuid4())
        auto_reply_doc = {
            "id": auto_reply_id,
            "conversation_id": conversation_id,
            "sender_id": message.receiver_id,
            "sender_name": receiver["name"],
            "receiver_id": user["id"],
            "content": receiver["auto_reply_message"],
            "is_auto_reply": True,
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.messages.insert_one(auto_reply_doc)
    
    # Send real-time notification via WebSocket
    await manager.send_personal_message({
        "type": "new_message",
        "message": message_doc
    }, message.receiver_id)
    
    return {"message": "Message sent", "message_id": message_id}

@api_router.get("/messages/conversations")
async def get_conversations(user: dict = Depends(get_current_user)):
    conversations = await db.conversations.find(
        {"participants": user["id"]},
        {"_id": 0}
    ).sort("last_message_at", -1).to_list(50)
    
    # Add other participant info
    for conv in conversations:
        others = [p for p in conv["participants"] if p != user["id"]]
        other_id = others[0] if others else None
        if not other_id:
            continue
        other_user = await db.users.find_one({"id": other_id}, {"_id": 0, "name": 1, "id": 1})
        conv["other_user"] = other_user
        
        # Get unread count
        unread = await db.messages.count_documents({
            "conversation_id": conv["id"],
            "receiver_id": user["id"],
            "read": False
        })
        conv["unread_count"] = unread
    
    return {"conversations": conversations}

@api_router.get("/messages/conversation/{conversation_id}")
async def get_conversation_messages(conversation_id: str, user: dict = Depends(get_current_user), page: int = 1, limit: int = 50):
    conversation = await db.conversations.find_one({"id": conversation_id})
    if not conversation or user["id"] not in conversation["participants"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    skip = (page - 1) * limit
    messages = await db.messages.find(
        {"conversation_id": conversation_id},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Mark as read
    await db.messages.update_many(
        {"conversation_id": conversation_id, "receiver_id": user["id"], "read": False},
        {"$set": {"read": True}}
    )
    
    return {"messages": messages[::-1], "page": page}

# ============ NOTIFICATIONS ROUTES ============
@api_router.get("/notifications")
async def get_notifications(user: dict = Depends(get_current_user), page: int = 1, limit: int = 20):
    skip = (page - 1) * limit
    notifications = await db.notifications.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    unread_count = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    
    return {"notifications": notifications, "unread_count": unread_count, "page": page}

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one(
        {"id": notification_id, "user_id": user["id"]},
        {"$set": {"read": True}}
    )
    return {"message": "Notification marked as read"}

@api_router.put("/notifications/read-all")
async def mark_all_notifications_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many(
        {"user_id": user["id"], "read": False},
        {"$set": {"read": True}}
    )
    return {"message": "All notifications marked as read"}

# ============ AI CHATBOT ROUTE ============
@api_router.post("/chat")
async def chat_with_bot(msg: ChatMessage, user: dict = Depends(get_current_user)):
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
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
When suggesting properties, ask about: location, budget, property type, and specific requirements."""
        ).with_model("openai", "gpt-5.2")
        
        user_message = UserMessage(text=msg.message)
        response = await chat.send_message(user_message)
        
        # Save to search history
        await db.users.update_one(
            {"id": user["id"]},
            {"$push": {"search_history": {"query": msg.message, "date": datetime.now(timezone.utc).isoformat()}}}
        )
        
        return {"response": response}
    except Exception as e:
        logger.error(f"Chatbot error: {str(e)}")
        return {"response": "માફ કરશો, હું અત્યારે જવાબ આપી શકતો નથી. કૃપયા ફરીથી પ્રયાસ કરો."}

@api_router.post("/chat/voice")
async def voice_search(query: str, user: dict = Depends(get_current_user)):
    # Process voice query and return search results
    search_terms = query.lower()
    
    # Parse location
    cities = ["surat", "ahmedabad", "vadodara", "rajkot", "gandhinagar"]
    location = next((city for city in cities if city in search_terms), None)
    
    # Parse property type
    property_types = {
        "1 bhk": "1bhk", "2 bhk": "2bhk", "3 bhk": "3bhk",
        "flat": "flat", "house": "house", "villa": "villa",
        "shop": "shop", "office": "office", "hotel": "hotel",
        "plumber": "plumber", "electrician": "electrician"
    }
    prop_type = next((v for k, v in property_types.items() if k in search_terms), None)
    
    # Build query
    db_query = {"status": {"$in": [ListingStatus.APPROVED, ListingStatus.BOOSTED]}}
    if location:
        db_query["city"] = {"$regex": location, "$options": "i"}
    if prop_type:
        db_query["$or"] = [
            {"sub_category": {"$regex": prop_type, "$options": "i"}},
            {"title": {"$regex": prop_type, "$options": "i"}}
        ]
    
    listings = await db.listings.find(db_query, {"_id": 0}).limit(10).to_list(10)
    
    return {
        "query": query,
        "parsed": {"location": location, "type": prop_type},
        "results": listings
    }

# ============ ADMIN ROUTES ============
@api_router.get("/admin/users")
async def get_all_users(user: dict = Depends(get_admin_user), role: Optional[UserRole] = None, page: int = 1, limit: int = 50):
    query = {}
    if role:
        query["role"] = role
    
    skip = (page - 1) * limit
    users = await db.users.find(query, {"_id": 0, "password": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.users.count_documents(query)
    
    return {"users": users, "total": total, "page": page}

@api_router.get("/admin/listings")
async def get_all_listings_admin(
    user: dict = Depends(get_admin_user),
    status: Optional[ListingStatus] = None,
    category: Optional[ListingCategory] = None,
    page: int = 1,
    limit: int = 50
):
    query = {}
    if status:
        query["status"] = status
    if category:
        query["category"] = category
    
    skip = (page - 1) * limit
    listings = await db.listings.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.listings.count_documents(query)
    
    return {"listings": listings, "total": total, "page": page}

@api_router.put("/admin/listings/{listing_id}/status")
async def update_listing_status(listing_id: str, status: ListingStatus, user: dict = Depends(get_admin_user)):
    result = await db.listings.update_one(
        {"id": listing_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    # Notify owner
    listing = await db.listings.find_one({"id": listing_id})
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": listing["owner_id"],
        "type": "listing_status",
        "title": f"Listing {status}",
        "message": f"Your listing '{listing['title']}' has been {status}",
        "data": {"listing_id": listing_id},
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {"message": f"Listing status updated to {status}"}

@api_router.put("/admin/users/{user_id}/verify-aadhar")
async def verify_user_aadhar(
    user_id: str,
    status: str = Query(...),
    user: dict = Depends(get_admin_user)
):
    # Convert boolean-like strings
    if status == "true" or status == True:
        status = VerificationStatus.VERIFIED
    elif status == "false" or status == False:
        status = VerificationStatus.REJECTED
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"aadhar_status": status, "is_verified": status == VerificationStatus.VERIFIED}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": f"Aadhar verification status updated to {status}"}

@api_router.get("/admin/bookings")
async def get_all_bookings_admin(user: dict = Depends(get_admin_user), status: Optional[BookingStatus] = None, page: int = 1, limit: int = 50):
    query = {}
    if status:
        query["status"] = status
    
    skip = (page - 1) * limit
    bookings = await db.bookings.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.bookings.count_documents(query)
    
    return {"bookings": bookings, "total": total, "page": page}

@api_router.get("/admin/stats")
async def get_admin_stats(user: dict = Depends(get_admin_user)):
    total_users = await db.users.count_documents({})
    users_by_role = {}
    for role in UserRole:
        users_by_role[role.value] = await db.users.count_documents({"role": role})
    
    total_listings = await db.listings.count_documents({})
    pending_listings = await db.listings.count_documents({"status": ListingStatus.PENDING})
    approved_listings = await db.listings.count_documents({"status": ListingStatus.APPROVED})
    
    total_bookings = await db.bookings.count_documents({})
    bookings_by_status = {}
    for status in BookingStatus:
        bookings_by_status[status.value] = await db.bookings.count_documents({"status": status})
    
    total_videos = await db.videos.count_documents({})
    total_reviews = await db.reviews.count_documents({})
    total_messages = await db.messages.count_documents({})
    
    category_stats = {}
    for cat in ListingCategory:
        category_stats[cat.value] = await db.listings.count_documents({"category": cat.value})
    
    # Top cities
    pipeline = [
        {"$group": {"_id": "$city", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    top_cities = await db.listings.aggregate(pipeline).to_list(10)
    
    return {
        "total_users": total_users,
        "users_by_role": users_by_role,
        "total_listings": total_listings,
        "pending_listings": pending_listings,
        "approved_listings": approved_listings,
        "total_bookings": total_bookings,
        "bookings_by_status": bookings_by_status,
        "total_videos": total_videos,
        "total_reviews": total_reviews,
        "total_messages": total_messages,
        "category_stats": category_stats,
        "top_cities": [{"city": c["_id"], "count": c["count"]} for c in top_cities]
    }

@api_router.post("/admin/create")
async def create_admin(admin_data: UserRegister):
    existing = await db.users.find_one({"role": UserRole.ADMIN})
    if existing:
        raise HTTPException(status_code=400, detail="Admin already exists. Use invite system for additional admins.")
    
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
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(admin_doc)
    token = create_token(user_id, UserRole.ADMIN)
    
    return {"message": "Admin created successfully", "token": token}

# ============ OWNER DASHBOARD ROUTES ============
@api_router.get("/owner/listings")
async def get_owner_listings(user: dict = Depends(get_owner_user)):
    listings = await db.listings.find({"owner_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
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
    pending_bookings = await db.bookings.count_documents({"owner_id": user["id"], "status": BookingStatus.PENDING})
    confirmed_bookings = await db.bookings.count_documents({"owner_id": user["id"], "status": BookingStatus.CONFIRMED})
    
    videos = await db.videos.find({"owner_id": user["id"]}, {"_id": 0, "views": 1, "likes": 1}).to_list(100)
    total_reel_views = sum(v.get("views", 0) for v in videos)
    total_reel_likes = sum(v.get("likes", 0) for v in videos)
    
    negotiations = await db.negotiations.count_documents({"owner_id": user["id"], "status": NegotiationStatus.PENDING})
    
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
        "pending_negotiations": negotiations
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
        {"$sort": {"_id": 1}}
    ]
    booking_trend = await db.bookings.aggregate(pipeline).to_list(days)
    
    return {
        "period": f"Last {days} days",
        "total_listings": len(listings),
        "booking_trend": [{"date": b["_id"], "bookings": b["count"]} for b in booking_trend],
        "top_listing": max(listings, key=lambda x: x.get("views", 0)) if listings else None
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
                    {"id": "villa", "name": "Villa", "name_gu": "વિલા"}
                ]
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
                    {"id": "coworking", "name": "Co-working Space", "name_gu": "કો-વર્કિંગ"},
                    {"id": "warehouse", "name": "Warehouse", "name_gu": "ગોડાઉન"},
                    {"id": "godown", "name": "Godown", "name_gu": "ગોડાઉન"},
                    {"id": "factory", "name": "Factory Shed", "name_gu": "ફેક્ટરી"},
                    {"id": "industrial_land", "name": "Industrial Land", "name_gu": "ઔદ્યોગિક જમીન"},
                    {"id": "restaurant_space", "name": "Restaurant Space", "name_gu": "રેસ્ટોરન્ટ"},
                    {"id": "cafe_space", "name": "Cafe Space", "name_gu": "કેફે"},
                    {"id": "cloud_kitchen", "name": "Cloud Kitchen", "name_gu": "ક્લાઉડ કિચન"}
                ]
            },
            {
                "id": "stay",
                "name": "Stay",
                "name_gu": "રહેવાનું",
                "icon": "Hotel",
                "description": "Hotels, rooms and accommodations",
                "sub_categories": [
                    {"id": "hotel", "name": "Hotel", "name_gu": "હોટેલ"},
                    {"id": "budget_hotel", "name": "Budget Hotel", "name_gu": "બજેટ હોટેલ"},
                    {"id": "luxury_hotel", "name": "Luxury Hotel", "name_gu": "લક્ઝરી હોટેલ"},
                    {"id": "room", "name": "Room", "name_gu": "રૂમ"},
                    {"id": "guesthouse", "name": "Guest House", "name_gu": "ગેસ્ટ હાઉસ"},
                    {"id": "resort", "name": "Resort", "name_gu": "રિસોર્ટ"},
                    {"id": "pg_stay", "name": "PG Accommodation", "name_gu": "PG"},
                    {"id": "homestay", "name": "Homestay", "name_gu": "હોમસ્ટે"}
                ]
            },
            {
                "id": "event",
                "name": "Event",
                "name_gu": "ઇવેન્ટ",
                "icon": "PartyPopper",
                "description": "Event venues for celebrations",
                "sub_categories": [
                    {"id": "partyplot", "name": "Party Plot", "name_gu": "પાર્ટી પ્લોટ"},
                    {"id": "marriagehall", "name": "Marriage Hall", "name_gu": "લગ્ન હોલ"},
                    {"id": "banquethall", "name": "Banquet Hall", "name_gu": "બેંક્વેટ હોલ"},
                    {"id": "conference", "name": "Conference Hall", "name_gu": "કોન્ફરન્સ હોલ"},
                    {"id": "farmhouse_venue", "name": "Farmhouse Venue", "name_gu": "ફાર્મહાઉસ વેન્યુ"},
                    {"id": "hotel_venue", "name": "Hotel Venue", "name_gu": "હોટેલ વેન્યુ"},
                    {"id": "outdoor_venue", "name": "Outdoor Venue", "name_gu": "આઉટડોર વેન્યુ"},
                    {"id": "birthday_venue", "name": "Birthday Party Venue", "name_gu": "બર્થડે વેન્યુ"}
                ]
            },
            {
                "id": "services",
                "name": "Services",
                "name_gu": "સેવાઓ",
                "icon": "Wrench",
                "description": "Home and professional services",
                "sub_categories": [
                    {"id": "plumber", "name": "Plumber", "name_gu": "પ્લમ્બર"},
                    {"id": "electrician", "name": "Electrician", "name_gu": "ઇલેક્ટ્રિશિયન"},
                    {"id": "ac_repair", "name": "AC Repair", "name_gu": "AC રિપેર"},
                    {"id": "washing_machine", "name": "Washing Machine Repair", "name_gu": "વોશિંગ મશીન"},
                    {"id": "ro_repair", "name": "RO Repair", "name_gu": "RO રિપેર"},
                    {"id": "cctv", "name": "CCTV Installation", "name_gu": "CCTV"},
                    {"id": "home_cleaning", "name": "Home Cleaning", "name_gu": "ઘર સફાઈ"},
                    {"id": "bathroom_cleaning", "name": "Bathroom Cleaning", "name_gu": "બાથરૂમ સફાઈ"},
                    {"id": "sofa_cleaning", "name": "Sofa Cleaning", "name_gu": "સોફા સફાઈ"},
                    {"id": "painting", "name": "Painting", "name_gu": "પેઇન્ટિંગ"},
                    {"id": "false_ceiling", "name": "False Ceiling", "name_gu": "ફોલ્સ સિલિંગ"},
                    {"id": "tile_work", "name": "Tile Work", "name_gu": "ટાઇલ વર્ક"},
                    {"id": "carpenter", "name": "Carpenter", "name_gu": "સુથાર"},
                    {"id": "pest_control", "name": "Pest Control", "name_gu": "પેસ્ટ કંટ્રોલ"},
                    {"id": "garden", "name": "Garden Maintenance", "name_gu": "ગાર્ડન"},
                    {"id": "packers_movers", "name": "Packers & Movers", "name_gu": "પેકર્સ મૂવર્સ"}
                ]
            }
        ]
    }

# ============ SEARCH HISTORY ============
@api_router.post("/search/history")
async def add_search_history(query: str, user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": user["id"]},
        {"$push": {"search_history": {"$each": [{"query": query, "date": datetime.now(timezone.utc).isoformat()}], "$slice": -50}}}
    )
    return {"message": "Search recorded"}

@api_router.get("/search/history")
async def get_search_history(user: dict = Depends(get_current_user)):
    user_data = await db.users.find_one({"id": user["id"]}, {"search_history": 1})
    return {"history": user_data.get("search_history", [])[-20:]}

# ============ HEALTH CHECK ============
@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "version": "2.0.0", "timestamp": datetime.now(timezone.utc).isoformat()}

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
RAZORPAY_KEY_ID = os.environ.get('RAZORPAY_KEY_ID', '')
RAZORPAY_KEY_SECRET = os.environ.get('RAZORPAY_KEY_SECRET', '')

if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    logger.info("Razorpay client initialized successfully")

class PaymentOrderRequest(BaseModel):
    amount: int = Field(..., description="Amount in paise (1 INR = 100 paise)")
    listing_id: str
    booking_type: str = Field(..., description="stay, event, services")
    booking_date: Optional[str] = None
    guests: Optional[int] = 1
    notes: Optional[str] = None

class PaymentVerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str

@api_router.post("/payments/create-order")
async def create_payment_order(
    request: PaymentOrderRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Create Razorpay payment order for booking"""
    user = await get_current_user(credentials)
    user_id = user["id"]
    
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Payment gateway not configured")
    
    try:
        # Create Razorpay order
        order_data = {
            'amount': request.amount,  # Amount in paise
            'currency': 'INR',
            'receipt': f'order_{uuid.uuid4().hex[:12]}',
            'notes': {
                'user_id': user_id,
                'listing_id': request.listing_id,
                'booking_type': request.booking_type
            }
        }
        
        order = razorpay_client.order.create(data=order_data)
        
        # Save payment order to database
        payment_record = {
            'id': str(uuid.uuid4()),
            'user_id': user_id,
            'listing_id': request.listing_id,
            'razorpay_order_id': order['id'],
            'amount': request.amount,
            'currency': 'INR',
            'booking_type': request.booking_type,
            'booking_date': request.booking_date,
            'guests': request.guests,
            'notes': request.notes,
            'status': 'created',
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        
        await db.payments.insert_one(payment_record)
        
        return {
            'order_id': order['id'],
            'amount': request.amount,
            'currency': 'INR',
            'key_id': RAZORPAY_KEY_ID,
            'payment_id': payment_record['id']
        }
        
    except Exception as e:
        logger.error(f"Razorpay order creation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Payment order creation failed: {str(e)}")

@api_router.post("/payments/verify")
async def verify_payment(
    request: PaymentVerifyRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Verify Razorpay payment and confirm booking"""
    user = await get_current_user(credentials)
    user_id = user["id"]
    
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Payment gateway not configured")
    
    try:
        # Verify signature
        params_dict = {
            'razorpay_order_id': request.razorpay_order_id,
            'razorpay_payment_id': request.razorpay_payment_id,
            'razorpay_signature': request.razorpay_signature
        }
        
        razorpay_client.utility.verify_payment_signature(params_dict)
        
        # Update payment record
        payment = await db.payments.find_one({'razorpay_order_id': request.razorpay_order_id})
        
        if not payment:
            raise HTTPException(status_code=404, detail="Payment record not found")
        
        await db.payments.update_one(
            {'razorpay_order_id': request.razorpay_order_id},
            {'$set': {
                'razorpay_payment_id': request.razorpay_payment_id,
                'razorpay_signature': request.razorpay_signature,
                'status': 'paid',
                'paid_at': datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Create booking
        booking = {
            'id': str(uuid.uuid4()),
            'user_id': user_id,
            'listing_id': payment['listing_id'],
            'payment_id': payment['id'],
            'booking_date': payment.get('booking_date'),
            'guests': payment.get('guests', 1),
            'amount_paid': payment['amount'],
            'status': 'confirmed',
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        
        await db.bookings.insert_one(booking)
        
        return {
            'success': True,
            'message': 'Payment verified and booking confirmed!',
            'booking_id': booking['id']
        }
        
    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid payment signature")
    except Exception as e:
        logger.error(f"Payment verification failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Payment verification failed: {str(e)}")

@api_router.get("/payments/config")
async def get_payment_config():
    """Get Razorpay configuration for frontend"""
    return {
        'key_id': RAZORPAY_KEY_ID,
        'enabled': bool(razorpay_client)
    }

# ============ NOTIFICATIONS API ============

@api_router.get("/notifications")
async def get_notifications(
    limit: int = Query(20, le=50),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get user notifications"""
    user = await get_current_user(credentials)
    
    notifications = await db.notifications.find(
        {'user_id': user["id"]},
        {'_id': 0}
    ).sort('created_at', -1).limit(limit).to_list(limit)
    
    unread_count = await db.notifications.count_documents({
        'user_id': user["id"],
        'read': False
    })
    
    return {
        'notifications': notifications,
        'unread_count': unread_count
    }

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Mark notification as read"""
    user = await get_current_user(credentials)
    
    result = await db.notifications.update_one(
        {'id': notification_id, 'user_id': user["id"]},
        {'$set': {'read': True}}
    )
    
    return {'success': result.modified_count > 0}

@api_router.put("/notifications/read-all")
async def mark_all_notifications_read(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Mark all notifications as read"""
    user = await get_current_user(credentials)
    
    result = await db.notifications.update_many(
        {'user_id': user["id"], 'read': False},
        {'$set': {'read': True}}
    )
    
    return {'success': True, 'count': result.modified_count}

# ============ AI PROPERTY RECOMMENDATION ============
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

@api_router.get("/recommendations")
async def get_ai_recommendations(
    limit: int = Query(6, le=12),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get AI-powered property recommendations based on user behavior"""
    user = await get_current_user(credentials)
    user_id = user["id"]
    
    # Get user's search history, viewed listings, saved videos, and wishlist
    search_history = await db.search_history.find(
        {'user_id': user_id}
    ).sort('created_at', -1).limit(10).to_list(10)
    
    wishlist = await db.wishlists.find(
        {'user_id': user_id}
    ).to_list(20)
    wishlist_ids = [w.get('listing_id') for w in wishlist]
    
    saved_videos = user.get('saved_videos', [])
    
    # Get user's preferred categories from search history
    categories_searched = [s.get('category') for s in search_history if s.get('category')]
    cities_searched = [s.get('city') for s in search_history if s.get('city')]
    
    # Build recommendation context
    context = {
        'categories': list(set(categories_searched)) or ['home', 'stay'],
        'cities': list(set(cities_searched)) or ['Surat'],
        'price_range': 'medium',  # Can be enhanced with actual data
        'saved_count': len(wishlist_ids),
    }
    
    # Get some listings from preferred categories
    preferred_listings = await db.listings.find(
        {
            'category': {'$in': context['categories']},
            'status': 'approved',
            'id': {'$nin': wishlist_ids}  # Exclude already saved
        },
        {'_id': 0}
    ).limit(20).to_list(20)
    
    # If user has EMERGENT_LLM_KEY, use AI for smart recommendations
    recommended = []
    ai_explanation = ""
    
    if EMERGENT_LLM_KEY and len(preferred_listings) > 0:
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage
            
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"rec_{user_id}_{datetime.now().strftime('%Y%m%d')}",
                system_message="""You are a property recommendation AI for GharSetu, Gujarat's #1 real estate platform. 
                Analyze user preferences and recommend the best matching properties. 
                Be concise and helpful. Respond in JSON format with 'recommended_ids' array and 'explanation' string."""
            ).with_model("openai", "gpt-4.1-mini")
            
            listings_summary = "\n".join([
                f"- ID: {l['id'][:8]}, {l['title']}, {l['category']}, ₹{l.get('price', 0)}, {l.get('city', 'Unknown')}"
                for l in preferred_listings[:10]
            ])
            
            prompt = f"""User preferences:
- Searched categories: {context['categories']}
- Searched cities: {context['cities']}
- Saved {context['saved_count']} properties

Available listings:
{listings_summary}

Select top {min(limit, 6)} properties that best match user preferences. Return JSON with:
{{"recommended_ids": ["id1", "id2", ...], "explanation": "Brief explanation in Gujarati"}}"""
            
            response = await chat.send_message(UserMessage(text=prompt))
            
            # Parse AI response
            import re
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                ai_result = json.loads(json_match.group())
                rec_ids = ai_result.get('recommended_ids', [])
                ai_explanation = ai_result.get('explanation', '')
                
                # Get full listing details for recommended IDs
                for l in preferred_listings:
                    if any(l['id'].startswith(rid) for rid in rec_ids):
                        recommended.append(l)
                        if len(recommended) >= limit:
                            break
        except Exception as e:
            logger.error(f"AI recommendation failed: {e}")
    
    # Fallback to simple recommendations if AI fails or not available
    if len(recommended) < limit:
        # Add trending/popular listings
        fallback = preferred_listings[:limit - len(recommended)]
        recommended.extend(fallback)
    
    return {
        'recommendations': recommended[:limit],
        'ai_explanation': ai_explanation,
        'context': context,
        'total': len(recommended)
    }

@api_router.get("/recommendations/similar/{listing_id}")
async def get_similar_properties(
    listing_id: str,
    limit: int = Query(4, le=8)
):
    """Get similar properties to a given listing"""
    # Get the source listing
    listing = await db.listings.find_one({'id': listing_id}, {'_id': 0})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    # Find similar listings (same category, similar price range, same city)
    price = listing.get('price', 0)
    price_min = price * 0.7
    price_max = price * 1.3
    
    similar = await db.listings.find(
        {
            'id': {'$ne': listing_id},
            'category': listing.get('category'),
            'city': listing.get('city'),
            'price': {'$gte': price_min, '$lte': price_max},
            'status': 'approved'
        },
        {'_id': 0}
    ).limit(limit).to_list(limit)
    
    # If not enough, relax constraints
    if len(similar) < limit:
        more = await db.listings.find(
            {
                'id': {'$ne': listing_id},
                'category': listing.get('category'),
                'status': 'approved'
            },
            {'_id': 0}
        ).limit(limit - len(similar)).to_list(limit - len(similar))
        similar.extend(more)
    
    return {
        'similar': similar[:limit],
        'based_on': {
            'category': listing.get('category'),
            'city': listing.get('city'),
            'price_range': f"₹{int(price_min):,} - ₹{int(price_max):,}"
        }
    }

# ============ BOOST LISTING FEATURE ============
BOOST_PRICES = {
    '7_days': 9900,    # ₹99
    '15_days': 17900,  # ₹179
    '30_days': 29900,  # ₹299
}

class BoostRequest(BaseModel):
    listing_id: str
    duration: str = Field(..., description="7_days, 15_days, or 30_days")

@api_router.post("/listings/boost/create-order")
async def create_boost_order(
    request: BoostRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Create Razorpay order for boosting a listing"""
    user = await get_current_user(credentials)
    
    # Verify listing belongs to user
    listing = await db.listings.find_one({'id': request.listing_id, 'owner_id': user["id"]})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found or not owned by you")
    
    if request.duration not in BOOST_PRICES:
        raise HTTPException(status_code=400, detail="Invalid boost duration")
    
    amount = BOOST_PRICES[request.duration]
    days = int(request.duration.split('_')[0])
    
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Payment gateway not configured")
    
    try:
        order_data = {
            'amount': amount,
            'currency': 'INR',
            'receipt': f'boost_{uuid.uuid4().hex[:12]}',
            'notes': {
                'user_id': user["id"],
                'listing_id': request.listing_id,
                'type': 'boost',
                'duration': request.duration
            }
        }
        
        order = razorpay_client.order.create(data=order_data)
        
        boost_record = {
            'id': str(uuid.uuid4()),
            'user_id': user["id"],
            'listing_id': request.listing_id,
            'razorpay_order_id': order['id'],
            'amount': amount,
            'duration': request.duration,
            'days': days,
            'status': 'pending',
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        
        await db.boosts.insert_one(boost_record)
        
        return {
            'order_id': order['id'],
            'amount': amount,
            'currency': 'INR',
            'key_id': RAZORPAY_KEY_ID,
            'boost_id': boost_record['id'],
            'listing_title': listing.get('title'),
            'duration': f"{days} days",
            'price': f"₹{amount // 100}"
        }
        
    except Exception as e:
        logger.error(f"Boost order creation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/listings/boost/verify")
async def verify_boost_payment(
    request: PaymentVerifyRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Verify boost payment and activate boost"""
    user = await get_current_user(credentials)
    
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Payment gateway not configured")
    
    try:
        # Verify signature
        razorpay_client.utility.verify_payment_signature({
            'razorpay_order_id': request.razorpay_order_id,
            'razorpay_payment_id': request.razorpay_payment_id,
            'razorpay_signature': request.razorpay_signature
        })
        
        # Get boost record
        boost = await db.boosts.find_one({'razorpay_order_id': request.razorpay_order_id})
        if not boost:
            raise HTTPException(status_code=404, detail="Boost record not found")
        
        # Calculate expiry
        days = boost['days']
        expires_at = datetime.now(timezone.utc) + timedelta(days=days)
        
        # Update boost status
        await db.boosts.update_one(
            {'id': boost['id']},
            {'$set': {
                'status': 'active',
                'razorpay_payment_id': request.razorpay_payment_id,
                'activated_at': datetime.now(timezone.utc).isoformat(),
                'expires_at': expires_at.isoformat()
            }}
        )
        
        # Update listing with boost flag
        await db.listings.update_one(
            {'id': boost['listing_id']},
            {'$set': {
                'is_boosted': True,
                'boost_expires_at': expires_at.isoformat()
            }}
        )
        
        return {
            'success': True,
            'message': f'Listing boosted for {days} days!',
            'boost': {
                'listing_id': boost['listing_id'],
                'expires_at': expires_at.isoformat(),
                'days_remaining': days
            }
        }
        
    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid payment signature")
    except Exception as e:
        logger.error(f"Boost verification failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/listings/{listing_id}/boost-status")
async def get_boost_status(
    listing_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get boost status for a listing"""
    user = await get_current_user(credentials)
    
    listing = await db.listings.find_one({'id': listing_id, 'owner_id': user["id"]}, {'_id': 0})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    is_boosted = listing.get('is_boosted', False)
    boost_expires_at = listing.get('boost_expires_at')
    
    if is_boosted and boost_expires_at:
        expires = datetime.fromisoformat(boost_expires_at.replace('Z', '+00:00'))
        if expires < datetime.now(timezone.utc):
            # Boost expired, update listing
            await db.listings.update_one(
                {'id': listing_id},
                {'$set': {'is_boosted': False}}
            )
            is_boosted = False
    
    return {
        'is_boosted': is_boosted,
        'expires_at': boost_expires_at if is_boosted else None,
        'prices': {
            '7_days': '₹99',
            '15_days': '₹179',
            '30_days': '₹299'
        }
    }

# ============ SERVICE PROVIDER SUBSCRIPTION ============
SUBSCRIPTION_AMOUNT = 25100  # ₹251 in paise

class SubscriptionRequest(BaseModel):
    plan: str = Field("monthly", description="Subscription plan: monthly")

@api_router.post("/subscriptions/create-order")
async def create_subscription_order(
    request: SubscriptionRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Create Razorpay order for service provider subscription (₹251/month)"""
    user = await get_current_user(credentials)
    
    # Only service providers can subscribe
    if user.get("role") != "service_provider":
        raise HTTPException(status_code=403, detail="Only service providers can subscribe")
    
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Payment gateway not configured")
    
    try:
        order_data = {
            'amount': SUBSCRIPTION_AMOUNT,
            'currency': 'INR',
            'receipt': f'sub_{uuid.uuid4().hex[:12]}',
            'notes': {
                'user_id': user["id"],
                'type': 'subscription',
                'plan': request.plan
            }
        }
        
        order = razorpay_client.order.create(data=order_data)
        
        subscription_record = {
            'id': str(uuid.uuid4()),
            'user_id': user["id"],
            'razorpay_order_id': order['id'],
            'amount': SUBSCRIPTION_AMOUNT,
            'plan': request.plan,
            'status': 'pending',
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        
        await db.subscriptions.insert_one(subscription_record)
        
        return {
            'order_id': order['id'],
            'amount': SUBSCRIPTION_AMOUNT,
            'currency': 'INR',
            'key_id': RAZORPAY_KEY_ID,
            'subscription_id': subscription_record['id'],
            'plan_details': {
                'name': 'Monthly Subscription',
                'price': '₹251/month',
                'features': [
                    'List unlimited services',
                    'Priority in search results',
                    'Verified badge',
                    'Analytics dashboard',
                    'Direct customer inquiries'
                ]
            }
        }
        
    except Exception as e:
        logger.error(f"Subscription order creation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/subscriptions/verify")
async def verify_subscription_payment(
    request: PaymentVerifyRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Verify subscription payment and activate subscription"""
    user = await get_current_user(credentials)
    
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Payment gateway not configured")
    
    try:
        # Verify signature
        razorpay_client.utility.verify_payment_signature({
            'razorpay_order_id': request.razorpay_order_id,
            'razorpay_payment_id': request.razorpay_payment_id,
            'razorpay_signature': request.razorpay_signature
        })
        
        # Update subscription status
        subscription = await db.subscriptions.find_one({'razorpay_order_id': request.razorpay_order_id})
        if not subscription:
            raise HTTPException(status_code=404, detail="Subscription not found")
        
        # Calculate expiry (30 days from now)
        expiry_date = datetime.now(timezone.utc) + timedelta(days=30)
        
        await db.subscriptions.update_one(
            {'id': subscription['id']},
            {'$set': {
                'status': 'active',
                'razorpay_payment_id': request.razorpay_payment_id,
                'activated_at': datetime.now(timezone.utc).isoformat(),
                'expires_at': expiry_date.isoformat()
            }}
        )
        
        # Update user subscription status
        await db.users.update_one(
            {'id': user["id"]},
            {'$set': {
                'subscription': 'active',
                'subscription_expires': expiry_date.isoformat()
            }}
        )
        
        return {
            'success': True,
            'message': 'Subscription activated successfully!',
            'subscription': {
                'status': 'active',
                'plan': subscription['plan'],
                'expires_at': expiry_date.isoformat()
            }
        }
        
    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid payment signature")
    except Exception as e:
        logger.error(f"Subscription verification failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/subscriptions/status")
async def get_subscription_status(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user's subscription status"""
    user = await get_current_user(credentials)
    
    if user.get("role") != "service_provider":
        return {'has_subscription': False, 'message': 'Not a service provider'}
    
    subscription = await db.subscriptions.find_one(
        {'user_id': user["id"], 'status': 'active'},
        {'_id': 0}
    )
    
    if subscription:
        expires_at = datetime.fromisoformat(subscription['expires_at'].replace('Z', '+00:00'))
        is_active = expires_at > datetime.now(timezone.utc)
        
        return {
            'has_subscription': is_active,
            'subscription': subscription if is_active else None,
            'message': 'Active subscription' if is_active else 'Subscription expired'
        }
    
    return {
        'has_subscription': False,
        'subscription': None,
        'message': 'No active subscription',
        'price': '₹251/month',
        'features': [
            'List unlimited services',
            'Priority in search results',
            'Verified badge',
            'Analytics dashboard',
            'Direct customer inquiries'
        ]
    }

# Include the router in the main app
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
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
    logger.info(f"Socket.IO client disconnected: {sid}, user: {user_id}")

@sio.event
async def authenticate(sid, data):
    """Authenticate user with JWT token"""
    try:
        token = data.get('token')
        if not token:
            await sio.emit('auth_error', {'message': 'Token required'}, to=sid)
            return
        
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get('user_id')
        
        if user_id:
            connected_users[user_id] = sid
            await sio.emit('authenticated', {'user_id': user_id}, to=sid)
            logger.info(f"User {user_id} authenticated on socket {sid}")
            
            # Send any unread notifications
            notifications = await db.notifications.find(
                {'user_id': user_id, 'read': False}
            ).sort('created_at', -1).limit(10).to_list(10)
            
            for notif in notifications:
                notif['_id'] = str(notif['_id'])
            
            if notifications:
                await sio.emit('unread_notifications', {
                    'notifications': notifications,
                    'count': len(notifications)
                }, to=sid)
    except jwt.ExpiredSignatureError:
        await sio.emit('auth_error', {'message': 'Token expired'}, to=sid)
    except Exception as e:
        logger.error(f"Socket auth error: {e}")
        await sio.emit('auth_error', {'message': 'Authentication failed'}, to=sid)

@sio.event
async def mark_notification_read(sid, data):
    """Mark notification as read"""
    notification_id = data.get('notification_id')
    if notification_id:
        await db.notifications.update_one(
            {'id': notification_id},
            {'$set': {'read': True}}
        )
        await sio.emit('notification_marked_read', {'notification_id': notification_id}, to=sid)

@sio.event
async def join_chat(sid, data):
    """Join a chat room"""
    chat_id = data.get('chat_id')
    if chat_id:
        await sio.enter_room(sid, f"chat_{chat_id}")
        await sio.emit('joined_chat', {'chat_id': chat_id}, to=sid)

@sio.event
async def leave_chat(sid, data):
    """Leave a chat room"""
    chat_id = data.get('chat_id')
    if chat_id:
        await sio.leave_room(sid, f"chat_{chat_id}")

@sio.event
async def send_message(sid, data):
    """Send chat message"""
    chat_id = data.get('chat_id')
    message = data.get('message')
    sender_id = data.get('sender_id')
    
    if chat_id and message:
        # Save message to DB
        msg_doc = {
            'id': str(uuid.uuid4()),
            'chat_id': chat_id,
            'sender_id': sender_id,
            'message': message,
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        await db.messages.insert_one(msg_doc)
        
        # Broadcast to chat room
        await sio.emit('new_message', msg_doc, room=f"chat_{chat_id}")

# Helper function to send notifications
async def send_notification(user_id: str, notification_type: str, title: str, message: str, data: dict = None):
    """Send notification to user via Socket.IO and save to DB"""
    notification = {
        'id': str(uuid.uuid4()),
        'user_id': user_id,
        'type': notification_type,
        'title': title,
        'message': message,
        'data': data or {},
        'read': False,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    # Save to DB
    await db.notifications.insert_one(notification)
    
    # Send via Socket.IO if user is connected
    if user_id in connected_users:
        sid = connected_users[user_id]
        await sio.emit('notification', notification, to=sid)
    
    return notification

# Mount Socket.IO on the app
socket_app = socketio.ASGIApp(sio, app)

@app.on_event("startup")
async def startup_services():
    global redis_client, delete_worker_task
    if redis_asyncio and redis_url:
        try:
            redis_client = redis_asyncio.from_url(redis_url, encoding="utf-8", decode_responses=True)
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

    delete_worker_task = asyncio.create_task(media_delete_retry_worker())

@app.on_event("shutdown")
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
