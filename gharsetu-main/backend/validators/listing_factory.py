from enum import Enum
from typing import Any, Dict, Tuple, Type

from fastapi import HTTPException
from pydantic import BaseModel, ValidationError

from models.event_listing import EventSpecificFields
from models.property_listing import PropertySpecificFields
from models.service_listing import ServiceSpecificFields
from models.stay_listing import StaySpecificFields


class UserRole(str, Enum):
    PROPERTY_OWNER = "property_owner"
    STAY_OWNER = "stay_owner"
    HOTEL_OWNER = "hotel_owner"
    SERVICE_PROVIDER = "service_provider"
    EVENT_OWNER = "event_owner"
    ADMIN = "admin"


ROLE_SCHEMA_MAP: Dict[str, Tuple[str, Type[BaseModel]]] = {
    UserRole.PROPERTY_OWNER.value: ("home", PropertySpecificFields),
    UserRole.STAY_OWNER.value: ("stay", StaySpecificFields),
    UserRole.HOTEL_OWNER.value: ("stay", StaySpecificFields),
    UserRole.SERVICE_PROVIDER.value: ("services", ServiceSpecificFields),
    UserRole.EVENT_OWNER.value: ("event", EventSpecificFields),
}


ADMIN_CATEGORY_MAP: Dict[str, Type[BaseModel]] = {
    "home": PropertySpecificFields,
    "stay": StaySpecificFields,
    "services": ServiceSpecificFields,
    "event": EventSpecificFields,
}


def resolve_specific_schema(role: str, category: str) -> Type[BaseModel]:
    role_value = str(role or "").strip()
    category_value = str(category or "").strip()

    if role_value == UserRole.ADMIN.value:
        schema = ADMIN_CATEGORY_MAP.get(category_value)
        if not schema:
            raise HTTPException(status_code=400, detail=f"Unknown category '{category_value}'")
        return schema

    mapping = ROLE_SCHEMA_MAP.get(role_value)
    if not mapping:
        raise HTTPException(status_code=403, detail=f"Role '{role_value}' cannot create listings")

    allowed_category, schema = mapping
    if category_value != allowed_category:
        raise HTTPException(
            status_code=403,
            detail=(
                f"Role '{role_value}' can only create '{allowed_category}' listings, "
                f"got '{category_value}'"
            ),
        )
    return schema


def validate_specific_fields(role: str, category: str, raw: Dict[str, Any]) -> BaseModel:
    schema_cls = resolve_specific_schema(role, category)
    try:
        return schema_cls(**raw)
    except ValidationError as exc:
        errors = [
            {"field": ".".join(str(part) for part in error["loc"]), "msg": error["msg"]}
            for error in exc.errors()
        ]
        raise HTTPException(status_code=422, detail={"category_specific_errors": errors})
