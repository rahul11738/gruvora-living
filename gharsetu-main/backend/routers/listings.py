from datetime import datetime, timezone
from typing import Any, Dict
from uuid import uuid4

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import ValidationError

from models.listing_base import ListingBaseCreate
from validators.listing_factory import validate_specific_fields


router = APIRouter(prefix="/api/listings", tags=["listings"])


# This dependency is intentionally expected from the host app.
def get_owner_user() -> Dict[str, Any]:  # pragma: no cover
    raise NotImplementedError


# This dependency is intentionally expected from the host app.
class db:  # pragma: no cover
    listings = None
    users = None


@router.post("")
async def create_listing(
    payload: Dict[str, Any] = Body(...),
    user: dict = Depends(get_owner_user),
):
    role = str(user.get("role") or "").strip()
    category = str(payload.get("category") or "").strip()
    if not category:
        raise HTTPException(status_code=422, detail="category is required")

    try:
        base = ListingBaseCreate(**payload)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors())

    raw_specific = payload.get("category_specific_fields") or {}
    if not isinstance(raw_specific, dict):
        raise HTTPException(status_code=422, detail="category_specific_fields must be an object")

    specific = validate_specific_fields(role, category, raw_specific)

    listing_id = str(uuid4())
    now = datetime.now(timezone.utc).isoformat()

    doc = {
        "id": listing_id,
        "category": category,
        "owner_id": user["id"],
        "owner_name": user.get("name", ""),
        "owner_role": role,
        "owner_verified": str(user.get("aadhar_status") or "").strip() == "verified",
        **base.model_dump(exclude={"pricing", "media"}),
        "pricing": base.pricing.model_dump(),
        "media": base.media.model_dump(),
        "category_specific_fields": specific.model_dump(),
        "status": "pending",
        "is_available": True,
        "is_draft": base.is_draft,
        "views": 0,
        "likes": 0,
        "saves": 0,
        "inquiries": 0,
        "boost_expires": None,
        "contact_unlocked_user_ids": [],
        "created_at": now,
        "updated_at": now,
    }

    await db.listings.insert_one(doc)
    await db.users.update_one({"id": user["id"]}, {"$push": {"listings": listing_id}})

    return {"message": "Listing created", "listing_id": listing_id}
