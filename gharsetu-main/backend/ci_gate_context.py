"""
Shared CI gate context builder for reels stress reports.

This utility centralizes gate evaluation logic so GitHub Actions steps
(webhook summary, job summary, release policy) stay consistent.
"""

from __future__ import annotations

import argparse
import glob
import json
from typing import Any, Dict, List


def _read_latest_report(report_glob: str) -> Dict[str, Any]:
    report_paths = sorted(glob.glob(report_glob))
    if not report_paths:
        return {"report": {}, "report_path": ""}
    latest = report_paths[-1]
    with open(latest, "r", encoding="utf-8") as f:
        return {"report": json.load(f), "report_path": latest}


def _gate_severity(active_statuses: List[str]) -> str:
    failed_count = sum(1 for s in active_statuses if s == "failed")
    total_count = len(active_statuses)
    if total_count == 0:
        return "info"
    if failed_count == 0:
        return "healthy"
    if failed_count == 1:
        return "warning"
    return "critical"


def _release_decision(severity: str) -> str:
    if severity == "healthy":
        return "allow"
    if severity == "critical":
        return "block"
    return "manual-review"


def _recommendation(failed_gates: List[str], total_count: int) -> str:
    if "threshold" in failed_gates:
        return "Investigate threshold failures in the latest report, then tune load, limits, or backend hot paths."
    if "regression" in failed_gates:
        return "Inspect Trend vs Previous deltas and isolate the action with largest degradation before release."
    if "webhook" in failed_gates:
        return "Verify webhook URL/permissions and review webhook retry/backoff variables."
    if total_count == 0:
        return "Enable at least one gate threshold so the run has enforceable quality criteria."
    return "No immediate action required."


def build_context(
    report_glob: str,
    regression_status: str,
    regression_message: str,
    webhook_enabled: bool,
    webhook_outcome: str,
    include_webhook_in_policy: bool,
) -> Dict[str, Any]:
    report_payload = _read_latest_report(report_glob)
    report = report_payload["report"]

    suite_pass = bool(report.get("suite_pass", False))
    status = "PASS" if suite_pass else "FAIL"
    threshold_status = "passed" if suite_pass else "failed"

    if not webhook_enabled:
        webhook_status = "disabled"
    elif webhook_outcome == "success":
        webhook_status = "passed"
    elif webhook_outcome == "failure":
        webhook_status = "failed"
    else:
        webhook_status = "skipped"

    gate_statuses = {
        "threshold": threshold_status,
        "regression": regression_status or "unknown",
    }
    if include_webhook_in_policy:
        gate_statuses["webhook"] = webhook_status

    active_statuses = [s for s in gate_statuses.values() if s in {"passed", "failed"}]
    passed_count = sum(1 for s in active_statuses if s == "passed")
    total_count = len(active_statuses)
    failed_gates = [name for name, s in gate_statuses.items() if s == "failed"]

    gate_severity = _gate_severity(active_statuses)
    release_decision = _release_decision(gate_severity)
    recommendation = _recommendation(failed_gates, total_count)

    threshold_failures = report.get("threshold_failures", [])
    top_failures = threshold_failures[:3]
    failures_text = "; ".join(threshold_failures[:6]) if threshold_failures else "none"
    top_failures_line = " ; ".join(top_failures) if top_failures else "none"

    action_stats = report.get("action_stats", {})
    action_parts = []
    for action in ["like", "share", "view", "follow"]:
        stats = action_stats.get(action)
        if not stats:
            continue
        sr = stats.get("success_rate_bps", 0) / 100.0
        er = stats.get("error_rate_bps", 0) / 100.0
        action_parts.append(f"{action}: success={sr:.2f}% error={er:.2f}%")
    action_line = " | ".join(action_parts) if action_parts else "action stats unavailable"

    config = report.get("config", {})
    token_count = int(report.get("token_count", 0))
    overall = report.get("overall_from_stress_output", "UNKNOWN")

    return {
        "report_path": report_payload["report_path"],
        "status": status,
        "threshold_status": threshold_status,
        "regression_status": regression_status or "unknown",
        "regression_message": regression_message or "",
        "webhook_status": webhook_status,
        "webhook_outcome": webhook_outcome,
        "gate_severity": gate_severity,
        "release_decision": release_decision,
        "recommendation": recommendation,
        "gate_score": {
            "passed": passed_count,
            "total": total_count,
        },
        "failed_gates": failed_gates,
        "token_count": token_count,
        "overall": overall,
        "reel_id": config.get("reel_id", ""),
        "workers": config.get("workers", ""),
        "rounds": config.get("rounds", ""),
        "top_failures_line": top_failures_line,
        "failures_text": failures_text,
        "action_line": action_line,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build shared gate context from reels stress report")
    parser.add_argument("--report-glob", required=True)
    parser.add_argument("--regression-status", default="unknown")
    parser.add_argument("--regression-message", default="")
    parser.add_argument("--webhook-enabled", default="false")
    parser.add_argument("--webhook-outcome", default="skipped")
    parser.add_argument("--include-webhook-in-policy", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    context = build_context(
        report_glob=args.report_glob,
        regression_status=args.regression_status,
        regression_message=args.regression_message,
        webhook_enabled=str(args.webhook_enabled).lower() == "true",
        webhook_outcome=args.webhook_outcome,
        include_webhook_in_policy=bool(args.include_webhook_in_policy),
    )
    print(json.dumps(context, ensure_ascii=True))


if __name__ == "__main__":
    main()
