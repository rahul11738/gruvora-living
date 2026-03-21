# Here are your Instructions

## Reels Stress Suite

Run end-to-end multi-user reels validation with token preparation and threshold gating.

### Files
- `backend/prepare_stress_tokens.py`: logs in test users and writes tokens.
- `backend/stress_test_reels_multiuser.py`: runs concurrent like/share/view/follow checks.
- `backend/run_reels_stress_suite.py`: orchestrates both scripts and writes JSON report.
- `backend/ci_gate_context.py`: shared gate/severity/release-decision context used by workflow summary and webhook steps.

### Quick Start (PowerShell)
```powershell
cd backend
$env:BASE_URL="http://localhost:8000"
$env:USERS_FILE="stress_users.csv"
$env:REEL_ID="<video_id>"
$env:ROUNDS="1"
$env:WORKERS="40"
python run_reels_stress_suite.py
```

### Optional Threshold Gates
```powershell
$env:MIN_TOKENS="20"
$env:MIN_SUCCESS_RATE="0.99"
$env:MAX_ERROR_RATE="0.01"
$env:MAX_ELAPSED_SECONDS="120"
python run_reels_stress_suite.py
```

### Output
- A timestamped report file is written to `test_reports/reels_stress_suite_YYYYMMDD_HHMMSS.json`.
- The command exits non-zero on failure, suitable for CI/release gating.

### GitHub Actions (On Demand)
Workflow file: `.github/workflows/reels-stress-suite.yml`

Set these repository secrets before running the workflow:
- `REELS_BASE_URL`: API base URL of your deployed backend, example `https://api.example.com`.
- `REELS_STRESS_USERS`: comma-separated credentials in `email:password` format.
- `REELS_STRESS_WEBHOOK_URL` (optional): webhook endpoint for run notifications.

Trigger from the Actions tab using workflow dispatch inputs:
- `reel_id`
- `rounds`
- `workers`
- `min_tokens`
- `min_success_rate`
- `max_error_rate`
- `max_elapsed_seconds`

The workflow uploads JSON reports as artifacts, even on failure.
If `REELS_STRESS_WEBHOOK_URL` is set, it also sends a run summary notification with PASS/FAIL and threshold failure details.
Webhook first line now includes `release_decision` and `gate_severity` for immediate allow/manual-review/block visibility.
The workflow also publishes a GitHub job summary scoreboard (status, key metrics, action table, top failures) so results are visible without downloading artifacts.
When a previous report is available in run context, the summary also shows per-action trend deltas (success and error percentage-point change) versus the prior report.
The summary now includes a "Gates At A Glance" table with threshold gate status, regression gate status, and webhook delivery status.
It also includes an overall gate score (passed/active) and an automated recommended next action when any gate fails.
It now also outputs a gate severity label: `healthy`, `warning`, `critical`, or `info` (when no active gates are enabled).
It also outputs a release decision hint derived from severity: `allow` (healthy), `manual-review` (warning/info), `block` (critical).
The workflow enforces this policy by default: `block` fails the run, `manual-review` logs a warning, `allow` passes.
Optional repository variable: `REELS_ENFORCE_RELEASE_POLICY` (default `1`). Set to `0` to disable policy enforcement.

Optional repository variables for regression gating against previous report:
- `REELS_REGRESSION_MAX_SUCCESS_DROP_PP` (default `0`, disabled): fail if success rate drops more than this percentage-point threshold for any action.
- `REELS_REGRESSION_MAX_ERROR_INCREASE_PP` (default `0`, disabled): fail if error rate increases more than this percentage-point threshold for any action.

Example conservative gate values:
- `REELS_REGRESSION_MAX_SUCCESS_DROP_PP=0.50`
- `REELS_REGRESSION_MAX_ERROR_INCREASE_PP=0.50`

If fewer than 2 reports are available in the run context, regression gating is skipped.
Webhook behavior:
- Discord webhook URL: sends `content` with summary + details.
- Slack incoming webhook URL: sends formatted `text` + `blocks` + status color.
- Other webhook URL types: sends both `text` and `content` fields.

Optional repository variables for webhook delivery reliability:
- `REELS_WEBHOOK_RETRY_ATTEMPTS` (default `3`): max delivery attempts.
- `REELS_WEBHOOK_RETRY_BACKOFF_SECONDS` (default `1.5`): exponential backoff base seconds.
- `REELS_WEBHOOK_FAIL_ON_ERROR` (`0` or `1`, default `0`): when `1`, workflow fails if webhook delivery fails after retries.

### GitHub Actions (Nightly)
The same workflow also runs nightly on schedule (UTC) for lightweight regression detection.

Set these repository variables for scheduled runs:
- `REELS_NIGHTLY_REEL_ID`
- `REELS_NIGHTLY_ROUNDS`
- `REELS_NIGHTLY_WORKERS`
- `REELS_NIGHTLY_MIN_TOKENS`
- `REELS_NIGHTLY_MIN_SUCCESS_RATE`
- `REELS_NIGHTLY_MAX_ERROR_RATE`
- `REELS_NIGHTLY_MAX_ELAPSED_SECONDS`

Recommended nightly baseline:
- `REELS_NIGHTLY_ROUNDS=1`
- `REELS_NIGHTLY_WORKERS=20`
- `REELS_NIGHTLY_MIN_TOKENS=10`
- `REELS_NIGHTLY_MIN_SUCCESS_RATE=0.99`
- `REELS_NIGHTLY_MAX_ERROR_RATE=0.01`
- `REELS_NIGHTLY_MAX_ELAPSED_SECONDS=90`
