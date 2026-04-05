"""
Auth and security regression tests.
Covers password policy, JWT refresh endpoint, and security headers.
"""

import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8000").rstrip("/")
REQUEST_TIMEOUT_SECONDS = 8
JWT_ALGORITHM = "HS256"


def _resolve_jwt_secret() -> str:
    secret = os.environ.get("JWT_SECRET", "")
    if secret:
        return secret

    # For local runs, try backend/.env so deterministic JWT tests can execute.
    if BASE_URL.startswith("http://localhost") or BASE_URL.startswith("http://127.0.0.1"):
        env_path = Path(__file__).resolve().parents[1] / ".env"
        if env_path.exists():
            for line in env_path.read_text(encoding="utf-8").splitlines():
                stripped = line.strip()
                if not stripped or stripped.startswith("#") or "=" not in stripped:
                    continue
                key, value = stripped.split("=", 1)
                if key.strip() == "JWT_SECRET":
                    value = value.strip().strip('"').strip("'")
                    if value:
                        return value

    return ""


@pytest.fixture(scope="module", autouse=True)
def require_backend_available() -> None:
    try:
        response = requests.get(f"{BASE_URL}/api/health", timeout=REQUEST_TIMEOUT_SECONDS)
        if response.status_code != 200:
            pytest.skip(f"Backend not ready at {BASE_URL} (health={response.status_code})")
    except requests.RequestException:
        pytest.skip(f"Backend not reachable at {BASE_URL}")


def _register_payload(password: str) -> dict:
    unique = str(uuid.uuid4())[:8]
    return {
        "name": f"Security Test {unique}",
        "email": f"security_{unique}@test.com",
        "phone": "9876543210",
        "password": password,
        "gender": "male",
        "address": "Test Address",
        "city": "Surat",
        "state": "Gujarat",
    }


def test_register_rejects_short_password() -> None:
    response = requests.post(
        f"{BASE_URL}/api/auth/register",
        json=_register_payload("Abc12"),
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    assert response.status_code == 400
    assert "at least 8 characters" in response.json().get("detail", "")


def test_register_rejects_password_without_uppercase() -> None:
    response = requests.post(
        f"{BASE_URL}/api/auth/register",
        json=_register_payload("lowercase123"),
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    assert response.status_code == 400
    assert "uppercase letter" in response.json().get("detail", "")


def test_register_rejects_password_without_number() -> None:
    response = requests.post(
        f"{BASE_URL}/api/auth/register",
        json=_register_payload("PasswordOnly"),
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    assert response.status_code == 400
    assert "one number" in response.json().get("detail", "")


def test_refresh_rejects_invalid_token() -> None:
    response = requests.post(
        f"{BASE_URL}/api/auth/refresh",
        json={"token": "not-a-jwt"},
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    assert response.status_code == 401


def test_refresh_rejects_token_too_old() -> None:
    secret = _resolve_jwt_secret()
    if not secret:
        pytest.skip("JWT_SECRET not available for signing deterministic test token")

    old_exp = datetime.now(timezone.utc) - timedelta(days=8)
    token = jwt.encode(
        {"user_id": "test-user", "role": "user", "exp": old_exp},
        secret,
        algorithm=JWT_ALGORITHM,
    )

    response = requests.post(
        f"{BASE_URL}/api/auth/refresh",
        json={"token": token},
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    assert response.status_code == 401
    assert "too old" in response.json().get("detail", "").lower()


def test_refresh_issues_new_token_for_valid_token() -> None:
    register_response = requests.post(
        f"{BASE_URL}/api/auth/register",
        json=_register_payload("StrongPass1"),
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    assert register_response.status_code == 200

    token = register_response.json().get("token")
    assert token

    refresh_response = requests.post(
        f"{BASE_URL}/api/auth/refresh",
        json={"token": token},
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    assert refresh_response.status_code == 200

    new_token = refresh_response.json().get("token")
    assert new_token
    assert new_token != token


def test_refresh_uses_database_role_not_payload_role() -> None:
    secret = _resolve_jwt_secret()
    if not secret:
        pytest.skip("JWT_SECRET not available for role-claim integrity test")

    register_response = requests.post(
        f"{BASE_URL}/api/auth/register",
        json=_register_payload("StrongPass1"),
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    assert register_response.status_code == 200

    user = register_response.json().get("user", {})
    user_id = user.get("id")
    assert user_id

    forged_token = jwt.encode(
        {
            "user_id": user_id,
            "role": "admin",  # forged claim
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        },
        secret,
        algorithm=JWT_ALGORITHM,
    )

    refresh_response = requests.post(
        f"{BASE_URL}/api/auth/refresh",
        json={"token": forged_token},
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    assert refresh_response.status_code == 200

    refreshed = refresh_response.json().get("token")
    assert refreshed
    decoded = jwt.decode(refreshed, secret, algorithms=[JWT_ALGORITHM])
    assert decoded.get("role") == "user"


def test_security_headers_present_on_health() -> None:
    response = requests.get(f"{BASE_URL}/api/health", timeout=REQUEST_TIMEOUT_SECONDS)
    assert response.status_code == 200
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert response.headers.get("X-XSS-Protection") == "1; mode=block"
    assert response.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
    assert response.headers.get("Permissions-Policy") == "geolocation=(), microphone=()"
