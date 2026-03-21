import json
from pathlib import Path

from ci_gate_context import _gate_severity, _release_decision, build_context


def _write_report(path: Path, name: str, payload: dict) -> Path:
    report_path = path / name
    report_path.write_text(json.dumps(payload), encoding="utf-8")
    return report_path


def test_gate_severity_and_release_decision_mapping() -> None:
    assert _gate_severity([]) == "info"
    assert _gate_severity(["passed"]) == "healthy"
    assert _gate_severity(["passed", "failed"]) == "warning"
    assert _gate_severity(["failed", "failed"]) == "critical"

    assert _release_decision("healthy") == "allow"
    assert _release_decision("warning") == "manual-review"
    assert _release_decision("info") == "manual-review"
    assert _release_decision("critical") == "block"


def test_build_context_healthy_when_threshold_and_regression_pass(tmp_path: Path) -> None:
    _write_report(
        tmp_path,
        "reels_stress_suite_1.json",
        {
            "suite_pass": True,
            "token_count": 15,
            "overall_from_stress_output": "PASS",
            "config": {"reel_id": "r1", "workers": 20, "rounds": 1},
            "action_stats": {
                "like": {"success_rate_bps": 10000, "error_rate_bps": 0},
                "share": {"success_rate_bps": 9900, "error_rate_bps": 100},
            },
            "threshold_failures": [],
        },
    )

    ctx = build_context(
        report_glob=str(tmp_path / "reels_stress_suite_*.json"),
        regression_status="passed",
        regression_message="",
        webhook_enabled=False,
        webhook_outcome="skipped",
        include_webhook_in_policy=False,
    )

    assert ctx["status"] == "PASS"
    assert ctx["threshold_status"] == "passed"
    assert ctx["gate_severity"] == "healthy"
    assert ctx["release_decision"] == "allow"
    assert ctx["gate_score"] == {"passed": 2, "total": 2}
    assert ctx["recommendation"] == "No immediate action required."
    assert "like: success=100.00% error=0.00%" in ctx["action_line"]


def test_build_context_webhook_failure_affects_policy_only_when_included(tmp_path: Path) -> None:
    _write_report(tmp_path, "reels_stress_suite_1.json", {"suite_pass": True, "threshold_failures": []})

    ctx_excluded = build_context(
        report_glob=str(tmp_path / "reels_stress_suite_*.json"),
        regression_status="passed",
        regression_message="",
        webhook_enabled=True,
        webhook_outcome="failure",
        include_webhook_in_policy=False,
    )
    assert ctx_excluded["webhook_status"] == "failed"
    assert ctx_excluded["gate_severity"] == "healthy"
    assert ctx_excluded["release_decision"] == "allow"

    ctx_included = build_context(
        report_glob=str(tmp_path / "reels_stress_suite_*.json"),
        regression_status="passed",
        regression_message="",
        webhook_enabled=True,
        webhook_outcome="failure",
        include_webhook_in_policy=True,
    )
    assert ctx_included["gate_severity"] == "warning"
    assert ctx_included["release_decision"] == "manual-review"
    assert "webhook" in ctx_included["failed_gates"]
    assert "webhook retry/backoff" in ctx_included["recommendation"]


def test_build_context_threshold_failure_has_priority_recommendation(tmp_path: Path) -> None:
    _write_report(
        tmp_path,
        "reels_stress_suite_1.json",
        {
            "suite_pass": False,
            "threshold_failures": [
                "like success_rate=0.80 < min=0.99",
                "view error_rate=0.05 > max=0.01",
            ],
        },
    )

    ctx = build_context(
        report_glob=str(tmp_path / "reels_stress_suite_*.json"),
        regression_status="failed",
        regression_message="drop detected",
        webhook_enabled=False,
        webhook_outcome="skipped",
        include_webhook_in_policy=True,
    )

    assert ctx["status"] == "FAIL"
    assert ctx["threshold_status"] == "failed"
    assert ctx["gate_severity"] == "warning"
    assert ctx["release_decision"] == "manual-review"
    assert "threshold failures" in ctx["recommendation"].lower()
    assert ctx["top_failures_line"] == "like success_rate=0.80 < min=0.99 ; view error_rate=0.05 > max=0.01"


def test_build_context_without_report_uses_safe_defaults(tmp_path: Path) -> None:
    ctx = build_context(
        report_glob=str(tmp_path / "reels_stress_suite_*.json"),
        regression_status="unknown",
        regression_message="",
        webhook_enabled=False,
        webhook_outcome="skipped",
        include_webhook_in_policy=False,
    )

    assert ctx["report_path"] == ""
    assert ctx["status"] == "FAIL"
    assert ctx["threshold_status"] == "failed"
    assert ctx["gate_score"] == {"passed": 0, "total": 1}
    assert ctx["action_line"] == "action stats unavailable"
    assert ctx["failures_text"] == "none"
