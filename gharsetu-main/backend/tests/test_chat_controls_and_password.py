import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8000").rstrip("/")
REQUEST_TIMEOUT_SECONDS = 8


def _register_payload(prefix: str, password: str = "StrongPass1") -> dict:
    unique = f"{prefix}_{uuid.uuid4().hex[:8]}"
    return {
        "name": f"{prefix} {unique}",
        "email": f"{unique}@test.com",
        "phone": f"98{uuid.uuid4().int % 10**8:08d}",
        "password": password,
        "gender": "male",
        "address": "Test Address",
        "city": "Surat",
        "state": "Gujarat",
    }


def _register_user(prefix: str, password: str = "StrongPass1") -> dict:
    payload = _register_payload(prefix, password)
    response = requests.post(
        f"{BASE_URL}/api/auth/register",
        json=payload,
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    assert response.status_code == 200
    body = response.json()
    return {
        "token": body["token"],
        "id": body["user"]["id"],
        "email": payload["email"],
    }


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module", autouse=True)
def require_backend_available() -> None:
    try:
        response = requests.get(f"{BASE_URL}/api/health", timeout=REQUEST_TIMEOUT_SECONDS)
        if response.status_code != 200:
            pytest.skip(f"Backend not ready at {BASE_URL} (health={response.status_code})")
    except requests.RequestException:
        pytest.skip(f"Backend not reachable at {BASE_URL}")


def test_chat_message_blocks_phone_numbers() -> None:
    sender = _register_user("sender")
    receiver = _register_user("receiver")

    response = requests.post(
        f"{BASE_URL}/api/messages",
        json={
            "receiver_id": receiver["id"],
            "content": "Call me on 9876543210",
            "listing_id": "listing-1",
        },
        headers=_headers(sender["token"]),
        timeout=REQUEST_TIMEOUT_SECONDS,
    )

    assert response.status_code == 400
    detail = response.json().get("detail", "").lower()
    assert "phone" in detail or "contact" in detail


def test_chat_message_blocks_email_addresses() -> None:
    sender = _register_user("sender_email")
    receiver = _register_user("receiver_email")

    response = requests.post(
        f"{BASE_URL}/api/messages",
        json={
            "receiver_id": receiver["id"],
            "content": "Mail me at test@example.com",
            "listing_id": "listing-2",
        },
        headers=_headers(sender["token"]),
        timeout=REQUEST_TIMEOUT_SECONDS,
    )

    assert response.status_code == 400
    detail = response.json().get("detail", "").lower()
    assert "email" in detail or "contact" in detail


def test_change_password_requires_current_password_and_allows_login_with_new_password() -> None:
    initial_password = "StrongPass1"
    new_password = "UpdatedPass2"
    payload = _register_payload("password_case", initial_password)

    register_response = requests.post(
        f"{BASE_URL}/api/auth/register",
        json=payload,
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    assert register_response.status_code == 200

    token = register_response.json()["token"]

    bad_change = requests.put(
        f"{BASE_URL}/api/auth/change-password",
        json={"old_password": "WrongPass1", "new_password": new_password},
        headers=_headers(token),
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    assert bad_change.status_code == 400

    good_change = requests.put(
        f"{BASE_URL}/api/auth/change-password",
        json={"old_password": initial_password, "new_password": new_password},
        headers=_headers(token),
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    assert good_change.status_code == 200

    old_login = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": payload["email"], "password": initial_password},
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    assert old_login.status_code == 401

    new_login = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": payload["email"], "password": new_password},
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    assert new_login.status_code == 200
