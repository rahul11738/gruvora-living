"""
Multi-user concurrent stress tester for reels interactions.

PowerShell usage:
  cd backend
  $env:BASE_URL="http://localhost:8000"
  $env:REEL_ID="<video_id>"
  $env:TOKENS_FILE="tokens.txt"   # one JWT per line
  $env:ROUNDS="1"                  # toggle rounds per user
  $env:WORKERS="40"
  python stress_test_reels_multiuser.py

Alternative token source:
  $env:TOKENS="jwt1,jwt2,jwt3"

Checks performed:
- likes: exact expected delta from toggle parity and initial per-user liked state
- followers: exact expected delta from toggle parity and initial follow state
- shares: delta equals number of counted=true responses
- views: delta equals number of counted=true responses
"""

from __future__ import annotations

import concurrent.futures
import os
import threading
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Tuple

import requests


BASE_URL = os.environ.get("BASE_URL", "http://localhost:8000").rstrip("/")
REEL_ID = os.environ.get("REEL_ID", "").strip()
TOKENS_FILE = os.environ.get("TOKENS_FILE", "").strip()
TOKENS_CSV = os.environ.get("TOKENS", "").strip()
ROUNDS = int(os.environ.get("ROUNDS", "1"))
WORKERS = int(os.environ.get("WORKERS", "40"))
TIMEOUT = int(os.environ.get("TIMEOUT", "25"))


@dataclass
class ReelMetrics:
    likes: int
    shares: int
    views: int
    owner_id: str


@dataclass
class UserState:
    token: str
    user_id: str
    initially_liked: bool
    initially_following_owner: bool


_thread_local = threading.local()


def get_session() -> requests.Session:
    session = getattr(_thread_local, "session", None)
    if session is None:
        session = requests.Session()
        _thread_local.session = session
    return session


