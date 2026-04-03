from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class StayType(str, Enum):
    HOTEL = "hotel"
    HOSTEL = "hostel"
    RESORT = "resort"
    HOMESTAY = "homestay"
    GUESTHOUSE = "guesthouse"
    PG = "pg"


class RoomType(str, Enum):
    AC = "ac"
    NON_AC = "non_ac"
    DELUXE = "deluxe"
    SUITE = "suite"
    DORMITORY = "dormitory"


class CancellationPolicy(str, Enum):
    FLEXIBLE = "flexible"
    MODERATE = "moderate"
    STRICT = "strict"


class RoomConfig(BaseModel):
    room_type: RoomType
    count: int = Field(..., ge=1)
    price_per_night: float = Field(..., gt=0)
    max_occupancy: int = Field(..., ge=1)
    amenities: List[str] = Field(default_factory=list)


class StaySpecificFields(BaseModel):
    stay_type: StayType
    total_rooms: int = Field(..., ge=1)
    available_rooms: int = Field(..., ge=0)
    room_configs: List[RoomConfig] = Field(..., min_length=1)
    check_in_time: str = "14:00"
    check_out_time: str = "11:00"
    amenities: List[str] = Field(default_factory=list)
    star_rating: Optional[int] = Field(None, ge=1, le=5)
    cancellation_policy: CancellationPolicy = CancellationPolicy.MODERATE
    instant_booking: bool = True
    minimum_stay_nights: int = 1
    pet_friendly: bool = False
    extra_bed_available: bool = False
    extra_bed_charge: Optional[float] = None

    @field_validator("available_rooms")
    @classmethod
    def available_lte_total(cls, value, info):
        total_rooms = info.data.get("total_rooms", 0)
        if value > total_rooms:
            raise ValueError("available_rooms cannot exceed total_rooms")
        return value
