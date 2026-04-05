import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { debugAPI } from '../../lib/api';

const DEBUG_CAPTURE_INTERVAL_MS = 60000;
const DEBUG_CAPTURE_MAX_ITEMS = 20;

const sanitizeFilePart = (value) => {
  const safe = (value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  return safe || 'session-local';
};

export const useReelsDebug = ({ isDev, interactionDebug }) => {
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [debugStats, setDebugStats] = useState(null);
  const [hitRateHistory, setHitRateHistory] = useState([]);
  const [autoCapture, setAutoCapture] = useState(false);
  const [debugCaptureQueue, setDebugCaptureQueue] = useState([]);
  const [stressSessionId, setStressSessionId] = useState('session-local');

  useEffect(() => {
    if (!isDev || typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('reels_debug_session_id');
    if (stored) {
      setStressSessionId(stored);
    }
  }, [isDev]);

  useEffect(() => {
    if (!isDev || typeof window === 'undefined') return;
    window.localStorage.setItem('reels_debug_session_id', stressSessionId || 'session-local');
  }, [isDev, stressSessionId]);

  const buildDebugPayload = useCallback(
    () => ({
      exported_at: new Date().toISOString(),
      page: 'reels',
      stress_session_id: stressSessionId,
      stats: debugStats || {},
      hit_rate_history: hitRateHistory,
    }),
    [debugStats, hitRateHistory, stressSessionId],
  );

  const downloadJson = useCallback((payload, filenamePrefix) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `${filenamePrefix}-${sanitizeFilePart(stressSessionId)}-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, [stressSessionId]);

  const exportDebugStats = useCallback(() => {
    const payload = buildDebugPayload();
    downloadJson(payload, 'reels-interaction-debug');
  }, [buildDebugPayload, downloadJson]);

  const captureDebugSnapshot = useCallback(() => {
    const payload = buildDebugPayload();
    setDebugCaptureQueue((prev) => {
      const next = [...prev, payload];
      return next.slice(-DEBUG_CAPTURE_MAX_ITEMS);
    });
  }, [buildDebugPayload]);

  const exportDebugCaptureQueue = useCallback(() => {
    const payload = {
      exported_at: new Date().toISOString(),
      page: 'reels',
      stress_session_id: stressSessionId,
      total_captures: debugCaptureQueue.length,
      captures: debugCaptureQueue,
    };
    downloadJson(payload, 'reels-interaction-debug-queue');
  }, [debugCaptureQueue, downloadJson, stressSessionId]);

  const persistDebugSession = useCallback(async () => {
    const payload = {
      stress_session_id: stressSessionId,
      stats: debugStats || {},
      hit_rate_history: hitRateHistory,
      total_captures: debugCaptureQueue.length,
      captures: debugCaptureQueue,
    };

    try {
      const response = await debugAPI.saveReelsSession(payload);
      toast.success(`Debug session saved (${response?.data?.report_id || 'ok'})`);
    } catch (error) {
      toast.error('Failed to persist debug session');
    }
  }, [debugCaptureQueue, debugStats, hitRateHistory, stressSessionId]);

  const cacheSamples = (debugStats?.snapshotCacheHits || 0) + (debugStats?.snapshotCacheMisses || 0);
  const cacheHitRate = cacheSamples > 0
    ? Math.round(((debugStats?.snapshotCacheHits || 0) / cacheSamples) * 100)
    : 0;

  const copyDebugSummary = useCallback(async () => {
    const summary = [
      `session=${stressSessionId || 'session-local'}`,
      `hitRate=${cacheHitRate}%`,
      `calls=${debugStats?.snapshotCalls ?? 0}`,
      `hits=${debugStats?.snapshotCacheHits ?? 0}`,
      `misses=${debugStats?.snapshotCacheMisses ?? 0}`,
      `inFlightJoins=${debugStats?.snapshotInFlightJoins ?? 0}`,
      `staleSkips=${debugStats?.snapshotStaleSkips ?? 0}`,
      `invalidations=${debugStats?.cacheInvalidations ?? 0}`,
      `followToggles=${debugStats?.followToggles ?? 0}`,
      `likeToggles=${debugStats?.likeToggles ?? 0}`,
      `captures=${debugCaptureQueue.length}/${DEBUG_CAPTURE_MAX_ITEMS}`,
    ].join(' | ');

    try {
      await navigator.clipboard.writeText(summary);
      toast.success('Debug summary copied');
    } catch (error) {
      toast.error('Failed to copy summary');
    }
  }, [cacheHitRate, debugCaptureQueue.length, debugStats, stressSessionId]);

  const resetLocalDebugState = useCallback(() => {
    setDebugStats(interactionDebug?.getStats?.() || null);
    setHitRateHistory([]);
    setDebugCaptureQueue([]);
  }, [interactionDebug]);

  useEffect(() => {
    if (!isDev || !showDebugPanel || !autoCapture) return;
    const id = window.setInterval(() => {
      captureDebugSnapshot();
    }, DEBUG_CAPTURE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [autoCapture, captureDebugSnapshot, isDev, showDebugPanel]);

  useEffect(() => {
    if (!isDev || !showDebugPanel || !interactionDebug?.getStats) return;

    const updateStats = () => {
      const stats = interactionDebug.getStats();
      setDebugStats(stats);

      const samples = (stats?.snapshotCacheHits || 0) + (stats?.snapshotCacheMisses || 0);
      const rate = samples > 0 ? Math.round(((stats?.snapshotCacheHits || 0) / samples) * 100) : 0;
      setHitRateHistory((prev) => {
        const next = [...prev, rate];
        return next.slice(-30);
      });
    };

    updateStats();
    const id = window.setInterval(updateStats, 1000);
    return () => window.clearInterval(id);
  }, [interactionDebug, isDev, showDebugPanel]);

  useEffect(() => {
    if (showDebugPanel) return;
    setHitRateHistory([]);
  }, [showDebugPanel]);

  const sparklinePoints = useMemo(() => {
    if (hitRateHistory.length <= 1) return '';
    return hitRateHistory
      .map((v, i) => {
        const x = (i / (hitRateHistory.length - 1)) * 100;
        const y = 100 - v;
        return `${x},${y}`;
      })
      .join(' ');
  }, [hitRateHistory]);

  const cacheRateTone = cacheHitRate >= 60 ? 'text-emerald-300' : cacheHitRate >= 30 ? 'text-amber-300' : 'text-rose-300';
  const staleSkips = debugStats?.snapshotStaleSkips || 0;
  const staleTone = staleSkips === 0 ? 'text-emerald-300' : staleSkips <= 3 ? 'text-amber-300' : 'text-rose-300';

  return {
    showDebugPanel,
    setShowDebugPanel,
    debugStats,
    hitRateHistory,
    autoCapture,
    setAutoCapture,
    debugCaptureQueue,
    stressSessionId,
    setStressSessionId,
    cacheHitRate,
    cacheRateTone,
    staleSkips,
    staleTone,
    sparklinePoints,
    captureDebugSnapshot,
    exportDebugStats,
    exportDebugCaptureQueue,
    persistDebugSession,
    copyDebugSummary,
    resetLocalDebugState,
    maxCaptureItems: DEBUG_CAPTURE_MAX_ITEMS,
  };
};

export default useReelsDebug;
