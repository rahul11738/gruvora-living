import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useInteractions } from '../context/InteractionContext';
import { debugAPI, videosAPI } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import {
  Heart,
  MessageCircle,
  Bookmark,
  Send,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Home,
  User,
  X,
  Plus,
  Upload,
  Camera,
  Check,
  Loader2,
  MoreHorizontal,
  Music,
  MapPin,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// ============ MAIN REELS PAGE ============
export const ReelsPage = () => {
  const { isAuthenticated, user } = useAuth();
  const isDev = process.env.NODE_ENV !== 'production';
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
  const [videos, setVideos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [activeVideo, setActiveVideo] = useState(null);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [debugStats, setDebugStats] = useState(null);
  const [hitRateHistory, setHitRateHistory] = useState([]);
  const [autoCapture, setAutoCapture] = useState(false);
  const [debugCaptureQueue, setDebugCaptureQueue] = useState([]);
  const [stressSessionId, setStressSessionId] = useState('session-local');
  const containerRef = useRef(null);
  const touchStartY = useRef(0);

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

useEffect(() => {
    fetchVideos();
    setIsMuted(false);
    return () => {
      setIsMuted(true);
    };
  }, []);
  const fetchVideos = async () => {
    try {
      const response = await videosAPI.getAll({ limit: 50 });
      const vids = response.data.videos || [];
      setVideos(vids);
      primeFromVideos(vids);

      if (isAuthenticated && vids.length) {
        const reelIds = vids.map((v) => v.id).filter(Boolean);
        const ownerIds = vids.map((v) => v.owner_id).filter(Boolean);
        await hydrateSnapshot({ ownerIds, reelIds });
      }
    } catch (error) {
      console.error('Failed to fetch videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowToggle = async (ownerId) => {
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
  };

  const handleLikeToggle = async (videoId) => {
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
  };

  // Touch handling for swipe
  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartY.current - touchEndY;
    
    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentIndex < videos.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else if (diff < 0 && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      }
    }
  };

  // Scroll handling
  const handleScroll = useCallback((e) => {
    const container = e.target;
    const scrollPosition = container.scrollTop;
    const itemHeight = container.clientHeight;
    const newIndex = Math.round(scrollPosition / itemHeight);
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < videos.length) {
      setCurrentIndex(newIndex);
    }
  }, [currentIndex, videos.length]);

  const scrollToVideo = (index) => {
    if (index >= 0 && index < videos.length) {
      containerRef.current?.scrollTo({
        top: index * containerRef.current.clientHeight,
        behavior: 'smooth',
      });
      setCurrentIndex(index);
    }
  };

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
  }, [currentIndex, videos.length, showComments]);

  const openComments = (video) => {
    setActiveVideo(video);
    setShowComments(true);
  };

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
          {isDev && interactionDebug && (
            <button
              onClick={() => setShowDebugPanel((prev) => !prev)}
              className="px-3 py-1.5 bg-black/60 text-white rounded-full text-xs font-semibold border border-white/30"
            >
              {showDebugPanel ? 'Hide Debug' : 'Show Debug'}
            </button>
          )}
        </div>
      </div>

      {isDev && showDebugPanel && interactionDebug && (
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
          className="h-full w-full overflow-y-scroll snap-y snap-mandatory hide-scrollbar"
          onScroll={handleScroll}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {videos.map((video, index) => (
            <ReelItem
              key={video.id}
              video={video}
              isActive={index === currentIndex}
              isAuthenticated={isAuthenticated}
              userId={user?.id}
              onOpenComments={() => openComments(video)}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted(prev => !prev)}
              liked={Boolean(likeMap[video.id]?.liked)}
              likeCount={likeMap[video.id]?.count ?? (typeof video.likes === 'number' ? video.likes : 0)}
              following={Boolean(followingMap[video.owner_id])}
              followPending={Boolean(pendingFollowMap[video.owner_id])}
              likePending={Boolean(pendingLikeMap[video.id])}
              onLike={() => handleLikeToggle(video.id)}
              onFollow={() => handleFollowToggle(video.owner_id)}
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
            onClose={() => setShowComments(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ============ SINGLE REEL ITEM - INSTAGRAM STYLE ============
const ReelItem = React.memo(({
  video,
  isActive,
  isAuthenticated,
  userId,
  onOpenComments,
  isMuted,
  onToggleMute,
  liked,
  likeCount,
  following,
  followPending,
  likePending,
  onLike,
  onFollow,
}) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [saved, setSaved] = useState(video.user_saved || false);
  const [shares, setShares] = useState(video.shares || 0);
  const [saveLoading, setSaveLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const [progress, setProgress] = useState(0);
  const lastTap = useRef(0);

 useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
      if (isActive) {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
        videosAPI.recordView(video.id).catch(() => {});
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
        setIsPlaying(false);
      }
    }
  }, [isActive, video.id, isMuted]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const progress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(progress);
    }
  };

  const togglePlay = () => {
    const now = Date.now();
    // Double tap detection
    if (now - lastTap.current < 300) {
      handleDoubleTap();
      return;
    }
    lastTap.current = now;

    setTimeout(() => {
      if (Date.now() - lastTap.current >= 280) {
        if (videoRef.current) {
          if (isPlaying) {
            videoRef.current.pause();
          } else {
            videoRef.current.play();
          }
          setIsPlaying(!isPlaying);
        }
      }
    }, 300);
  };

  const handleDoubleTap = () => {
    if (!liked) {
      handleLike();
    }
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 800);
  };

  const toggleMute = (e) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
    onToggleMute();
  };

  const handleLike = async () => {
    if (likePending) return;
    await onLike();
  };

  const handleSave = async () => {
    if (!isAuthenticated) {
      toast.error('Login to save');
      return;
    }
    if (saveLoading) return;

    const prevSaved = saved;
    setSaved(!prevSaved);
    setSaveLoading(true);

    try {
      if (prevSaved) {
        await videosAPI.unsave(video.id);
        toast.success('Removed from saved');
      } else {
        await videosAPI.save(video.id);
        toast.success('Saved to your collection');
      }
    } catch (error) {
      console.error('Save failed:', error);
      setSaved(prevSaved);
      toast.error('Failed to update saved state');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleFollow = async () => {
    if (video.owner_id === userId) return;
    if (followPending) return;
    await onFollow();
  };

  const handleShare = async () => {
    if (shareLoading) return;
    setShareLoading(true);

    const shareUrl = `${window.location.origin}/reels/${video.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: video.title,
          url: shareUrl,
        });
      } catch (error) {}
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied!');
    }

    try {
      const res = await videosAPI.share(video.id);
      if (typeof res?.data?.shares === 'number') {
        setShares(res.data.shares);
      } else {
        setShares((prev) => prev + 1);
      }
    } catch (error) {
      console.error('Share track failed:', error);
    } finally {
      setShareLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div className="h-full w-full snap-start relative bg-black" data-testid={`reel-${video.id}`}>
      {/* Video Progress Bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-white/20 z-30">
        <motion.div
          className="h-full bg-white"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Video */}
      <video
        ref={videoRef}
        src={video.video_url || video.url}
        poster={video.thumbnail_url}
        loop
        muted={isMuted}
        playsInline
        className="w-full h-full object-cover"
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onError={(e) => {
          console.error('Video load error:', video.id);
          e.target.style.display = 'none'; // broken video hide કરો
        }}
      />

      {/* Double Tap Heart Animation */}
      <AnimatePresence>
        {showHeart && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
          >
            <Heart className="w-28 h-28 text-white fill-red-500 drop-shadow-lg" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Paused Overlay */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-20 h-20 bg-black/40 rounded-full flex items-center justify-center">
            <Play className="w-10 h-10 text-white ml-1" />
          </div>
        </div>
      )}

      {/* Right Side Actions - Instagram Style */}
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5 z-20">
        {/* Owner Profile */}
        <div className="relative mb-2">
          <Link to={`/owner/${video.owner_id}`}>
            <div className="w-12 h-12 rounded-full border-2 border-white overflow-hidden bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 p-[2px]">
              <div className="w-full h-full rounded-full bg-black overflow-hidden">
                {video.owner_image ? (
                  <img src={video.owner_image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                )}
              </div>
            </div>
          </Link>
          {!following && video.owner_id !== userId && (
            <button
              onClick={handleFollow}
              disabled={followPending}
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center border-2 border-black disabled:opacity-60"
              data-testid="follow-btn"
            >
              <Plus className="w-3 h-3 text-white" />
            </button>
          )}
        </div>

        {/* Like */}
        <button onClick={handleLike} disabled={likePending} className="flex flex-col items-center disabled:opacity-60" data-testid="like-btn">
          <motion.div whileTap={{ scale: 0.9 }}>
            <Heart className={`w-8 h-8 ${liked ? 'text-red-500 fill-red-500' : 'text-white'}`} />
          </motion.div>
          <span className="text-white text-xs mt-1 font-semibold">{formatNumber(likeCount)}</span>
        </button>

        {/* Comment */}
        <button onClick={onOpenComments} className="flex flex-col items-center" data-testid="comment-btn">
          <MessageCircle className="w-8 h-8 text-white" />
          <span className="text-white text-xs mt-1 font-semibold">{formatNumber(video.comments_count || 0)}</span>
        </button>

        {/* Share */}
        <button onClick={handleShare} disabled={shareLoading} className="flex flex-col items-center disabled:opacity-60" data-testid="share-btn">
          <Send className="w-7 h-7 text-white transform rotate-12" />
          <span className="text-white text-xs mt-1 font-semibold">{formatNumber(shares)}</span>
        </button>

        {/* Save */}
        <button onClick={handleSave} disabled={saveLoading} className="flex flex-col items-center disabled:opacity-60" data-testid="save-btn">
          <motion.div whileTap={{ scale: 0.9 }}>
            <Bookmark className={`w-8 h-8 ${saved ? 'text-white fill-white' : 'text-white'}`} />
          </motion.div>
        </button>

        {/* Music/Sound */}
        <button onClick={toggleMute} className="relative">
          <div className="w-10 h-10 rounded-lg border border-white/50 overflow-hidden bg-gradient-to-br from-gray-800 to-gray-600 flex items-center justify-center">
            {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
          </div>
        </button>
      </div>

      {/* Bottom Info - Instagram Style */}
      <div className="absolute left-3 right-16 bottom-6 z-20">
        {/* Owner Info */}
        <Link to={`/owner/${video.owner_id}`} className="flex items-center gap-2 mb-2">
          <span className="text-white font-bold text-sm">
            {video.owner_name || 'Owner'}
          </span>
          {following && <Check className="w-4 h-4 text-blue-400" />}
          {!following && video.owner_id !== userId && (
            <button
              onClick={(e) => { e.preventDefault(); handleFollow(); }}
              disabled={followPending}
              className="px-2 py-0.5 border border-white rounded text-white text-xs font-semibold ml-2 disabled:opacity-60"
            >
              Follow
            </button>
          )}
        </Link>

        {/* Caption */}
        <p className="text-white text-sm mb-2 line-clamp-2">{video.description || video.title}</p>

        {/* Hashtags */}
        {video.hashtags && (
          <p className="text-white/80 text-xs mb-2">
            {video.hashtags.split(',').map(tag => `#${tag.trim()}`).join(' ')}
          </p>
        )}

        {/* Location */}
        {video.location && (
          <div className="flex items-center gap-1 text-white/70 text-xs mb-2">
            <MapPin className="w-3 h-3" />
            <span>{video.location}</span>
          </div>
        )}

        {/* Property Link */}
        {video.listing_id && (
          <Link
            to={`/listing/${video.listing_id}`}
            className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full text-white text-xs font-medium"
          >
            <Home className="w-3 h-3" />
            View Property
          </Link>
        )}

        {/* Audio Track (Fake) */}
        <div className="flex items-center gap-2 mt-3">
          <Music className="w-3 h-3 text-white/70" />
          <div className="flex-1 overflow-hidden">
            <motion.p
              animate={{ x: [0, -200, 0] }}
              transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
              className="text-white/70 text-xs whitespace-nowrap"
            >
              Original audio - {video.owner_name || 'GharSetu'}
            </motion.p>
          </div>
        </div>
      </div>

      {/* Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />
    </div>
  );
});

// ============ COMMENTS MODAL ============
const CommentsModal = ({ video, onClose }) => {
  const { isAuthenticated, user, token } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    fetchComments();
  }, [video.id]);

  const fetchComments = async () => {
    try {
      const response = await fetch(`${API_URL}/api/videos/${video.id}/comments`);
      const data = await response.json();
      setComments(data.comments || []);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !isAuthenticated) return;

    setSending(true);
    try {
      await fetch(`${API_URL}/api/videos/${video.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ comment: newComment.trim() })
      });
      setNewComment('');
      fetchComments();
    } catch (error) {
      toast.error('Failed to post comment');
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25 }}
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[70vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b text-center relative">
          <h3 className="font-bold">Comments</h3>
          <button onClick={onClose} className="absolute right-4 top-4">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No comments yet. Be the first!</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-gray-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm">
                    <span className="font-semibold">{comment.user_name}</span>
                    {' '}{comment.comment}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(comment.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button className="p-1">
                  <Heart className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t flex items-center gap-3 bg-white">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-gray-500" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder={isAuthenticated ? "Add a comment..." : "Login to comment"}
            disabled={!isAuthenticated || sending}
            className="flex-1 bg-transparent outline-none text-sm"
          />
          <button
            type="submit"
            disabled={!newComment.trim() || sending}
            className="text-blue-500 font-semibold text-sm disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
};

// ============ REEL UPLOAD MODAL ============
const ReelUploadModal = ({ onClose, onSuccess }) => {
  const { token } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('home');
  const [hashtags, setHashtags] = useState('');
  const [location, setLocation] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 100 * 1024 * 1024) {
        toast.error('Video must be less than 100MB');
        return;
      }
      if (!file.type.startsWith('video/')) {
        toast.error('Please select a video file');
        return;
      }
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
    }
  };

  const handleUpload = async () => {
    if (!title || !videoFile) {
      toast.error('Title and video are required');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('category', category);
      formData.append('hashtags', hashtags);
      formData.append('location', location);
      formData.append('video', videoFile);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 5, 95));
      }, 300);

      const response = await fetch(`${API_URL}/api/videos/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (response.ok) {
        toast.success('Reel uploaded successfully!');
        setTimeout(onSuccess, 500);
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <button onClick={onClose} className="text-white">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-white font-bold">New Reel</h2>
        <button
          onClick={handleUpload}
          disabled={uploading || !title || !videoFile}
          className="text-blue-500 font-semibold disabled:opacity-50"
        >
          {uploading ? 'Posting...' : 'Share'}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex gap-4 mb-6">
          {/* Video Preview */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="w-32 h-48 bg-gray-800 rounded-xl flex items-center justify-center cursor-pointer overflow-hidden flex-shrink-0"
          >
            {videoPreview ? (
              <video src={videoPreview} className="w-full h-full object-cover" />
            ) : (
              <div className="text-center text-gray-500">
                <Camera className="w-8 h-8 mx-auto mb-1" />
                <span className="text-xs">Add Video</span>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Caption */}
          <div className="flex-1">
            <Textarea
              placeholder="Write a caption..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="bg-transparent border-0 text-white resize-none p-0 text-sm h-full"
              maxLength={2200}
            />
          </div>
        </div>

        {/* Title */}
        <div className="mb-4">
          <Input
            placeholder="Title *"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="bg-gray-800 border-0 text-white"
          />
        </div>

        {/* Category */}
        <div className="mb-4">
          <p className="text-gray-400 text-xs mb-2">Category</p>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'home', label: 'Property Sale' },
              { id: 'business', label: 'Property Rent' },
              { id: 'services', label: 'Interior Service' },
              { id: 'event', label: 'Construction' },
              { id: 'stay', label: 'Architecture' },
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                  category === cat.id ? 'bg-white text-black' : 'bg-gray-800 text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Hashtags */}
        <div className="mb-4">
          <Input
            placeholder="Add hashtags (comma separated)"
            value={hashtags}
            onChange={e => setHashtags(e.target.value)}
            className="bg-gray-800 border-0 text-white"
          />
        </div>

        {/* Location */}
        <div className="mb-4">
          <div className="flex items-center gap-2 bg-gray-800 rounded-md px-3 py-2">
            <MapPin className="w-4 h-4 text-gray-400" />
            <input
              placeholder="Add location"
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="bg-transparent border-0 text-white text-sm flex-1 outline-none"
            />
          </div>
        </div>

        {/* Upload Progress */}
        {uploading && (
          <div className="mt-4">
            <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${uploadProgress}%` }}
                className="h-full bg-blue-500"
              />
            </div>
            <p className="text-gray-400 text-xs text-center mt-2">{uploadProgress}%</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ReelsPage;
