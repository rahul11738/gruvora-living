from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class PropertyType(str, Enum):
    FLAT = "flat"
    VILLA = "villa"
    ROWHOUSE = "rowhouse"
    BUNGALOW = "bungalow"
    SHOP = "shop"
    OFFICE = "office"
    WAREHOUSE = "warehouse"
    PLOT = "plot"
    PG = "pg"


class FurnishingStatus(str, Enum):
    FURNISHED = "furnished"
    SEMI_FURNISHED = "semi_furnished"
    UNFURNISHED = "unfurnished"


class ListingTypeEnum(str, Enum):
    RENT = "rent"
    SELL = "sell"
    BOTH = "both"


class NearbyFacilities(BaseModel):
    schools: List[str] = Field(default_factory=list)
    hospitals: List[str] = Field(default_factory=list)
    transport: List[str] = Field(default_factory=list)
    markets: List[str] = Field(default_factory=list)


class PropertySpecificFields(BaseModel):
    property_type: PropertyType
    listing_type: ListingTypeEnum
    bhk: Optional[int] = Field(None, ge=1, le=10)
    area_sqft: float = Field(..., gt=0)
    furnishing: FurnishingStatus
    floor: Optional[int] = None
    total_floors: Optional[int] = None
    parking: bool = False
    parking_type: Optional[str] = None
    amenities: List[str] = Field(default_factory=list)
    nearby_facilities: NearbyFacilities = Field(default_factory=NearbyFacilities)
    age_of_property_years: Optional[int] = None
    legal_status: Optional[str] = None
    possession_date: Optional[str] = None
    facing: Optional[str] = None

    @field_validator("bhk")
    @classmethod
    def bhk_required_for_residential(cls, value, info):
        property_type = info.data.get("property_type")
        residential = {
            PropertyType.FLAT,
            PropertyType.VILLA,
            PropertyType.ROWHOUSE,
            PropertyType.BUNGALOW,
            PropertyType.PG,
        }
        if property_type in residential and value is None:
            raise ValueError("BHK is required for residential properties")
        return value
