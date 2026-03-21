"""
One-command reels stress suite runner.

Runs:
1) prepare_stress_tokens.py
2) stress_test_reels_multiuser.py

Writes a timestamped JSON report under ../test_reports/.

PowerShell example:
  cd backend
  $env:BASE_URL="http://localhost:8000"
  $env:USERS_FILE="stress_users.csv"
  $env:REEL_ID="<video_id>"
  $env:ROUNDS="1"
  $env:WORKERS="40"
  python run_reels_stress_suite.py

Optional:
  $env:REPORT_DIR="..\\test_reports"
  $env:TOKENS_FILE="tokens.txt"      # default generated file
  $env:SKIP_PREPARE="0"              # set to 1 to skip token generation step
    $env:MIN_TOKENS="20"               # fail if fewer tokens are available
    $env:MIN_SUCCESS_RATE="0.99"       # per-action minimum success ratio
    $env:MAX_ERROR_RATE="0.01"         # per-action maximum error ratio
    $env:MAX_ELAPSED_SECONDS="120"     # 0 disables elapsed-time gating
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any


BASE_URL = os.environ.get("BASE_URL", "http://localhost:8000").rstrip("/")
USERS_FILE = os.environ.get("USERS_FILE", "").strip()
USERS_INLINE = os.environ.get("USERS", "").strip()
REEL_ID = os.environ.get("REEL_ID", "").strip()
ROUNDS = os.environ.get("ROUNDS", "1").strip()
WORKERS = os.environ.get("WORKERS", "40").strip()
TOKENS_FILE = os.environ.get("TOKENS_FILE", "tokens.txt").strip()
SKIP_PREPARE = os.environ.get("SKIP_PREPARE", "0").strip() == "1"
REPORT_DIR = os.environ.get("REPORT_DIR", "..\\test_reports").strip()
MIN_TOKENS = int(os.environ.get("MIN_TOKENS", "1").strip())
MIN_SUCCESS_RATE = float(os.environ.get("MIN_SUCCESS_RATE", "0.99").strip())
MAX_ERROR_RATE = float(os.environ.get("MAX_ERROR_RATE", "0.01").strip())
MAX_ELAPSED_SECONDS = float(os.environ.get("MAX_ELAPSED_SECONDS", "0").strip())


def run_script(script_name: str, extra_env: Dict[str, str]) -> Dict[str, Any]:
    env = os.environ.copy()
    env.update(extra_env)

    t0 = time.time()
    proc = subprocess.run(
        [sys.executable, script_name],
        capture_output=True,
        text=True,
        env=env,
    )
    elapsed = time.time() - t0

    return {
        "script": script_name,
        "returncode": proc.returncode,
        "elapsed_seconds": round(elapsed, 3),
        "stdout": proc.stdout,
        "stderr": proc.stderr,
    }


def parse_overall(stdout_text: str) -> str:
    match = re.search(r"OVERALL=(PASS|FAIL)", stdout_text)
    return match.group(1) if match else "UNKNOWN"


def parse_action_stats(stdout_text: str) -> Dict[str, Dict[str, int]]:
    action_stats: Dict[str, Dict[str, int]] = {}
    for action in ["like", "share", "view", "follow"]:
        pattern = rf"{action}:\s+total=(\d+)\s+success=(\d+)\s+errors=(\d+)"
        match = re.search(pattern, stdout_text)
        if not match:
            continue
        total = int(match.group(1))
        success = int(match.group(2))
        errors = int(match.group(3))
        success_rate = (float(success) / float(total)) if total > 0 else 0.0
        error_rate = (float(errors) / float(total)) if total > 0 else 1.0
        action_stats[action] = {
            "total": total,
            "success": success,
            "errors": errors,
            "success_rate_bps": int(round(success_rate * 10000)),
            "error_rate_bps": int(round(error_rate * 10000)),
        }
    return action_stats


def count_tokens(path: Path) -> int:
    if not path.exists():
        return 0
    with path.open("r", encoding="utf-8") as f:
        return sum(1 for line in f if line.strip())


def main() -> None:
    if not REEL_ID:
        raise RuntimeError("REEL_ID env var is required")
    if not SKIP_PREPARE and not USERS_FILE and not USERS_INLINE:
        raise RuntimeError("Provide USERS_FILE or USERS unless SKIP_PREPARE=1")

    report_dir = Path(REPORT_DIR).resolve()
    report_dir.mkdir(parents=True, exist_ok=True)

    started_at = datetime.now(timezone.utc)
    started_iso = started_at.isoformat()

    print("=== Reels Stress Suite ===")
    print(f"BASE_URL={BASE_URL}")
    print(f"REEL_ID={REEL_ID}")
    print(f"ROUNDS={ROUNDS}, WORKERS={WORKERS}")
    print(f"TOKENS_FILE={TOKENS_FILE}")
    print(f"SKIP_PREPARE={SKIP_PREPARE}")

    prepare_result: Dict[str, Any] = {"skipped": SKIP_PREPARE}
    if not SKIP_PREPARE:
        prepare_result = run_script(
            "prepare_stress_tokens.py",
            {
                "BASE_URL": BASE_URL,
                "USERS_FILE": USERS_FILE,
                "USERS": USERS_INLINE,
                "OUT_TOKENS_FILE": TOKENS_FILE,
            },
        )
        print(f"prepare_stress_tokens.py returncode={prepare_result['returncode']}")
        if prepare_result["returncode"] != 0:
            print("Token preparation failed. Suite aborted.")

    tokens_path = Path(TOKENS_FILE)
    token_count = count_tokens(tokens_path)

    stress_result: Dict[str, Any] = {
        "skipped": False,
        "script": "stress_test_reels_multiuser.py",
        "returncode": 1,
        "elapsed_seconds": 0,
        "stdout": "",
        "stderr": "Skipped due to token preparation failure",
    }

    can_run_stress = SKIP_PREPARE or (prepare_result.get("returncode", 1) == 0)
    if can_run_stress:
        stress_result = run_script(
            "stress_test_reels_multiuser.py",
            {
                "BASE_URL": BASE_URL,
                "REEL_ID": REEL_ID,
                "TOKENS_FILE": TOKENS_FILE,
                "ROUNDS": ROUNDS,
                "WORKERS": WORKERS,
            },
        )
        print(f"stress_test_reels_multiuser.py returncode={stress_result['returncode']}")

    overall_from_output = parse_overall(stress_result.get("stdout", ""))
    action_stats = parse_action_stats(stress_result.get("stdout", ""))

    base_ok = (
        can_run_stress
        and stress_result.get("returncode", 1) == 0
        and overall_from_output == "PASS"
        and token_count >= MIN_TOKENS
    )

    threshold_failures = []
    for action, stats in action_stats.items():
        success_rate = stats["success_rate_bps"] / 10000.0
        error_rate = stats["error_rate_bps"] / 10000.0
        if success_rate < MIN_SUCCESS_RATE:
            threshold_failures.append(
                f"{action} success_rate={success_rate:.4f} < min={MIN_SUCCESS_RATE:.4f}"
            )
        if error_rate > MAX_ERROR_RATE:
            threshold_failures.append(
                f"{action} error_rate={error_rate:.4f} > max={MAX_ERROR_RATE:.4f}"
            )

    if MAX_ELAPSED_SECONDS > 0 and stress_result.get("elapsed_seconds", 0) > MAX_ELAPSED_SECONDS:
        threshold_failures.append(
            f"stress elapsed_seconds={stress_result.get('elapsed_seconds', 0):.3f} > max={MAX_ELAPSED_SECONDS:.3f}"
        )

    suite_ok = base_ok and len(threshold_failures) == 0

    finished_at = datetime.now(timezone.utc)
    report = {
        "started_at": started_iso,
        "finished_at": finished_at.isoformat(),
        "duration_seconds": round((finished_at - started_at).total_seconds(), 3),
        "config": {
            "base_url": BASE_URL,
            "reel_id": REEL_ID,
            "rounds": int(ROUNDS),
            "workers": int(WORKERS),
            "tokens_file": str(tokens_path),
            "users_file": USERS_FILE,
            "users_inline_provided": bool(USERS_INLINE),
            "skip_prepare": SKIP_PREPARE,
            "thresholds": {
                "min_tokens": MIN_TOKENS,
                "min_success_rate": MIN_SUCCESS_RATE,
                "max_error_rate": MAX_ERROR_RATE,
                "max_elapsed_seconds": MAX_ELAPSED_SECONDS,
            },
        },
        "token_count": token_count,
        "prepare": prepare_result,
        "stress": stress_result,
        "overall_from_stress_output": overall_from_output,
        "action_stats": action_stats,
        "threshold_failures": threshold_failures,
        "suite_pass": suite_ok,
    }

    stamp = started_at.strftime("%Y%m%d_%H%M%S")
    report_path = report_dir / f"reels_stress_suite_{stamp}.json"
    with report_path.open("w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=True, indent=2)

    print(f"token_count={token_count}")
    print(f"overall_from_stress_output={overall_from_output}")
    if threshold_failures:
        print("threshold_failures:")
        for item in threshold_failures:
            print(f"- {item}")
    print(f"suite_pass={suite_ok}")
    print(f"report={report_path}")

    if not suite_ok:
        sys.exit(1)


if __name__ == "__main__":
    main()
