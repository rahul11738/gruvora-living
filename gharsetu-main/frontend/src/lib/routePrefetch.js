const prefetchedChunks = new Set();

const canPrefetchOnCurrentNetwork = () => {
  if (typeof navigator === 'undefined') {
    return true;
  }

  const connection =
    navigator.connection ||
    navigator.mozConnection ||
    navigator.webkitConnection;

  if (!connection) {
    return true;
  }

  if (connection.saveData) {
    return false;
  }

  const type = String(connection.effectiveType || '').toLowerCase();
  return type !== 'slow-2g' && type !== '2g';
};

const prefetchChunk = (key, loader) => {
  if (!canPrefetchOnCurrentNetwork()) {
    return;
  }

  if (prefetchedChunks.has(key)) {
    return;
  }

  prefetchedChunks.add(key);
  loader().catch(() => {
    // Allow retry if prefetch fails due to transient network issues.
    prefetchedChunks.delete(key);
  });
};

export const prefetchDiscoverRoute = () => {
  prefetchChunk("discover-route", () => import("../components/DiscoverSearchPage"));
};

export const prefetchReelsRoute = () => {
  prefetchChunk("reels-route", () => import("../components/ReelsPage"));
};

export const observeRoutePrefetch = (element, prefetch, rootMargin = '180px') => {
  if (!element || typeof prefetch !== 'function') {
    return () => {};
  }

  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    return () => {};
  }

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        prefetch();
        observer.disconnect();
      }
    },
    { rootMargin },
  );

  observer.observe(element);
  return () => observer.disconnect();
};