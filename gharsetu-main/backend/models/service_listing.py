from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class ServiceType(str, Enum):
    PLUMBER = "plumber"
    ELECTRICIAN = "electrician"
    CLEANER = "cleaner"
    AC_REPAIR = "ac_repair"
    PAINTER = "painter"
    CARPENTER = "carpenter"
    PEST_CONTROL = "pest_control"
    PACKERS_MOVERS = "packers_movers"
    CCTV = "cctv"
    RO_REPAIR = "ro_repair"


class PricingType(str, Enum):
    HOURLY = "hourly"
    FIXED = "fixed"
    QUOTE_BASED = "quote_based"


class TimeSlot(BaseModel):
    day: str
    start: str
    end: str


class ServiceSpecificFields(BaseModel):
    service_type: ServiceType
    pricing_type: PricingType
    min_charge: Optional[float] = Field(None, gt=0)
    max_charge: Optional[float] = None
    experience_years: int = Field(..., ge=0, le=60)
    skills: List[str] = Field(..., min_length=1, max_length=20)
    service_radius_km: float = Field(..., gt=0, le=200)
    availability_slots: List[TimeSlot] = Field(..., min_length=1)
    instant_booking: bool = False
    portfolio_images: List[str] = Field(default_factory=list)
    certifications: List[str] = Field(default_factory=list)
    team_size: int = 1
    languages_spoken: List[str] = Field(default_factory=lambda: ["Gujarati", "Hindi"])

    @field_validator("max_charge")
    @classmethod
    def max_gte_min(cls, value, info):
        min_charge = info.data.get("min_charge")
        if value is not None and min_charge is not None and value < min_charge:
            raise ValueError("max_charge must be >= min_charge")
        return value
