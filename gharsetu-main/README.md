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
- `JWT_SECRET`: backend JWT signing secret (required for deterministic refresh-token security tests in CI).

Trigger from the Actions tab using workflow dispatch inputs:
- `reel_id`
- `rounds`
- `workers`
- `min_tokens`
- `min_success_rate`
- `max_error_rate`
- `max_elapsed_seconds`

The workflow uploads JSON reports as artifacts, even on failure.

## Local Backend Startup (No Port Loop)

If port `8000` is already in use, start backend with auto port selection:

```powershell
cd backend
python start_backend_auto_port.py
```

Behavior:
- Tries `8000`, then `8001..8010`.
- Starts Uvicorn on the first free port.
- Prints the selected backend URL.

Frontend note:
- Frontend API client now auto-discovers local backend on `127.0.0.1:8000/8001` (and `localhost` variants) when `REACT_APP_BACKEND_URL` is not set.

## Smart Search Smoke Check

Run end-to-end search smoke checks (health, suggest, smart search, authenticated voice):

```powershell
cd backend
$env:BASE_URL="http://127.0.0.1:8001"  # set this to whichever port backend is running on
.\smoke_search_endpoints.ps1
```

Expected outcome:
- Health returns 200.
- Suggest and smart endpoints return results using `query` parameter.
- Voice endpoint returns 200 with bearer token from temporary registered user.
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

### Auth/Security Workflow
Workflow file: `.github/workflows/auth-security-tests.yml`

This workflow is lightweight and runs auth/security regression tests only. It triggers on:
- Manual run (`workflow_dispatch`)
- Pull requests that touch backend/workflow files
- Pushes to `main` and `develop` with the same path filters

What it enforces:
- Password policy validation behavior
- JWT refresh behavior (invalid token, too-old token, valid refresh)
- Role-claim integrity on refresh (DB role must win over token payload role)
- Security headers presence (`X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`)

What it publishes:
- GitHub step summary with passed/failed/errors/skipped counts
- Artifact: `test_reports/pytest_auth_security.xml`

Required repository secrets for this workflow:
- `REELS_BASE_URL`
- `JWT_SECRET`

It uses least-privilege token permissions (`contents: read`) and per-branch concurrency cancellation so only the latest run remains active.

### CI Signals (Job Summary)
Both workflows publish preflight diagnostics in the job summary so reviewers can quickly distinguish configuration problems from runtime test/stress failures.

Summary fields:
- `preflight_mode`
- `preflight_reason`

`preflight_mode` values:
- `enforced`: all required secrets/inputs were present and execution proceeded normally.
- `enforced-missing-secrets`: run was in enforced mode but required secrets/inputs were missing, so the workflow failed fast.
- `skipped-on-pr`: auth/security workflow skipped test execution on pull_request due to unavailable secrets.

How to read outcomes:
- `preflight_mode=enforced` + failing status: execution ran and found real test/stress issues.
- `preflight_mode=enforced-missing-secrets`: fix repository secrets/variables or workflow-dispatch inputs first.
- `preflight_mode=skipped-on-pr`: expected for PR contexts where secrets are not exposed; validate on push/manual run in protected branches.

### Branch Protection (Recommended)
To enforce these checks before merge:

1. Go to repository Settings -> Branches -> Add branch protection rule.
2. Target branches: `main` (and optionally `develop`).
3. Enable "Require a pull request before merging".
4. Enable "Require status checks to pass before merging".
5. Add required checks:
	- `Run Auth/Security Regression Tests`
	- `Run Reels Stress Suite` (if you want stress validation as a merge gate)
6. Enable "Require branches to be up to date before merging".

This turns your auth/security and stress workflows into hard merge gates.

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
