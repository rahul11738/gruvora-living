import { useCallback, useEffect, useRef, useState } from 'react';
import { videosAPI } from '../../lib/api';

export const useReelsFeed = ({ isAuthenticated, primeFromVideos, hydrateSnapshot }) => {
  const [videos, setVideos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
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

  const fetchVideos = useCallback(async () => {
    try {
      const response = await videosAPI.getAll({ limit: 50 });
      const vids = response.data.videos || [];
      setVideos(vids);
      setCommentCountMap(() => {
        const next = {};
        vids.forEach((v) => {
          next[v.id] = typeof v.comments_count === 'number' ? v.comments_count : 0;
        });
        return next;
      });
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
  }, [hydrateSnapshot, isAuthenticated, primeFromVideos]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

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

  return {
    videos,
    currentIndex,
    loading,
    isMuted,
    commentCountMap,
    containerRef,
    fetchVideos,
    setCurrentIndex,
    setIsMuted,
    setCommentCountMap,
    handleTouchStart,
    handleTouchEnd,
    handleScroll,
    scrollToVideo,
  };
};

export default useReelsFeed;
