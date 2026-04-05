const ROUTE_INTENT_KEY = 'gharsetu:route-intent';
const ROUTE_METRICS_KEY = '__GHARSETU_ROUTE_METRICS__';

const now = () => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
};

export const markRouteNavigation = (route, source = 'unknown') => {
  if (typeof window === 'undefined') {
    return;
  }

  const payload = {
    route,
    source,
    startedAt: now(),
    timestamp: Date.now(),
  };

  window.sessionStorage.setItem(ROUTE_INTENT_KEY, JSON.stringify(payload));
};

export const consumeRouteNavigationMetric = (route) => {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.sessionStorage.getItem(ROUTE_INTENT_KEY);
  if (!raw) {
    return null;
  }

  let intent;
  try {
    intent = JSON.parse(raw);
  } catch {
    window.sessionStorage.removeItem(ROUTE_INTENT_KEY);
    return null;
  }

  if (!intent || intent.route !== route) {
    return null;
  }

  window.sessionStorage.removeItem(ROUTE_INTENT_KEY);

  return {
    route,
    source: intent.source || 'unknown',
    durationMs: Math.max(0, Math.round(now() - Number(intent.startedAt || 0))),
    timestamp: Date.now(),
  };
};

export const publishRouteNavigationMetric = (metric) => {
  if (!metric || typeof window === 'undefined') {
    return;
  }

  const existing = Array.isArray(window[ROUTE_METRICS_KEY]) ? window[ROUTE_METRICS_KEY] : [];
  window[ROUTE_METRICS_KEY] = [...existing.slice(-29), metric];

  if (typeof window.dispatchEvent === 'function' && typeof window.CustomEvent === 'function') {
    window.dispatchEvent(new window.CustomEvent('gharsetu:route-transition', { detail: metric }));
  }

  // Keep observable in production without introducing backend dependencies.
  console.info('[route-transition]', metric);
};