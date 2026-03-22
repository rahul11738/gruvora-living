import React from 'react';

const ReelsDebugPanel = ({
  autoCapture,
  setAutoCapture,
  captureDebugSnapshot,
  exportDebugStats,
  exportDebugCaptureQueue,
  copyDebugSummary,
  persistDebugSession,
  onReset,
  debugCaptureQueue,
  maxCaptureItems,
  stressSessionId,
  setStressSessionId,
  cacheRateTone,
  cacheHitRate,
  staleTone,
  staleSkips,
  hitRateHistory,
  sparklinePoints,
  debugStats,
}) => {
  return (
    <div className="absolute top-16 right-3 z-50 w-72 bg-black/80 border border-white/20 rounded-xl p-3 text-white text-xs space-y-2 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <p className="font-semibold">Interaction Debug</p>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setAutoCapture((prev) => !prev)}
            className="px-2 py-1 rounded bg-white/10 hover:bg-white/20"
          >
            {autoCapture ? 'Stop Auto' : 'Auto 60s'}
          </button>
          <button
            onClick={captureDebugSnapshot}
            className="px-2 py-1 rounded bg-white/10 hover:bg-white/20"
          >
            Capture
          </button>
          <button
            onClick={exportDebugStats}
            className="px-2 py-1 rounded bg-white/10 hover:bg-white/20"
          >
            Export
          </button>
          <button
            onClick={exportDebugCaptureQueue}
            disabled={debugCaptureQueue.length === 0}
            className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 disabled:opacity-40"
          >
            Export Q
          </button>
          <button
            onClick={copyDebugSummary}
            className="px-2 py-1 rounded bg-white/10 hover:bg-white/20"
          >
            Copy
          </button>
          <button
            onClick={persistDebugSession}
            className="px-2 py-1 rounded bg-white/10 hover:bg-white/20"
          >
            Save API
          </button>
          <button
            onClick={onReset}
            className="px-2 py-1 rounded bg-white/10 hover:bg-white/20"
          >
            Reset
          </button>
        </div>
      </div>
      <p className="text-[10px] text-white/70">
        captures: {debugCaptureQueue.length}/{maxCaptureItems} {autoCapture ? '(auto on)' : ''}
      </p>
      <div className="rounded-lg bg-white/5 border border-white/10 p-2 space-y-1">
        <p className="text-[10px] text-white/70">Stress Session ID</p>
        <input
          value={stressSessionId}
          onChange={(e) => setStressSessionId(e.target.value)}
          className="w-full h-7 px-2 rounded bg-black/30 border border-white/15 text-white text-[11px] outline-none"
          placeholder="session id"
        />
      </div>
      <div className="rounded-lg bg-white/5 border border-white/10 p-2 space-y-1">
        <div className="flex items-center justify-between">
          <span>Cache Hit Rate</span>
          <span className={`font-semibold ${cacheRateTone}`}>{cacheHitRate}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Stale Snapshot Skips</span>
          <span className={`font-semibold ${staleTone}`}>{staleSkips}</span>
        </div>
        <div className="pt-1">
          <p className="text-[10px] text-white/70 mb-1">Hit-rate trend (last {hitRateHistory.length || 0}s)</p>
          <div className="w-full h-10 rounded bg-black/30 border border-white/10 p-1">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
              <polyline
                points={sparklinePoints}
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                className={cacheRateTone}
              />
            </svg>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-y-1 gap-x-3">
        <span>snapshotCalls</span><span className="text-right">{debugStats?.snapshotCalls ?? 0}</span>
        <span>cacheHits</span><span className="text-right">{debugStats?.snapshotCacheHits ?? 0}</span>
        <span>cacheMisses</span><span className="text-right">{debugStats?.snapshotCacheMisses ?? 0}</span>
        <span>inFlightJoins</span><span className="text-right">{debugStats?.snapshotInFlightJoins ?? 0}</span>
        <span>requests</span><span className="text-right">{debugStats?.snapshotRequests ?? 0}</span>
        <span>cacheWrites</span><span className="text-right">{debugStats?.snapshotCacheWrites ?? 0}</span>
        <span>staleSkips</span><span className="text-right">{debugStats?.snapshotStaleSkips ?? 0}</span>
        <span>invalidations</span><span className="text-right">{debugStats?.cacheInvalidations ?? 0}</span>
        <span>followToggles</span><span className="text-right">{debugStats?.followToggles ?? 0}</span>
        <span>likeToggles</span><span className="text-right">{debugStats?.likeToggles ?? 0}</span>
      </div>
    </div>
  );
};

export default ReelsDebugPanel;
