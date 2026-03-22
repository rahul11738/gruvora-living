import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useInteractions } from '../context/InteractionContext';
import { debugAPI } from '../lib/api';
import { Button } from './ui/button';
import ReelCard from './reels/ReelCard';
import CommentsModal from './reels/CommentsModal';
import ReelUploadModal from './reels/ReelUploadModal';
import useReelsFeed from './reels/useReelsFeed';
import { toast } from 'sonner';
import {
  Plus,
  Camera,
  Loader2,
  ChevronLeft,
} from 'lucide-react';
import { Link } from 'react-router-dom';

// ============ MAIN REELS PAGE ============
export const ReelsPage = () => {
  const { isAuthenticated, user } = useAuth();
  const isDev = process.env.NODE_ENV === 'development';
  const debugEnabled = isDev && process.env.REACT_APP_ENABLE_REELS_DEBUG === 'true';
  const DEBUG_CAPTURE_INTERVAL_MS = 60000;
  const DEBUG_CAPTURE_MAX_ITEMS = 20;
  const {
    followingMap,
    likeMap,
    pendingFollowMap,
    pendingLikeMap,
    primeFromVideos,
    hydrateSnapshot,
    toggleFollow,
    toggleLike,
    interactionDebug,
  } = useInteractions();
  const [showUpload, setShowUpload] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [activeVideo, setActiveVideo] = useState(null);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [debugStats, setDebugStats] = useState(null);
  const [hitRateHistory, setHitRateHistory] = useState([]);
  const [autoCapture, setAutoCapture] = useState(false);
  const [debugCaptureQueue, setDebugCaptureQueue] = useState([]);
  const [stressSessionId, setStressSessionId] = useState('session-local');

  const {
    videos,
    currentIndex,
    loading,
    isMuted,
    commentCountMap,
    containerRef,
    fetchVideos,
    setIsMuted,
    setCommentCountMap,
    handleTouchStart,
    handleTouchEnd,
    handleScroll,
    scrollToVideo,
  } = useReelsFeed({ isAuthenticated, primeFromVideos, hydrateSnapshot });

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

  const handleFollowToggle = useCallback(async (ownerId) => {
    if (!isAuthenticated) {
      toast.error('Login to follow');
      return;
    }
    if (!ownerId || ownerId === user?.id) return;
    try {
      const result = await toggleFollow(ownerId);
      if (result.ok) {
        toast.success(result.following ? 'Following' : 'Unfollowed');
      }
    } catch (error) {
      toast.error('Failed to update follow status');
    }
  }, [isAuthenticated, toggleFollow, user?.id]);

  const handleLikeToggle = useCallback(async (videoId) => {
    if (!isAuthenticated) {
      toast.error('Login to like');
      return;
    }
    try {
      const currentCount = likeMap[videoId]?.count ?? videos.find((v) => v.id === videoId)?.likes ?? 0;
      await toggleLike(videoId, currentCount);
    } catch (error) {
      toast.error('Failed to update like');
    }
  }, [isAuthenticated, likeMap, toggleLike, videos]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showComments) return;
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        scrollToVideo(currentIndex - 1);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        scrollToVideo(currentIndex + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, scrollToVideo, showComments]);

  const openComments = useCallback((video) => {
    setActiveVideo(video);
    setShowComments(true);
  }, []);

  const handleCommentCreated = useCallback((videoId, delta = 1, serverCount = null) => {
    if (!videoId) return;
    setCommentCountMap((prev) => {
      const current = typeof prev[videoId] === 'number' ? prev[videoId] : 0;
      const nextCount = typeof serverCount === 'number'
        ? serverCount
        : Math.max(0, current + delta);
      return { ...prev, [videoId]: nextCount };
    });
    setActiveVideo((prev) => {
      if (!prev || prev.id !== videoId) return prev;
      const current = typeof prev.comments_count === 'number' ? prev.comments_count : 0;
      const nextCount = typeof serverCount === 'number'
        ? serverCount
        : Math.max(0, current + delta);
      return { ...prev, comments_count: nextCount };
    });
  }, [setCommentCountMap]);

  const buildDebugPayload = useCallback(() => ({
      exported_at: new Date().toISOString(),
      page: 'reels',
      stress_session_id: stressSessionId,
      stats: debugStats || {},
      hit_rate_history: hitRateHistory,
    }), [debugStats, hitRateHistory, stressSessionId]);

  const sanitizeFilePart = (value) => {
    const safe = (value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
    return safe || 'session-local';
  };

  const downloadJson = (payload, filenamePrefix) => {
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
  };

  const exportDebugStats = () => {
    const payload = buildDebugPayload();
    downloadJson(payload, 'reels-interaction-debug');
  };

  const captureDebugSnapshot = useCallback(() => {
    const payload = buildDebugPayload();
    setDebugCaptureQueue((prev) => {
      const next = [...prev, payload];
      return next.slice(-DEBUG_CAPTURE_MAX_ITEMS);
    });
  }, [buildDebugPayload, DEBUG_CAPTURE_MAX_ITEMS]);

  const exportDebugCaptureQueue = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      page: 'reels',
      stress_session_id: stressSessionId,
      total_captures: debugCaptureQueue.length,
      captures: debugCaptureQueue,
    };
    downloadJson(payload, 'reels-interaction-debug-queue');
  };

  const persistDebugSession = async () => {
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
  };

  const copyDebugSummary = async () => {
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
  };

  useEffect(() => {
    if (!isDev || !showDebugPanel || !autoCapture) return;
    const id = window.setInterval(() => {
      captureDebugSnapshot();
    }, DEBUG_CAPTURE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [autoCapture, isDev, showDebugPanel, captureDebugSnapshot]);

  const cacheSamples = (debugStats?.snapshotCacheHits || 0) + (debugStats?.snapshotCacheMisses || 0);
  const cacheHitRate = cacheSamples > 0
    ? Math.round(((debugStats?.snapshotCacheHits || 0) / cacheSamples) * 100)
    : 0;
  const cacheRateTone = cacheHitRate >= 60 ? 'text-emerald-300' : cacheHitRate >= 30 ? 'text-amber-300' : 'text-rose-300';
  const staleSkips = debugStats?.snapshotStaleSkips || 0;
  const staleTone = staleSkips === 0 ? 'text-emerald-300' : staleSkips <= 3 ? 'text-amber-300' : 'text-rose-300';

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

  const sparklinePoints = hitRateHistory.length > 1
    ? hitRateHistory
        .map((v, i) => {
          const x = (i / (hitRateHistory.length - 1)) * 100;
          const y = 100 - v;
          return `${x},${y}`;
        })
        .join(' ')
    : '';

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-white animate-spin mx-auto mb-3" />
          <p className="text-white text-sm">Loading Reels...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50" data-testid="reels-page">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-40 p-3 flex items-center justify-between">
        <Link to="/" className="text-white font-bold text-lg flex items-center gap-2">
          <ChevronLeft className="w-6 h-6" />
          <span>Reels</span>
        </Link>
        
        <div className="flex items-center gap-3">
          {isAuthenticated && (
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full text-black text-sm font-semibold"
              data-testid="upload-reel-btn"
            >
              <Camera className="w-4 h-4" />
              Create
            </button>
          )}
          {debugEnabled && interactionDebug && (
            <button
              onClick={() => setShowDebugPanel((prev) => !prev)}
              className="px-3 py-1.5 bg-black/60 text-white rounded-full text-xs font-semibold border border-white/30"
            >
              {showDebugPanel ? 'Hide Debug' : 'Show Debug'}
            </button>
          )}
        </div>
      </div>

      {debugEnabled && showDebugPanel && interactionDebug && (
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
                onClick={() => {
                  interactionDebug.reset?.();
                  setDebugStats(interactionDebug.getStats?.() || null);
                  setHitRateHistory([]);
                  setDebugCaptureQueue([]);
                }}
                className="px-2 py-1 rounded bg-white/10 hover:bg-white/20"
              >
                Reset
              </button>
            </div>
          </div>
          <p className="text-[10px] text-white/70">
            captures: {debugCaptureQueue.length}/{DEBUG_CAPTURE_MAX_ITEMS} {autoCapture ? '(auto on)' : ''}
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
      )}

      {/* Videos Container */}
      {videos.length > 0 ? (
        <div
          ref={containerRef}
          className="h-full w-full overflow-y-scroll scroll-smooth snap-y snap-mandatory hide-scrollbar overscroll-y-contain"
          onScroll={handleScroll}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {videos.map((video, index) => (
            <ReelCard
              key={video.id}
              video={video}
              videoId={video.id}
              ownerId={video.owner_id}
              isActive={index === currentIndex}
              shouldLoad={Math.abs(index - currentIndex) <= 2}
              isAuthenticated={isAuthenticated}
              userId={user?.id}
              onOpenComments={openComments}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted(prev => !prev)}
              liked={Boolean(likeMap[video.id]?.liked)}
              likeCount={likeMap[video.id]?.count ?? (typeof video.likes === 'number' ? video.likes : 0)}
              commentCount={commentCountMap[video.id] ?? (typeof video.comments_count === 'number' ? video.comments_count : 0)}
              following={Boolean(followingMap[video.owner_id])}
              followPending={Boolean(pendingFollowMap[video.owner_id])}
              likePending={Boolean(pendingLikeMap[video.id])}
              onLike={handleLikeToggle}
              onFollow={handleFollowToggle}
            />
          ))}
        </div>
      ) : (
        <div className="h-full flex items-center justify-center">
          <div className="text-center text-white p-6">
            <Camera className="w-20 h-20 mx-auto mb-4 opacity-40" />
            <h3 className="text-xl font-bold mb-2">No Reels Yet</h3>
            <p className="text-white/60 mb-6 text-sm">Be the first to share a property reel!</p>
            {isAuthenticated && (
              <Button onClick={() => setShowUpload(true)} className="bg-white text-black hover:bg-gray-100">
                <Plus className="w-4 h-4 mr-2" />
                Create Reel
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Upload Modal */}
      <AnimatePresence>
        {showUpload && (
          <ReelUploadModal
            onClose={() => setShowUpload(false)}
            onSuccess={() => {
              setShowUpload(false);
              fetchVideos();
            }}
          />
        )}
      </AnimatePresence>

      {/* Comments Modal */}
      <AnimatePresence>
        {showComments && activeVideo && (
          <CommentsModal
            video={activeVideo}
            onCommentCreated={handleCommentCreated}
            onClose={() => setShowComments(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ReelsPage;
