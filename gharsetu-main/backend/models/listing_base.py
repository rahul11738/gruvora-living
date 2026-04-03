from typing import List, Optional

from pydantic import BaseModel, Field


class PricingModel(BaseModel):
    type: str  # fixed / hourly / per_night / per_day
    amount: float
    currency: str = "INR"
    negotiable: bool = False
    security_deposit: Optional[float] = None


class MediaBundle(BaseModel):
    images: List[str] = Field(default_factory=list)  # Cloudinary public_ids/URLs
    videos: List[str] = Field(default_factory=list)
    virtual_tour_url: Optional[str] = None
    floor_plan_url: Optional[str] = None


class ListingBaseCreate(BaseModel):
    title: str = Field(..., min_length=5, max_length=200)
    description: str = Field(..., min_length=20, max_length=5000)
    location: str
    city: str
    state: str = "Gujarat"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    contact_phone: str
    contact_email: str
    pricing: PricingModel
    media: MediaBundle = Field(default_factory=MediaBundle)
    tags: List[str] = Field(default_factory=list)
    is_draft: bool = False
