#!/usr/bin/env python3
"""Production-grade regression gate evaluator for Reels stress reports.

This script compares the latest stress report against a previous report and emits
GitHub Actions step outputs (`gate_status`, `gate_message`) to GITHUB_OUTPUT.
It is intentionally strict about malformed inputs and explicit in logging.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


@dataclass
class GateResult:
    status: str
    message: str
    violations: List[str]


class GateInputError(Exception):
    """Raised when required gate inputs are missing or invalid."""


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def log_event(level: str, event: str, **fields: Any) -> None:
    payload: Dict[str, Any] = {
        "ts": now_iso(),
        "level": level,
        "event": event,
    }
    payload.update(fields)
    print(json.dumps(payload, sort_keys=True, ensure_ascii=True))


def write_github_outputs(status: str, message: str, violations: Iterable[str]) -> None:
    output_path = os.environ.get("GITHUB_OUTPUT", "").strip()
    if not output_path:
        log_event(
            "warning",
            "github_output_missing",
            note="GITHUB_OUTPUT is not set; gate outputs cannot be exported",
            gate_status=status,
            gate_message=message,
        )
        return

    with open(output_path, "a", encoding="utf-8") as out:
        out.write(f"gate_status={status}\n")
        out.write(f"gate_message<<EOF\n{message}\nEOF\n")
        joined = "; ".join(list(violations))
        out.write(f"gate_violations<<EOF\n{joined}\nEOF\n")


def parse_float(
    raw_value: Any,
    *,
    metric_name: str,
    default: Optional[float] = None,
    allow_empty_default: bool = True,
) -> float:
    text = "" if raw_value is None else str(raw_value).strip()
    log_event("info", "parse_float_input", metric=metric_name, raw=text)

    if text == "":
        if default is not None and allow_empty_default:
            log_event(
                "warning",
                "parse_float_default_used",
                metric=metric_name,
                default=default,
                reason="empty input",
            )
            return float(default)
        raise GateInputError(f"Metric '{metric_name}' is missing or empty")

    try:
        return float(text)
    except ValueError as exc:
        raise GateInputError(
            f"Metric '{metric_name}' must be numeric, got '{text}'"
        ) from exc


def read_json_file(path: Path) -> Dict[str, Any]:
    if not path.exists():
        raise GateInputError(f"Report file does not exist: {path}")
    if not path.is_file():
        raise GateInputError(f"Report path is not a file: {path}")

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as exc:
        raise GateInputError(f"Invalid JSON in report '{path}': {exc}") from exc

    if not isinstance(data, dict):
        raise GateInputError(f"Report '{path}' must be a JSON object")

    return data


def metric_from_action_stats(
    action_stats: Dict[str, Any],
    *,
    action: str,
    key: str,
    on_missing: str,
    default_bps: float,
) -> float:
    action_payload = action_stats.get(action)
    if not isinstance(action_payload, dict):
        msg = f"Action '{action}' is missing in action_stats"
        if on_missing == "error":
            raise GateInputError(msg)
        log_event("warning", "action_missing", action=action, strategy=on_missing)
        return default_bps / 100.0

    raw_metric = action_payload.get(key)
    metric_name = f"{action}.{key}"

    if raw_metric is None or str(raw_metric).strip() == "":
        msg = f"Metric '{metric_name}' is missing from previous step/report"
        if on_missing == "error":
            raise GateInputError(msg)
        log_event(
            "warning",
            "metric_missing_defaulted",
            metric=metric_name,
            default_bps=default_bps,
        )
        return default_bps / 100.0

    value_bps = parse_float(raw_metric, metric_name=metric_name)
    return value_bps / 100.0


def evaluate_gate(
    *,
    current_report_path: Path,
    previous_report_path: Optional[Path],
    max_success_drop_pp: float,
    max_error_increase_pp: float,
    actions: List[str],
    on_missing: str,
    default_metric_bps: float,
) -> GateResult:
    log_event(
        "info",
        "gate_start",
        current_report=str(current_report_path),
        previous_report=str(previous_report_path) if previous_report_path else "",
        max_success_drop_pp=max_success_drop_pp,
        max_error_increase_pp=max_error_increase_pp,
        actions=actions,
        on_missing=on_missing,
        default_metric_bps=default_metric_bps,
    )

    if max_success_drop_pp <= 0 and max_error_increase_pp <= 0:
        return GateResult("disabled", "Regression gate disabled (thresholds <= 0)", [])

    if previous_report_path is None or str(previous_report_path).strip() == "":
        return GateResult("skipped", "Previous report unavailable for regression comparison", [])

    current = read_json_file(current_report_path)
    previous = read_json_file(previous_report_path)

    current_stats = current.get("action_stats")
    previous_stats = previous.get("action_stats")
    if not isinstance(current_stats, dict):
        raise GateInputError("Current report is missing object 'action_stats'")
    if not isinstance(previous_stats, dict):
        raise GateInputError("Previous report is missing object 'action_stats'")

    violations: List[str] = []
    debug_deltas: Dict[str, Dict[str, float]] = {}

    for action in actions:
        cur_success = metric_from_action_stats(
            current_stats,
            action=action,
            key="success_rate_bps",
            on_missing=on_missing,
            default_bps=default_metric_bps,
        )
        prev_success = metric_from_action_stats(
            previous_stats,
            action=action,
            key="success_rate_bps",
            on_missing=on_missing,
            default_bps=default_metric_bps,
        )
        cur_error = metric_from_action_stats(
            current_stats,
            action=action,
            key="error_rate_bps",
            on_missing=on_missing,
            default_bps=default_metric_bps,
        )
        prev_error = metric_from_action_stats(
            previous_stats,
            action=action,
            key="error_rate_bps",
            on_missing=on_missing,
            default_bps=default_metric_bps,
        )

        success_drop = prev_success - cur_success
        error_increase = cur_error - prev_error

        debug_deltas[action] = {
            "cur_success_pp": cur_success,
            "prev_success_pp": prev_success,
            "success_drop_pp": success_drop,
            "cur_error_pp": cur_error,
            "prev_error_pp": prev_error,
            "error_increase_pp": error_increase,
        }

        if max_success_drop_pp > 0 and success_drop > max_success_drop_pp:
            violations.append(
                f"{action}: success dropped by {success_drop:.2f}pp (max {max_success_drop_pp:.2f}pp)"
            )

        if max_error_increase_pp > 0 and error_increase > max_error_increase_pp:
            violations.append(
                f"{action}: error increased by {error_increase:.2f}pp (max {max_error_increase_pp:.2f}pp)"
            )

    log_event("info", "gate_metrics_compared", deltas=debug_deltas)

    if violations:
        return GateResult("failed", "; ".join(violations), violations)

    return GateResult("passed", "No regression violations", [])


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate regression gate for Reels stress reports")
    parser.add_argument("--current-report", required=True, help="Path to latest report JSON")
    parser.add_argument("--previous-report", default="", help="Path to previous report JSON")
    parser.add_argument(
        "--max-success-drop-pp",
        default="0",
        help="Maximum allowed success-rate drop in percentage points",
    )
    parser.add_argument(
        "--max-error-increase-pp",
        default="0",
        help="Maximum allowed error-rate increase in percentage points",
    )
    parser.add_argument(
        "--actions",
        default="like,share,view,follow",
        help="Comma-separated actions to compare",
    )
    parser.add_argument(
        "--on-missing",
        choices=["error", "default"],
        default="error",
        help="How to handle missing metrics in reports",
    )
    parser.add_argument(
        "--default-metric-bps",
        default="0",
        help="Fallback metric value (basis points) when --on-missing=default",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        max_success_drop_pp = parse_float(
            args.max_success_drop_pp,
            metric_name="max_success_drop_pp",
            default=0.0,
        )
        max_error_increase_pp = parse_float(
            args.max_error_increase_pp,
            metric_name="max_error_increase_pp",
            default=0.0,
        )
        default_metric_bps = parse_float(
            args.default_metric_bps,
            metric_name="default_metric_bps",
            default=0.0,
        )

        actions = [a.strip() for a in args.actions.split(",") if a.strip()]
        if not actions:
            raise GateInputError("At least one action is required for regression gate")

        current_report = Path(args.current_report)
        previous_report = Path(args.previous_report) if str(args.previous_report).strip() else None

        result = evaluate_gate(
            current_report_path=current_report,
            previous_report_path=previous_report,
            max_success_drop_pp=max_success_drop_pp,
            max_error_increase_pp=max_error_increase_pp,
            actions=actions,
            on_missing=args.on_missing,
            default_metric_bps=default_metric_bps,
        )

        log_event(
            "info",
            "gate_result",
            status=result.status,
            message=result.message,
            violations=result.violations,
        )
        write_github_outputs(result.status, result.message, result.violations)
        return 0

    except GateInputError as exc:
        message = str(exc)
        log_event("error", "gate_input_error", message=message)
        write_github_outputs("failed", message, [message])
        # Return success so downstream explicit failure step can report a controlled message.
        return 0
    except Exception as exc:  # defensive fallback
        message = f"Unexpected regression gate error: {exc}"
        log_event("error", "gate_unhandled_exception", message=message)
        write_github_outputs("failed", message, [message])
        return 0


if __name__ == "__main__":
    sys.exit(main())
