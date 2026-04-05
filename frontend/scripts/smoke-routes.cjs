/* eslint-disable no-console */
const axios = require('axios');

const frontendBaseUrl = process.env.FRONTEND_BASE_URL || 'http://localhost:3001';
const backendBaseUrl = process.env.BACKEND_BASE_URL || 'http://localhost:8000';
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 10000);

const checks = [
  {
    name: 'frontend_home',
    url: `${frontendBaseUrl}/`,
    expectText: 'You need to enable JavaScript to run this app.',
    frontendRoute: true,
  },
  {
    name: 'frontend_map',
    url: `${frontendBaseUrl}/map?listingId=1&city=Surat&category=home`,
    expectText: 'You need to enable JavaScript to run this app.',
    frontendRoute: true,
  },
  {
    name: 'frontend_reels',
    url: `${frontendBaseUrl}/reels?listingId=1`,
    expectText: 'You need to enable JavaScript to run this app.',
    frontendRoute: true,
  },
  {
    name: 'backend_listings',
    url: `${backendBaseUrl}/api/listings?limit=1`,
  },
];

function isOkStatus(status) {
  return status >= 200 && status < 400;
}

async function runCheck(check) {
  const startedAt = Date.now();
  try {
    const response = await axios.get(check.url, {
      timeout: timeoutMs,
      headers: check.frontendRoute ? { Accept: 'text/html' } : undefined,
      validateStatus: () => true,
    });

    const elapsedMs = Date.now() - startedAt;
    const body = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

    if (!isOkStatus(response.status)) {
      return {
        ...check,
        ok: false,
        reason: `HTTP ${response.status}`,
        elapsedMs,
      };
    }

    if (check.expectText && !body.includes(check.expectText)) {
      return {
        ...check,
        ok: false,
        reason: `Expected text not found: ${check.expectText}`,
        elapsedMs,
      };
    }

    return {
      ...check,
      ok: true,
      reason: `HTTP ${response.status}`,
      elapsedMs,
    };
  } catch (error) {
    return {
      ...check,
      ok: false,
      reason: error.message || 'Unknown error',
      elapsedMs: Date.now() - startedAt,
    };
  }
}

async function main() {
  console.log('Running smoke route checks...');
  console.log(`FRONTEND_BASE_URL=${frontendBaseUrl}`);
  console.log(`BACKEND_BASE_URL=${backendBaseUrl}`);
  console.log('');

  const results = [];
  for (const check of checks) {
    const result = await runCheck(check);
    results.push(result);
    const statusIcon = result.ok ? 'PASS' : 'FAIL';
    console.log(`${statusIcon} ${result.name} (${result.elapsedMs}ms): ${result.reason}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log('');

  if (failed.length > 0) {
    console.log(`Smoke check failed: ${failed.length} of ${results.length} checks failed.`);
    process.exit(1);
  }

  console.log(`Smoke check passed: ${results.length} of ${results.length} checks passed.`);
}

main().catch((error) => {
  console.error('Smoke check crashed:', error);
  process.exit(1);
});
