import React, { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useInteractions } from '../context/InteractionContext';
import { Button } from './ui/button';
import ReelCard from './reels/ReelCard';
import CommentsModal from './reels/CommentsModal';
import ReelUploadModal from './reels/ReelUploadModal';
import useReelsFeed from './reels/useReelsFeed';
import useReelsDebug from './reels/useReelsDebug';
import ReelsDebugPanel from './reels/ReelsDebugPanel';
import { consumeRouteNavigationMetric, publishRouteNavigationMetric } from '../lib/routeTelemetry';
import { toast } from 'sonner';
import {
  Plus,
  Camera,
  Loader2,
  ChevronLeft,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../lib/api';

const normalizeSocketBaseUrl = (rawUrl) => {
  const base = String(rawUrl || '').trim();
  if (!base) return '';
  return base
    .replace(/\/api\/?$/i, '')
    .replace(/\/+$/, '')
    .replace('://localhost', '://127.0.0.1');
};

const resolveBackendUrl = () => {
  const clientBase = String(api?.defaults?.baseURL || '').trim();
  if (clientBase) return clientBase.replace(/\/api\/?$/i, '');
  if (process.env.REACT_APP_BACKEND_URL) return process.env.REACT_APP_BACKEND_URL;
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem('gharsetu_backend_url');
    if (stored) return stored;
  }
  return 'http://127.0.0.1:8000';
};

const SOCKET_API_URL = normalizeSocketBaseUrl(resolveBackendUrl());

// ============ MAIN REELS PAGE ============
export const ReelsPage = () => {
  const [searchParams] = useSearchParams();
  const preferredListingId = searchParams.get('listingId') || '';
  const { isAuthenticated, isOwner, isAdmin, user, token } = useAuth();
  const canCreateReel = isAuthenticated && (isOwner || isAdmin);
  const isDev = process.env.NODE_ENV === 'development';
  const debugEnabled = isDev && process.env.REACT_APP_ENABLE_REELS_DEBUG === 'true';
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

  useEffect(() => {
    const metric = consumeRouteNavigationMetric('/reels');
    if (metric) {
      publishRouteNavigationMetric(metric);
    }
  }, []);

  const {
    videos,
    currentIndex,
    loading,
    loadingMore,
    hasMore,
    isMuted,
    commentCountMap,
    containerRef,
    fetchVideos,
    removeVideo,
    patchVideo,
    setIsMuted,
    setCommentCountMap,
    setCurrentIndex,
    handleTouchStart,
    handleTouchEnd,
    handleScroll,
    scrollToVideo,
  } = useReelsFeed({ isAuthenticated, primeFromVideos, hydrateSnapshot, preferredListingId });

  useEffect(() => {
    const root = containerRef.current;
    if (!root || !videos.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.dataset.index);
            if (Number.isFinite(index)) {
              setCurrentIndex(index);
            }
          }
        });
      },
      { root, threshold: 0.7 }
    );

    const elements = root.querySelectorAll('.reel-item');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [containerRef, setCurrentIndex, videos.length]);

  const {
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
    maxCaptureItems,
  } = useReelsDebug({ isDev, interactionDebug });

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

  const handleReelHidden = useCallback((videoId, hidden) => {
    patchVideo(videoId, { hidden, visibility: hidden ? 'hidden' : 'public' });
  }, [patchVideo]);

  const handleReelDeleted = useCallback((videoId) => {
    removeVideo(videoId);
  }, [removeVideo]);

  useEffect(() => {
    if (!isAuthenticated || !token) return undefined;

    const socket = io(SOCKET_API_URL, {
      transports: ['polling', 'websocket'],
      path: '/socket.io',
      autoConnect: true,
      reconnection: true,
    });

    socket.on('connect', () => {
      socket.emit('authenticate', { token });
    });

    const onReelModerated = (payload) => {
      const videoId = payload?.video_id;
      if (!videoId) return;
      const hidden = payload?.visibility === 'hidden';
      patchVideo(videoId, { hidden, visibility: hidden ? 'hidden' : 'public' });
    };

    const onReelDeleted = (payload) => {
      const videoId = payload?.video_id;
      if (!videoId) return;
      removeVideo(videoId);
    };

    socket.on('reel_moderated', onReelModerated);
    socket.on('reel_deleted', onReelDeleted);

    return () => {
      socket.off('reel_moderated', onReelModerated);
      socket.off('reel_deleted', onReelDeleted);
      socket.disconnect();
    };
  }, [isAuthenticated, token, patchVideo, removeVideo]);

  const handleResetDebug = useCallback(() => {
    interactionDebug?.reset?.();
    resetLocalDebugState();
  }, [interactionDebug, resetLocalDebugState]);

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
          {canCreateReel && (
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
        <ReelsDebugPanel
          autoCapture={autoCapture}
          setAutoCapture={setAutoCapture}
          captureDebugSnapshot={captureDebugSnapshot}
          exportDebugStats={exportDebugStats}
          exportDebugCaptureQueue={exportDebugCaptureQueue}
          copyDebugSummary={copyDebugSummary}
          persistDebugSession={persistDebugSession}
          onReset={handleResetDebug}
          debugCaptureQueue={debugCaptureQueue}
          maxCaptureItems={maxCaptureItems}
          stressSessionId={stressSessionId}
          setStressSessionId={setStressSessionId}
          cacheRateTone={cacheRateTone}
          cacheHitRate={cacheHitRate}
          staleTone={staleTone}
          staleSkips={staleSkips}
          hitRateHistory={hitRateHistory}
          sparklinePoints={sparklinePoints}
          debugStats={debugStats}
        />
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
            <div key={video.id} data-index={index} className="reel-item h-full w-full snap-start">
              <ReelCard
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
                isAdmin={isAdmin}
                onReelHidden={handleReelHidden}
                onReelDeleted={handleReelDeleted}
              />
            </div>
          ))}
          {hasMore && (
            <div className="h-20 flex items-center justify-center bg-black/50">
              {loadingMore ? (
                <div className="flex items-center gap-2 text-white/80 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading more reels...
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-white/15 animate-pulse" />
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="h-full flex items-center justify-center">
          <div className="text-center text-white p-6">
            <Camera className="w-20 h-20 mx-auto mb-4 opacity-40" />
            <h3 className="text-xl font-bold mb-2">No Reels Yet</h3>
            <p className="text-white/60 mb-6 text-sm">Be the first to share a property reel!</p>
            {canCreateReel && (
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
