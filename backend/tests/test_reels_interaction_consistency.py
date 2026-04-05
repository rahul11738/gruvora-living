"""
Reels interaction consistency tests.
Covers concurrent toggle behavior for follow/like and one-time view counting.
"""

import os
import time
import uuid
from concurrent.futures import ThreadPoolExecutor

import pytest
import requests

BASE_URL = (os.environ.get("BASE_URL") or os.environ.get("REACT_APP_BACKEND_URL") or "http://127.0.0.1:8001").rstrip("/")
REQUEST_TIMEOUT_SECONDS = 10
ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "admin@gharsetu.com")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "Admin@123")


def _register_user() -> dict:
    suffix = str(uuid.uuid4())[:8]
    payload = {
        "name": f"Reels Test {suffix}",
        "email": f"reels_{suffix}@test.com",
        "phone": f"9{uuid.uuid4().int % 1000000000:09d}",
        "password": "StrongPass1",
        "gender": "male",
        "address": "Test Address",
        "city": "Surat",
        "state": "Gujarat",
    }

    for attempt in range(4):
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json=payload,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        if response.status_code == 200:
            data = response.json()
            return {
                "token": data.get("token"),
                "user": data.get("user", {}),
            }
        if response.status_code == 429 and attempt < 3:
            time.sleep(2 + attempt * 2)
            continue
        if response.status_code == 429:
            pytest.skip("Registration rate-limited in this environment")
        pytest.skip(f"Register unavailable: {response.status_code} {response.text}")

    pytest.skip("Registration unavailable after retries")


