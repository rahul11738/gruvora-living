from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class EventVenueType(str, Enum):
    PARTY_PLOT = "party_plot"
    MARRIAGE_HALL = "marriage_hall"
    BANQUET = "banquet"
    CONFERENCE = "conference"
    FARMHOUSE = "farmhouse"
    OUTDOOR = "outdoor"
    ROOFTOP = "rooftop"


class EventPackage(BaseModel):
    name: str
    price: float = Field(..., gt=0)
    capacity: int = Field(..., ge=1)
    inclusions: List[str] = Field(default_factory=list)
    duration_hours: Optional[float] = None


class FacilityItem(BaseModel):
    name: str
    available: bool = True
    extra_charge: Optional[float] = None


class EventSpecificFields(BaseModel):
    venue_type: EventVenueType
    indoor_capacity: int = Field(..., ge=0)
    outdoor_capacity: int = 0
    price_per_day: float = Field(..., gt=0)
    price_per_half_day: Optional[float] = None
    advance_booking_days: int = Field(7, ge=0)
    packages: List[EventPackage] = Field(default_factory=list)
    facilities: List[FacilityItem] = Field(default_factory=list)
    catering_available: bool = False
    catering_type: Optional[str] = None
    decoration_available: bool = False
    parking_capacity: Optional[int] = None
    blocked_dates: List[str] = Field(default_factory=list)
    alcohol_permitted: bool = False
    dj_permitted: bool = False
    open_till: Optional[str] = None
