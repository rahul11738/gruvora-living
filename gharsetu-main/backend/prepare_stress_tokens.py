"""
Prepare JWT tokens for multi-user stress testing.

Input formats:
1) USERS_FILE as CSV with header: email,password
2) USERS as inline CSV pairs: email1:pass1,email2:pass2

PowerShell example:
  cd backend
  $env:BASE_URL="http://localhost:8000"
  $env:USERS_FILE="stress_users.csv"
  $env:OUT_TOKENS_FILE="tokens.txt"
  python prepare_stress_tokens.py

Optional:
  $env:WORKERS="20"
  $env:OUT_DETAILS_FILE="tokens_details.json"

Output:
- tokens.txt: one JWT token per line
- tokens_details.json: login metadata per user
"""

from __future__ import annotations

import concurrent.futures
import csv
import json
import os
import threading
from dataclasses import dataclass
from typing import Any, Dict, List, Tuple

import requests


BASE_URL = os.environ.get("BASE_URL", "http://localhost:8000").rstrip("/")
USERS_FILE = os.environ.get("USERS_FILE", "").strip()
USERS_INLINE = os.environ.get("USERS", "").strip()
OUT_TOKENS_FILE = os.environ.get("OUT_TOKENS_FILE", "tokens.txt").strip()
OUT_DETAILS_FILE = os.environ.get("OUT_DETAILS_FILE", "tokens_details.json").strip()
WORKERS = int(os.environ.get("WORKERS", "20"))
TIMEOUT = int(os.environ.get("TIMEOUT", "20"))


@dataclass
class Credential:
    email: str
    password: str


_thread_local = threading.local()


def get_session() -> requests.Session:
    session = getattr(_thread_local, "session", None)
    if session is None:
        session = requests.Session()
        _thread_local.session = session
    return session


def load_creds() -> List[Credential]:
    creds: List[Credential] = []

    if USERS_FILE:
        with open(USERS_FILE, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                email = (row.get("email") or "").strip()
                password = (row.get("password") or "").strip()
                if email and password:
                    creds.append(Credential(email=email, password=password))

    if USERS_INLINE:
        for pair in USERS_INLINE.split(","):
            item = pair.strip()
            if not item or ":" not in item:
                continue
            email, password = item.split(":", 1)
            email = email.strip()
            password = password.strip()
            if email and password:
                creds.append(Credential(email=email, password=password))

    # Deduplicate by email while preserving order.
    deduped: List[Credential] = []
    seen = set()
    for c in creds:
        if c.email not in seen:
            deduped.append(c)
            seen.add(c.email)

    return deduped


def login(cred: Credential) -> Dict[str, Any]:
    payload = {"email": cred.email, "password": cred.password}
    s = get_session()
    resp = s.post(f"{BASE_URL}/api/auth/login", json=payload, timeout=TIMEOUT)

    if resp.status_code != 200:
        detail = ""
        try:
            detail = str(resp.json())
        except Exception:
            detail = resp.text[:200]
        return {
            "email": cred.email,
            "ok": False,
            "status": resp.status_code,
            "error": detail,
        }

    data = resp.json()
    token = data.get("token", "")
    user = data.get("user", {}) if isinstance(data, dict) else {}
    return {
        "email": cred.email,
        "ok": bool(token),
        "status": resp.status_code,
        "token": token,
        "user_id": user.get("id", ""),
        "role": user.get("role", ""),
    }


def main() -> None:
    creds = load_creds()
    if not creds:
        raise RuntimeError("No credentials found. Provide USERS_FILE or USERS.")

    print("=== Prepare Stress Tokens ===")
    print(f"BASE_URL={BASE_URL}")
    print(f"credentials={len(creds)} workers={WORKERS}")

    results: List[Dict[str, Any]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futures = [ex.submit(login, c) for c in creds]
        for future in concurrent.futures.as_completed(futures):
            try:
                results.append(future.result())
            except Exception as ex_err:
                results.append({"email": "unknown", "ok": False, "status": 0, "error": str(ex_err)})

    # Stable order by original credentials list.
    by_email = {r.get("email", ""): r for r in results}
    ordered = [by_email.get(c.email, {"email": c.email, "ok": False, "status": 0, "error": "No result"}) for c in creds]

    ok_rows = [r for r in ordered if r.get("ok")]
    fail_rows = [r for r in ordered if not r.get("ok")]

    with open(OUT_TOKENS_FILE, "w", encoding="utf-8", newline="\n") as f:
        for row in ok_rows:
            f.write(f"{row.get('token', '')}\n")

    with open(OUT_DETAILS_FILE, "w", encoding="utf-8") as f:
        json.dump(ordered, f, ensure_ascii=True, indent=2)

    print(f"successful_logins={len(ok_rows)} failed_logins={len(fail_rows)}")
    print(f"tokens_file={OUT_TOKENS_FILE}")
    print(f"details_file={OUT_DETAILS_FILE}")

    if fail_rows:
        print("\nFailed users:")
        for row in fail_rows[:20]:
            print(f"- {row.get('email')} status={row.get('status')} error={row.get('error')}")


if __name__ == "__main__":
    main()