def token_headers(token: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def load_tokens() -> List[str]:
    tokens: List[str] = []

    if TOKENS_FILE:
        with open(TOKENS_FILE, "r", encoding="utf-8") as f:
            tokens.extend([line.strip() for line in f if line.strip()])

    if TOKENS_CSV:
        tokens.extend([part.strip() for part in TOKENS_CSV.split(",") if part.strip()])

    # Preserve order while removing duplicates.
    deduped: List[str] = []
    seen = set()
    for tok in tokens:
        if tok not in seen:
            deduped.append(tok)
            seen.add(tok)
    return deduped


def get_me(token: str) -> Dict[str, Any]:
    s = get_session()
    resp = s.get(f"{BASE_URL}/api/auth/me", headers=token_headers(token), timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def get_video(token: str, video_id: str) -> Dict[str, Any]:
    s = get_session()
    resp = s.get(f"{BASE_URL}/api/videos/{video_id}", headers=token_headers(token), timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def get_user_profile(user_id: str) -> Dict[str, Any]:
    s = get_session()
    resp = s.get(f"{BASE_URL}/api/users/{user_id}", timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def post_like(token: str) -> Tuple[int, bool]:
    s = get_session()
    resp = s.post(f"{BASE_URL}/api/videos/{REEL_ID}/like", headers=token_headers(token), timeout=TIMEOUT)
    return resp.status_code, False


def post_share(token: str) -> Tuple[int, bool]:
    s = get_session()
    resp = s.post(f"{BASE_URL}/api/videos/{REEL_ID}/share", headers=token_headers(token), timeout=TIMEOUT)
    counted = False
    if resp.headers.get("content-type", "").startswith("application/json"):
        try:
            counted = bool(resp.json().get("counted", False))
        except Exception:
            counted = False
    return resp.status_code, counted


def post_view(token: str) -> Tuple[int, bool]:
    s = get_session()
    resp = s.post(f"{BASE_URL}/api/videos/{REEL_ID}/view", headers=token_headers(token), timeout=TIMEOUT)
    counted = False
    if resp.headers.get("content-type", "").startswith("application/json"):
        try:
            counted = bool(resp.json().get("counted", False))
        except Exception:
            counted = False
    return resp.status_code, counted


def post_follow(token: str, owner_id: str) -> Tuple[int, bool]:
    s = get_session()
    resp = s.post(f"{BASE_URL}/api/users/{owner_id}/follow", headers=token_headers(token), timeout=TIMEOUT)
    return resp.status_code, False


def run_parallel_calls(fn, call_inputs: List[Any]) -> Dict[str, Any]:
    success = 0
    errors = 0
    counted_true = 0
    status_hist: Dict[int, int] = {}

    with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futures = [ex.submit(fn, call_input) for call_input in call_inputs]
        for future in concurrent.futures.as_completed(futures):
            try:
                code, counted = future.result()
                status_hist[code] = status_hist.get(code, 0) + 1
                if 200 <= code < 300:
                    success += 1
                    if counted:
                        counted_true += 1
                else:
                    errors += 1
            except Exception:
                errors += 1

    return {
        "success": success,
        "errors": errors,
        "counted_true": counted_true,
        "status_hist": status_hist,
        "total": len(call_inputs),
    }


def fetch_global_metrics(observer_token: str) -> ReelMetrics:
    v = get_video(observer_token, REEL_ID)
    return ReelMetrics(
        likes=int(v.get("likes", 0)),
        shares=int(v.get("shares", 0)),
        views=int(v.get("views", 0)),
        owner_id=str(v.get("owner_id", "")),
    )


def resolve_initial_states(tokens: List[str]) -> List[UserState]:
    states: List[UserState] = []

    # Use first token for owner lookup.
    initial = fetch_global_metrics(tokens[0])
    if not initial.owner_id:
        raise RuntimeError("Reel owner_id missing in /api/videos/{id} response")

    for tok in tokens:
        me = get_me(tok)
        uid = str(me.get("id", ""))
        if not uid:
            raise RuntimeError("/api/auth/me did not include user id")

        v = get_video(tok, REEL_ID)
        states.append(
            UserState(
                token=tok,
                user_id=uid,
                initially_liked=bool(v.get("user_liked", False)),
                initially_following_owner=bool(v.get("user_following", False)),
            )
        )

    return states


def expected_toggle_delta(initially_enabled: bool, rounds: int) -> int:
    if rounds % 2 == 0:
        return 0
    return -1 if initially_enabled else 1


def print_check(label: str, before: int, after: int, expected: int) -> bool:
    actual = after - before
    ok = actual == expected
    verdict = "PASS" if ok else "FAIL"
    print(f"{label}: before={before}, after={after}, actual_delta={actual}, expected_delta={expected} => {verdict}")
    return ok


def main() -> None:
    if not REEL_ID:
        raise RuntimeError("REEL_ID env var is required")
    if ROUNDS <= 0:
        raise RuntimeError("ROUNDS must be >= 1")

    tokens = load_tokens()
    if not tokens:
        raise RuntimeError("Provide TOKENS_FILE or TOKENS with at least one token")

    print("=== Multi-User Reels Stress Test ===")
    print(f"BASE_URL={BASE_URL}")
    print(f"REEL_ID={REEL_ID}")
    print(f"USERS={len(tokens)}, ROUNDS={ROUNDS}, WORKERS={WORKERS}")

    states = resolve_initial_states(tokens)

    before = fetch_global_metrics(tokens[0])
    owner_before = get_user_profile(before.owner_id)
    followers_before = int(owner_before.get("followers_count", 0))

    like_calls = [st.token for st in states for _ in range(ROUNDS)]
    share_calls = [st.token for st in states for _ in range(ROUNDS)]
    view_calls = [st.token for st in states for _ in range(ROUNDS)]
    follow_calls = [st for st in states for _ in range(ROUNDS)]

    t0 = time.time()
    like_res = run_parallel_calls(post_like, like_calls)
    share_res = run_parallel_calls(post_share, share_calls)
    view_res = run_parallel_calls(post_view, view_calls)

    def follow_adapter(st: UserState) -> Tuple[int, bool]:
        return post_follow(st.token, before.owner_id)

    follow_res = run_parallel_calls(follow_adapter, follow_calls)
    elapsed = time.time() - t0

    after = fetch_global_metrics(tokens[0])
    owner_after = get_user_profile(after.owner_id)
    followers_after = int(owner_after.get("followers_count", 0))

    expected_likes = 0
    expected_followers = 0
    for st in states:
        expected_likes += expected_toggle_delta(st.initially_liked, ROUNDS)
        if st.user_id != before.owner_id:
            expected_followers += expected_toggle_delta(st.initially_following_owner, ROUNDS)

    expected_shares = int(share_res["counted_true"])
    expected_views = int(view_res["counted_true"])

    print("\n=== Request Summary ===")
    print(f"like: total={like_res['total']} success={like_res['success']} errors={like_res['errors']} status={like_res['status_hist']}")
    print(f"share: total={share_res['total']} success={share_res['success']} errors={share_res['errors']} counted_true={share_res['counted_true']} status={share_res['status_hist']}")
    print(f"view: total={view_res['total']} success={view_res['success']} errors={view_res['errors']} counted_true={view_res['counted_true']} status={view_res['status_hist']}")
    print(f"follow: total={follow_res['total']} success={follow_res['success']} errors={follow_res['errors']} status={follow_res['status_hist']}")
    print(f"elapsed_seconds={elapsed:.2f}")

    print("\n=== Consistency Checks ===")
    checks = [
        print_check("likes", before.likes, after.likes, expected_likes),
        print_check("shares", before.shares, after.shares, expected_shares),
        print_check("views", before.views, after.views, expected_views),
        print_check("followers", followers_before, followers_after, expected_followers),
    ]

    overall = all(checks) and like_res["errors"] == 0 and share_res["errors"] == 0 and view_res["errors"] == 0
    print(f"\nOVERALL={'PASS' if overall else 'FAIL'}")


if __name__ == "__main__":
    main()
