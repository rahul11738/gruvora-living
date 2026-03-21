"""
Concurrent stress tester for reels interactions.

Usage (PowerShell):
  $env:BASE_URL="http://localhost:8000"
  $env:TOKEN="<bearer_token>"
  $env:REEL_ID="<video_id>"
  python stress_test_reels.py

Optional:
  $env:REQUESTS_PER_ACTION="120"
  $env:WORKERS="25"

This script validates that counters remain bounded under concurrent calls:
- likes delta should remain within [-1, +1] for one-user toggle spam
- shares delta should be 0 or 1 (one user, one share record)
- views delta should be 0 or 1 per 30-minute dedupe window
- followers delta should remain within [-1, +1] for one-user toggle spam
"""

from __future__ import annotations

import concurrent.futures
import os
import time
from dataclasses import dataclass
from typing import Dict, Any, Tuple

import requests


BASE_URL = os.environ.get("BASE_URL", "http://localhost:8000").rstrip("/")
TOKEN = os.environ.get("TOKEN", "")
REEL_ID = os.environ.get("REEL_ID", "")
REQUESTS_PER_ACTION = int(os.environ.get("REQUESTS_PER_ACTION", "120"))
WORKERS = int(os.environ.get("WORKERS", "25"))


@dataclass
class Metrics:
    likes: int
    shares: int
    views: int
    owner_id: str


def auth_headers() -> Dict[str, str]:
    if not TOKEN:
        raise RuntimeError("TOKEN env var is required")
    return {"Authorization": f"Bearer {TOKEN}"}


def fetch_video(video_id: str) -> Dict[str, Any]:
    res = requests.get(f"{BASE_URL}/api/videos/{video_id}", headers=auth_headers(), timeout=20)
    res.raise_for_status()
    return res.json()


def fetch_owner_followers(owner_id: str) -> int:
    res = requests.get(f"{BASE_URL}/api/users/{owner_id}", timeout=20)
    res.raise_for_status()
    payload = res.json()
    return int(payload.get("followers_count", 0))


def call_like(video_id: str) -> int:
    res = requests.post(f"{BASE_URL}/api/videos/{video_id}/like", headers=auth_headers(), timeout=20)
    return res.status_code


def call_share(video_id: str) -> int:
    res = requests.post(f"{BASE_URL}/api/videos/{video_id}/share", headers=auth_headers(), timeout=20)
    return res.status_code


def call_view(video_id: str) -> int:
    res = requests.post(f"{BASE_URL}/api/videos/{video_id}/view", headers=auth_headers(), timeout=20)
    return res.status_code


def call_follow(owner_id: str) -> int:
    res = requests.post(f"{BASE_URL}/api/users/{owner_id}/follow", headers=auth_headers(), timeout=20)
    return res.status_code


def run_concurrent(fn, arg: str, total_calls: int) -> Tuple[int, int]:
    ok = 0
    err = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futures = [ex.submit(fn, arg) for _ in range(total_calls)]
        for f in concurrent.futures.as_completed(futures):
            try:
                code = f.result()
                if 200 <= code < 300:
                    ok += 1
                else:
                    err += 1
            except Exception:
                err += 1
    return ok, err


def capture_metrics(video_id: str) -> Metrics:
    video = fetch_video(video_id)
    return Metrics(
        likes=int(video.get("likes", 0)),
        shares=int(video.get("shares", 0)),
        views=int(video.get("views", 0)),
        owner_id=video.get("owner_id", ""),
    )


def print_result(label: str, before: int, after: int, expectation: str) -> None:
    delta = after - before
    print(f"{label}: before={before}, after={after}, delta={delta}, expected={expectation}")


def main() -> None:
    if not REEL_ID:
        raise RuntimeError("REEL_ID env var is required")

    print("=== Reels Stress Test ===")
    print(f"BASE_URL={BASE_URL}")
    print(f"REEL_ID={REEL_ID}")
    print(f"REQUESTS_PER_ACTION={REQUESTS_PER_ACTION}, WORKERS={WORKERS}")

    before = capture_metrics(REEL_ID)
    if not before.owner_id:
        raise RuntimeError("owner_id missing on reel payload")

    before_followers = fetch_owner_followers(before.owner_id)

    t0 = time.time()
    like_ok, like_err = run_concurrent(call_like, REEL_ID, REQUESTS_PER_ACTION)
    share_ok, share_err = run_concurrent(call_share, REEL_ID, REQUESTS_PER_ACTION)
    view_ok, view_err = run_concurrent(call_view, REEL_ID, REQUESTS_PER_ACTION)
    follow_ok, follow_err = run_concurrent(call_follow, before.owner_id, REQUESTS_PER_ACTION)
    elapsed = time.time() - t0

    after = capture_metrics(REEL_ID)
    after_followers = fetch_owner_followers(after.owner_id)

    print("\n=== Request Outcomes ===")
    print(f"like: ok={like_ok}, err={like_err}")
    print(f"share: ok={share_ok}, err={share_err}")
    print(f"view: ok={view_ok}, err={view_err}")
    print(f"follow(toggle): ok={follow_ok}, err={follow_err}")
    print(f"elapsed={elapsed:.2f}s")

    print("\n=== Counter Checks ===")
    print_result("likes", before.likes, after.likes, "delta should be within [-1, +1]")
    print_result("shares", before.shares, after.shares, "delta should be 0 or 1")
    print_result("views", before.views, after.views, "delta should be 0 or 1 per 30-min window")
    print_result("followers", before_followers, after_followers, "delta should be within [-1, +1]")


if __name__ == "__main__":
    main()