def _get_videos(limit: int = 10) -> list:
    response = requests.get(
        f"{BASE_URL}/api/videos",
        params={"limit": limit},
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    assert response.status_code == 200, f"Videos fetch failed: {response.status_code}"
    return response.json().get("videos", [])


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _get_admin_token() -> str:
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    if response.status_code != 200:
        pytest.skip("Admin credentials unavailable for admin debug session tests")
    return response.json().get("token")


@pytest.fixture(scope="module", autouse=True)
def require_backend_available() -> None:
    try:
        health = requests.get(f"{BASE_URL}/api/health", timeout=REQUEST_TIMEOUT_SECONDS)
        if health.status_code != 200:
            pytest.skip(f"Backend not healthy at {BASE_URL}: {health.status_code}")
    except requests.RequestException:
        pytest.skip(f"Backend not reachable at {BASE_URL}")


class TestReelsInteractionConsistency:
    def test_admin_debug_session_query_forbidden_for_non_admin(self):
        auth = _register_user()
        token = auth["token"]
        assert token

        response = requests.get(
            f"{BASE_URL}/api/admin/debug/reels-sessions",
            headers=_auth_headers(token),
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        assert response.status_code == 403

    def test_admin_can_query_debug_session_reports(self):
        # Create a report as normal user.
        auth = _register_user()
        user_token = auth["token"]
        session_id = f"session-{uuid.uuid4().hex[:8]}"
        create_response = requests.post(
            f"{BASE_URL}/api/debug/reels-session",
            headers=_auth_headers(user_token),
            json={
                "stress_session_id": session_id,
                "stats": {"snapshotCalls": 2, "snapshotCacheHits": 1, "snapshotCacheMisses": 1},
                "hit_rate_history": [50],
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        assert create_response.status_code == 200

        admin_token = _get_admin_token()
        query_response = requests.get(
            f"{BASE_URL}/api/admin/debug/reels-sessions",
            headers=_auth_headers(admin_token),
            params={"stress_session_id": session_id, "limit": 10},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        assert query_response.status_code == 200
        data = query_response.json()
        assert "reports" in data
        assert data.get("total", 0) >= 1
        assert any(r.get("stress_session_id") == session_id for r in data.get("reports", []))

    def test_admin_debug_session_query_supports_date_range_filters(self):
        auth = _register_user()
        user_token = auth["token"]
        session_id = f"session-{uuid.uuid4().hex[:8]}"
        create_response = requests.post(
            f"{BASE_URL}/api/debug/reels-session",
            headers=_auth_headers(user_token),
            json={
                "stress_session_id": session_id,
                "stats": {"snapshotCalls": 1},
                "hit_rate_history": [100],
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        assert create_response.status_code == 200

        admin_token = _get_admin_token()

        # Future-only window should exclude just-created reports.
        future_response = requests.get(
            f"{BASE_URL}/api/admin/debug/reels-sessions",
            headers=_auth_headers(admin_token),
            params={
                "stress_session_id": session_id,
                "from_date": "2999-01-01T00:00:00",
                "to_date": "2999-01-02T00:00:00",
                "limit": 10,
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        assert future_response.status_code == 200
        future_data = future_response.json()
        assert future_data.get("total", 0) == 0

        # Past-to-near-future window should include the created report.
        include_response = requests.get(
            f"{BASE_URL}/api/admin/debug/reels-sessions",
            headers=_auth_headers(admin_token),
            params={
                "stress_session_id": session_id,
                "from_date": "2000-01-01T00:00:00",
                "to_date": "2999-01-01T00:00:00",
                "limit": 10,
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        assert include_response.status_code == 200
        include_data = include_response.json()
        assert include_data.get("total", 0) >= 1
        assert any(r.get("stress_session_id") == session_id for r in include_data.get("reports", []))

    def test_debug_session_report_persistence_endpoint(self):
        auth = _register_user()
        token = auth["token"]
        assert token

        response = requests.post(
            f"{BASE_URL}/api/debug/reels-session",
            headers=_auth_headers(token),
            json={
                "stress_session_id": f"session-{uuid.uuid4().hex[:8]}",
                "stats": {
                    "snapshotCalls": 12,
                    "snapshotCacheHits": 9,
                    "snapshotCacheMisses": 3,
                },
                "hit_rate_history": [75, 80, 82],
                "total_captures": 2,
                "captures": [{"stats": {"snapshotCalls": 5}}, {"stats": {"snapshotCalls": 7}}],
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data.get("report_id")

    def test_interaction_snapshot_returns_compact_state(self):
        auth = _register_user()
        token = auth["token"]
        user_id = auth["user"].get("id")
        assert token and user_id
        headers = _auth_headers(token)

        videos = _get_videos(limit=5)
        if not videos:
            pytest.skip("No videos available for snapshot test")

        video = None
        for item in videos:
            if item.get("id") and item.get("owner_id") and item.get("owner_id") != user_id:
                video = item
                break

        if not video:
            pytest.skip("No followable owner/video pair found for snapshot test")

        video_id = video["id"]
        owner_id = video["owner_id"]

        requests.post(
            f"{BASE_URL}/api/videos/{video_id}/like",
            headers=headers,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        requests.post(
            f"{BASE_URL}/api/users/{owner_id}/follow/toggle",
            headers=headers,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )

        snapshot_response = requests.get(
            f"{BASE_URL}/api/interactions/snapshot",
            headers=headers,
            params={"reel_ids": video_id, "owner_ids": owner_id},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        assert snapshot_response.status_code == 200
        snapshot = snapshot_response.json()

        assert "liked_reel_ids" in snapshot
        assert "following_owner_ids" in snapshot
        assert "saved_reel_ids" in snapshot
        assert video_id in snapshot.get("liked_reel_ids", [])
        assert owner_id in snapshot.get("following_owner_ids", [])

    def test_concurrent_follow_toggle_keeps_global_state_consistent(self):
        auth = _register_user()
        token = auth["token"]
        user_id = auth["user"].get("id")
        assert token and user_id

        videos = _get_videos(limit=20)
        if not videos:
            pytest.skip("No videos available for follow toggle test")

        owner_id = None
        for video in videos:
            if video.get("owner_id") and video.get("owner_id") != user_id:
                owner_id = video.get("owner_id")
                break

        if not owner_id:
            pytest.skip("No followable owner found in videos")

        headers = _auth_headers(token)

        def toggle_follow() -> int:
            response = requests.post(
                f"{BASE_URL}/api/users/{owner_id}/follow/toggle",
                headers=headers,
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
            return response.status_code

        # Odd number of toggles from a fresh account should end in following=True.
        with ThreadPoolExecutor(max_workers=9) as pool:
            statuses = list(pool.map(lambda _: toggle_follow(), range(9)))

        assert all(code == 200 for code in statuses), f"Unexpected statuses: {statuses}"

        profile_response = requests.get(
            f"{BASE_URL}/api/users/{owner_id}",
            headers=headers,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        assert profile_response.status_code == 200
        profile = profile_response.json()
        assert profile.get("is_following") is True

        following_response = requests.get(
            f"{BASE_URL}/api/users/{user_id}/following",
            headers=headers,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        assert following_response.status_code == 200
        following = following_response.json().get("following", [])
        following_ids = [u.get("id") for u in following]
        assert following_ids.count(owner_id) <= 1

    def test_concurrent_like_toggle_keeps_single_user_like_consistent(self):
        auth = _register_user()
        token = auth["token"]
        headers = _auth_headers(token)

        videos = _get_videos(limit=5)
        if not videos:
            pytest.skip("No videos available for like toggle test")

        video_id = videos[0].get("id")
        assert video_id

        def toggle_like() -> int:
            response = requests.post(
                f"{BASE_URL}/api/videos/{video_id}/like",
                headers=headers,
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
            return response.status_code

        with ThreadPoolExecutor(max_workers=9) as pool:
            statuses = list(pool.map(lambda _: toggle_like(), range(9)))

        assert all(code == 200 for code in statuses), f"Unexpected statuses: {statuses}"

        video_response = requests.get(
            f"{BASE_URL}/api/videos/{video_id}",
            headers=headers,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        assert video_response.status_code == 200
        video = video_response.json()
        assert video.get("user_liked") is True
        assert isinstance(video.get("likes"), int)
        assert video.get("likes") >= 0

    def test_view_is_counted_once_per_user_even_under_concurrency(self):
        auth = _register_user()
        token = auth["token"]
        headers = _auth_headers(token)

        videos = _get_videos(limit=5)
        if not videos:
            pytest.skip("No videos available for view dedupe test")

        video_id = videos[0].get("id")
        assert video_id

        def record_view() -> bool:
            response = requests.post(
                f"{BASE_URL}/api/videos/{video_id}/view",
                headers=headers,
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
            assert response.status_code == 200
            return bool(response.json().get("counted"))

        with ThreadPoolExecutor(max_workers=8) as pool:
            counted_results = list(pool.map(lambda _: record_view(), range(8)))

        assert sum(1 for counted in counted_results if counted) == 1

        # Sequential view should continue to dedupe for same user.
        repeat = requests.post(
            f"{BASE_URL}/api/videos/{video_id}/view",
            headers=headers,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        assert repeat.status_code == 200
        assert repeat.json().get("counted") is False
