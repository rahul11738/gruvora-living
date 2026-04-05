from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional


FRESH_LISTING_WINDOW_HOURS = 24
FRESH_LISTING_MAX_SCORE = 6.0
ACTIVE_BOOST_MAX_SCORE = 10.0


def _parse_datetime(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def _normalize_status(value: Any) -> str:
    if value is None:
        return ""
    raw = getattr(value, "value", value)
    return str(raw).strip().lower()


def build_fresh_priority_until(now: Optional[datetime] = None) -> str:
    base = now or datetime.now(timezone.utc)
    if base.tzinfo is None:
        base = base.replace(tzinfo=timezone.utc)
    return (base + timedelta(hours=FRESH_LISTING_WINDOW_HOURS)).isoformat()


def get_fresh_priority_until(listing: Dict[str, Any]) -> Optional[datetime]:
    explicit_until = _parse_datetime(listing.get("fresh_priority_until"))
    if explicit_until:
        return explicit_until

    created_at = _parse_datetime(listing.get("created_at"))
    if created_at:
        return created_at + timedelta(hours=FRESH_LISTING_WINDOW_HOURS)
    return None


def get_active_boost_expires_at(listing: Dict[str, Any]) -> Optional[datetime]:
    for key in ("boost_expires_at", "boost_expires"):
        parsed = _parse_datetime(listing.get(key))
        if parsed:
            return parsed
    return None


def listing_freshness_score(listing: Dict[str, Any], now: Optional[datetime] = None) -> float:
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)

    expires_at = get_fresh_priority_until(listing)
    if not expires_at:
        return 0.0

    remaining_seconds = (expires_at - current).total_seconds()
    if remaining_seconds <= 0:
        return 0.0

    window_seconds = FRESH_LISTING_WINDOW_HOURS * 3600.0
    ratio = min(1.0, remaining_seconds / window_seconds)
    return round(FRESH_LISTING_MAX_SCORE * ratio, 3)


def listing_boost_score(listing: Dict[str, Any], now: Optional[datetime] = None) -> float:
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)

    expires_at = get_active_boost_expires_at(listing)
    status = _normalize_status(listing.get("status"))
    if not expires_at or expires_at <= current:
        return 0.0
    if status and status != "boosted" and not listing.get("is_boosted"):
        return 0.0

    return ACTIVE_BOOST_MAX_SCORE
