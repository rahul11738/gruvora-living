"""
Role/category and ownership security regression tests.
Covers listing creation, reel upload validation, and owner listings isolation.
"""

import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8000").rstrip("/")
REQUEST_TIMEOUT_SECONDS = 12

ALLOWED_CATEGORIES_BY_ROLE = {
    "property_owner": {"home", "business"},
    "stay_owner": {"stay"},
    "hotel_owner": {"stay"},
    "service_provider": {"services"},
    "event_owner": {"event"},
    "admin": {"home", "business", "stay", "event", "services"},
}


def _owner_register_payload(role: str, coupon: str | None = None) -> dict:
    suffix = str(uuid.uuid4())[:8]
    payload = {
        "name": f"Owner {role} {suffix}",
        "email": f"owner_{role}_{suffix}@test.com",
        "phone": "9876543210",
        "password": "StrongPass1",
        "gender": "male",
        "address": "Test Address",
        "city": "Surat",
        "state": "Gujarat",
        "role": role,
        "aadhar_number": f"99998888{suffix[:4]}",
        "aadhar_name": f"Owner {suffix}",
        "business_name": f"Biz {suffix}",
    }
    if coupon:
        payload["coupon"] = coupon
    return payload


def _listing_payload(category: str) -> dict:
    suffix = str(uuid.uuid4())[:6]
    return {
        "title": f"Listing {category} {suffix}",
        "description": "Role/category test listing",
        "category": category,
        "listing_type": "rent",
        "sub_category": "test",
        "price": 15000,
        "location": "Vesu",
        "city": "Surat",
        "state": "Gujarat",
        "amenities": ["Parking"],
        "images": [],
        "videos": [],
        "contact_phone": "9876543210",
        "contact_email": f"listing_{suffix}@test.com",
        "specifications": {},
        "nearby_facilities": {},
    }


