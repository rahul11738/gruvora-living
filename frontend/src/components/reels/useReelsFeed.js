import { useCallback, useEffect, useRef, useState } from 'react';
import { reelsAPI, videosAPI } from '../../lib/api';

export const useReelsFeed = ({ isAuthenticated, primeFromVideos, hydrateSnapshot, preferredListingId = '' }) => {
  const [videos, setVideos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(1);
  const [isMuted, setIsMuted] = useState(false);
  const [commentCountMap, setCommentCountMap] = useState({});
  const containerRef = useRef(null);
  const touchStartY = useRef(0);

  useEffect(() => {
    setIsMuted(false);
    return () => {
      setIsMuted(true);
    };
  }, []);

  const mergeReels = useCallback((incoming = []) => {
    setVideos((prev) => {
      const seen = new Set(prev.map((v) => v.id));
      const next = [...prev];
      for (const item of incoming) {
        if (!item?.id || seen.has(item.id)) continue;
        next.push(item);
        seen.add(item.id);
      }
      return next;
    });
  }, []);

  const applyOrdering = useCallback((items) => {
    const matchListingId = (video) => {
      const candidate = video?.listing_id || video?.listingId || video?.listing?.id;
      return String(candidate || '') === String(preferredListingId || '');
    };

    return preferredListingId
      ? [...items.filter(matchListingId), ...items.filter((video) => !matchListingId(video))]
      : items;
  }, [preferredListingId]);

  const hydrateInteractionState = useCallback(async (list) => {
    primeFromVideos(list);
    if (isAuthenticated && list.length) {
      const reelIds = list.map((v) => v.id).filter(Boolean);
      const ownerIds = list.map((v) => v.owner_id).filter(Boolean);
      await hydrateSnapshot({ ownerIds, reelIds });
    }
  }, [hydrateSnapshot, isAuthenticated, primeFromVideos]);

  const fetchVideos = useCallback(async () => {
    try {
      pageRef.current = 1;
      const response = await reelsAPI.getFeed({ page: 1, limit: 10 });
      const vids = response?.data?.videos || [];
      const orderedVideos = applyOrdering(vids);

      setVideos(orderedVideos);
      setCommentCountMap(() => {
        const next = {};
        orderedVideos.forEach((v) => {
          next[v.id] = typeof v.comments_count === 'number' ? v.comments_count : 0;
        });
        return next;
      });
      setHasMore((response?.data?.page || 1) < (response?.data?.pages || 1));
      await hydrateInteractionState(orderedVideos);
    } catch (error) {
      try {
        const fallback = await videosAPI.getAll({ limit: 20 });
        const vids = fallback?.data?.videos || [];
        const orderedVideos = applyOrdering(vids);
        setVideos(orderedVideos);
        setHasMore(false);
        await hydrateInteractionState(orderedVideos);
      } catch (fallbackError) {
        console.error('Failed to fetch videos:', fallbackError);
      }
    } finally {
      setLoading(false);
    }
  }, [applyOrdering, hydrateInteractionState]);

  const fetchNextPage = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const nextPage = pageRef.current + 1;
      const response = await reelsAPI.getFeed({ page: nextPage, limit: 10 });
      const nextVideos = applyOrdering(response?.data?.videos || []);
      if (nextVideos.length) {
        mergeReels(nextVideos);
        setCommentCountMap((prev) => {
          const next = { ...prev };
          nextVideos.forEach((v) => {
            if (typeof next[v.id] !== 'number') {
              next[v.id] = typeof v.comments_count === 'number' ? v.comments_count : 0;
            }
          });
          return next;
        });
      }
      pageRef.current = nextPage;
      setHasMore((response?.data?.page || nextPage) < (response?.data?.pages || nextPage));
    } catch (error) {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [applyOrdering, hasMore, loadingMore, mergeReels]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  useEffect(() => {
    if (!videos.length) return;
    if (currentIndex >= Math.max(0, videos.length - 3)) {
      fetchNextPage();
    }
  }, [currentIndex, fetchNextPage, videos.length]);

  useEffect(() => {
    const nextVideo = videos[currentIndex + 1];
    if (!nextVideo?.adaptive_url && !nextVideo?.video_url && !nextVideo?.url) {
      return undefined;
    }

    const preloadUrl = nextVideo.adaptive_url || nextVideo.video_url || nextVideo.url;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'video';
    link.href = preloadUrl;
    document.head.appendChild(link);

    return () => {
      document.head.removeChild(link);
    };
  }, [currentIndex, videos]);

  const handleTouchStart = useCallback((e) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e) => {
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartY.current - touchEndY;

    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentIndex < videos.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else if (diff < 0 && currentIndex > 0) {
        setCurrentIndex((prev) => prev - 1);
      }
    }
  }, [currentIndex, videos.length]);

  const handleScroll = useCallback((e) => {
    const container = e.target;
    const scrollPosition = container.scrollTop;
    const itemHeight = container.clientHeight;
    const newIndex = Math.round(scrollPosition / itemHeight);
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < videos.length) {
      setCurrentIndex(newIndex);
    }
  }, [currentIndex, videos.length]);

  const scrollToVideo = useCallback((index) => {
    if (index >= 0 && index < videos.length) {
      containerRef.current?.scrollTo({
        top: index * containerRef.current.clientHeight,
        behavior: 'smooth',
      });
      setCurrentIndex(index);
    }
  }, [videos.length]);

  const removeVideo = useCallback((videoId) => {
    if (!videoId) return;
    setVideos((prev) => prev.filter((item) => item.id !== videoId));
    setCommentCountMap((prev) => {
      const next = { ...prev };
      delete next[videoId];
      return next;
    });
  }, []);

  const patchVideo = useCallback((videoId, patch) => {
    if (!videoId) return;
    setVideos((prev) => prev.map((item) => (item.id === videoId ? { ...item, ...patch } : item)));
  }, []);

  return {
    videos,
    currentIndex,
    loading,
    loadingMore,
    hasMore,
    isMuted,
    commentCountMap,
    containerRef,
    fetchVideos,
    fetchNextPage,
    setCurrentIndex,
    setIsMuted,
    setCommentCountMap,
    removeVideo,
    patchVideo,
    handleTouchStart,
    handleTouchEnd,
    handleScroll,
    scrollToVideo,
  };
};

export default useReelsFeed;
