from typing import Any, Dict

from pydantic import BaseModel

from models.event_listing import EventSpecificFields
from models.property_listing import PropertySpecificFields
from models.service_listing import ServiceSpecificFields
from models.stay_listing import StaySpecificFields


def validate_property_fields(raw: Dict[str, Any]) -> BaseModel:
    return PropertySpecificFields(**raw)


def validate_stay_fields(raw: Dict[str, Any]) -> BaseModel:
    return StaySpecificFields(**raw)


def validate_service_fields(raw: Dict[str, Any]) -> BaseModel:
    return ServiceSpecificFields(**raw)


def validate_event_fields(raw: Dict[str, Any]) -> BaseModel:
    return EventSpecificFields(**raw)