def _register_owner_and_get_auth(role: str, coupon: str | None = None) -> tuple[str, dict]:
    response = requests.post(
        f"{BASE_URL}/api/auth/register/owner",
        json=_owner_register_payload(role, coupon=coupon),
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    assert response.status_code == 200, response.text
    data = response.json()
    token = data["token"]
    owner_id = data["user"]["id"]
    return owner_id, {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module", autouse=True)
def require_backend_available() -> None:
    try:
        response = requests.get(f"{BASE_URL}/api/health", timeout=REQUEST_TIMEOUT_SECONDS)
        if response.status_code != 200:
            pytest.skip(f"Backend not ready at {BASE_URL} (health={response.status_code})")
    except requests.RequestException:
        pytest.skip(f"Backend not reachable at {BASE_URL}")


class TestRoleCategoryAndOwnershipEnforcement:
    def test_property_owner_rejects_stay_listing(self) -> None:
        _, headers = _register_owner_and_get_auth("property_owner")

        response = requests.post(
            f"{BASE_URL}/api/listings",
            headers=headers,
            json=_listing_payload("stay"),
            timeout=REQUEST_TIMEOUT_SECONDS,
        )

        assert response.status_code == 403, response.text
        assert "not allowed" in response.json().get("detail", "").lower()

    def test_stay_owner_rejects_home_listing(self) -> None:
        _, headers = _register_owner_and_get_auth("stay_owner")

        response = requests.post(
            f"{BASE_URL}/api/listings",
            headers=headers,
            json=_listing_payload("home"),
            timeout=REQUEST_TIMEOUT_SECONDS,
        )

        assert response.status_code == 403, response.text
        assert "not allowed" in response.json().get("detail", "").lower()

    def test_property_owner_accepts_allowed_listing_category(self) -> None:
        _, headers = _register_owner_and_get_auth("property_owner")

        response = requests.post(
            f"{BASE_URL}/api/listings",
            headers=headers,
            json=_listing_payload("home"),
            timeout=REQUEST_TIMEOUT_SECONDS,
        )

        assert response.status_code == 200, response.text
        data = response.json()
        assert data.get("listing_id")

    def test_hotel_owner_accepts_stay_listing(self) -> None:
        _, headers = _register_owner_and_get_auth("hotel_owner")

        response = requests.post(
            f"{BASE_URL}/api/listings",
            headers=headers,
            json=_listing_payload("stay"),
            timeout=REQUEST_TIMEOUT_SECONDS,
        )

        assert response.status_code == 200, response.text
        assert response.json().get("listing_id")

    def test_hotel_owner_rejects_event_listing(self) -> None:
        _, headers = _register_owner_and_get_auth("hotel_owner")

        response = requests.post(
            f"{BASE_URL}/api/listings",
            headers=headers,
            json=_listing_payload("event"),
            timeout=REQUEST_TIMEOUT_SECONDS,
        )

        assert response.status_code == 403, response.text
        assert "not allowed" in response.json().get("detail", "").lower()

    def test_event_owner_accepts_event_listing(self) -> None:
        _, headers = _register_owner_and_get_auth("event_owner")

        response = requests.post(
            f"{BASE_URL}/api/listings",
            headers=headers,
            json=_listing_payload("event"),
            timeout=REQUEST_TIMEOUT_SECONDS,
        )

        assert response.status_code == 200, response.text
        assert response.json().get("listing_id")

    def test_event_owner_rejects_home_listing(self) -> None:
        _, headers = _register_owner_and_get_auth("event_owner", coupon="GRUVORA5M")

        response = requests.post(
            f"{BASE_URL}/api/listings",
            headers=headers,
            json=_listing_payload("home"),
            timeout=REQUEST_TIMEOUT_SECONDS,
        )

        assert response.status_code == 403, response.text
        assert "not allowed" in response.json().get("detail", "").lower()

    def test_reel_upload_rejects_disallowed_category_for_role(self) -> None:
        _, headers = _register_owner_and_get_auth("property_owner")

        response = requests.post(
            f"{BASE_URL}/api/videos/upload",
            headers=headers,
            data={
                "title": "Role restricted reel",
                "description": "Should be blocked before upload",
                "category": "stay",
            },
            files={"video": ("tiny.mp4", b"\x00\x00\x00\x18ftypmp42", "video/mp4")},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )

        assert response.status_code == 403, response.text
        assert "not allowed" in response.json().get("detail", "").lower()

    def test_owner_listings_are_owner_scoped_and_role_filtered(self) -> None:
        owner_a_id, owner_a_headers = _register_owner_and_get_auth("property_owner")
        owner_b_id, _owner_b_headers = _register_owner_and_get_auth("stay_owner")

        # Create one valid listing for owner A.
        create_response = requests.post(
            f"{BASE_URL}/api/listings",
            headers=owner_a_headers,
            json=_listing_payload("home"),
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        assert create_response.status_code == 200, create_response.text

        # Attempt to fetch owner B listings with owner A token must be forbidden.
        forbidden = requests.get(
            f"{BASE_URL}/api/owner/listings",
            headers=owner_a_headers,
            params={"user_id": owner_b_id},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        assert forbidden.status_code == 403, forbidden.text

        # Owner A listings should contain only owner A records with allowed categories.
        own = requests.get(
            f"{BASE_URL}/api/owner/listings",
            headers=owner_a_headers,
            params={"user_id": owner_a_id},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        assert own.status_code == 200, own.text

        listings = own.json().get("listings", [])
        allowed_categories = ALLOWED_CATEGORIES_BY_ROLE["property_owner"]
        for listing in listings:
            assert listing.get("owner_id") == owner_a_id
            assert listing.get("category") in allowed_categories

    def test_reel_upload_rejects_linking_other_owner_listing(self) -> None:
        owner_a_id, owner_a_headers = _register_owner_and_get_auth("property_owner")
        _owner_b_id, owner_b_headers = _register_owner_and_get_auth("property_owner")

        # Owner A creates a listing in an allowed category.
        create_response = requests.post(
            f"{BASE_URL}/api/listings",
            headers=owner_a_headers,
            json=_listing_payload("home"),
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        assert create_response.status_code == 200, create_response.text
        listing_id = create_response.json().get("listing_id")
        assert listing_id

        # Owner B attempts to attach a reel to owner A's listing.
        upload_response = requests.post(
            f"{BASE_URL}/api/videos/upload",
            headers=owner_b_headers,
            data={
                "title": "Cross-owner listing reel",
                "description": "Should be forbidden",
                "category": "home",
                "listing_id": listing_id,
            },
            files={"video": ("tiny.mp4", b"\x00\x00\x00\x18ftypmp42", "video/mp4")},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )

        assert upload_response.status_code == 403, upload_response.text
        assert "another owner's listing" in upload_response.json().get("detail", "").lower()
