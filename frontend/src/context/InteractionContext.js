import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { interactionsAPI, usersAPI, videosAPI, wishlistAPI } from '../lib/api';

const InteractionContext = createContext(null);

const DEBOUNCE_MS = 300;
const SNAPSHOT_TTL_MS = 30000;
const IS_DEV = process.env.NODE_ENV !== 'production';

const normalizeWishlistId = (listingId) => {
  if (listingId === null || listingId === undefined) return '';
  return String(listingId);
};

export const useInteractions = () => {
  const context = useContext(InteractionContext);
  if (!context) {
    throw new Error('useInteractions must be used within InteractionProvider');
  }
  return context;
};

export const InteractionProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [followingMap, setFollowingMap] = useState({});
  const [likeMap, setLikeMap] = useState({});
  const [wishlistMap, setWishlistMap] = useState({});
  const [pendingFollowMap, setPendingFollowMap] = useState({});
  const [pendingLikeMap, setPendingLikeMap] = useState({});
  const [pendingWishlistMap, setPendingWishlistMap] = useState({});

  const actionTsRef = useRef({});
  const snapshotCacheRef = useRef({});
  const snapshotInFlightRef = useRef({});
  const mutationClockRef = useRef(0);
  const ownerMutationVersionRef = useRef({});
  const reelMutationVersionRef = useRef({});
  const debugStatsRef = useRef({
    snapshotCalls: 0,
    snapshotCacheHits: 0,
    snapshotCacheMisses: 0,
    snapshotInFlightJoins: 0,
    snapshotRequests: 0,
    snapshotCacheWrites: 0,
    snapshotStaleSkips: 0,
    cacheInvalidations: 0,
    followToggles: 0,
    likeToggles: 0,
  });

  const incrementDebugStat = useCallback((key, delta = 1) => {
    if (!IS_DEV) return;
    const current = debugStatsRef.current[key] || 0;
    debugStatsRef.current[key] = current + delta;
  }, []);

  const getDebugStats = useCallback(() => {
    return { ...debugStatsRef.current };
  }, []);

  const resetDebugStats = useCallback(() => {
    debugStatsRef.current = {
      snapshotCalls: 0,
      snapshotCacheHits: 0,
      snapshotCacheMisses: 0,
      snapshotInFlightJoins: 0,
      snapshotRequests: 0,
      snapshotCacheWrites: 0,
      snapshotStaleSkips: 0,
      cacheInvalidations: 0,
      followToggles: 0,
      likeToggles: 0,
    };
  }, []);

  const markOwnerMutation = useCallback((ownerId) => {
    if (!ownerId) return;
    mutationClockRef.current += 1;
    ownerMutationVersionRef.current[ownerId] = mutationClockRef.current;
  }, []);

  const markReelMutation = useCallback((reelId) => {
    if (!reelId) return;
    mutationClockRef.current += 1;
    reelMutationVersionRef.current[reelId] = mutationClockRef.current;
  }, []);

  const invalidateSnapshotCache = useCallback(({ ownerId, reelId } = {}) => {
    if (!ownerId && !reelId) return;

    const cacheKeys = Object.keys(snapshotCacheRef.current);
    let invalidated = 0;
    for (const key of cacheKeys) {
      const [ownersPart, reelsPart] = key.split('|');
      const owners = (ownersPart || '').replace('owners:', '').split(',').filter(Boolean);
      const reels = (reelsPart || '').replace('reels:', '').split(',').filter(Boolean);

      const ownerMatched = ownerId ? owners.includes(ownerId) : false;
      const reelMatched = reelId ? reels.includes(reelId) : false;
      if (ownerMatched || reelMatched) {
        delete snapshotCacheRef.current[key];
        invalidated += 1;
      }
    }
    if (invalidated > 0) {
      incrementDebugStat('cacheInvalidations', invalidated);
    }
  }, [incrementDebugStat]);

  const shouldDebounce = useCallback((key) => {
    const now = Date.now();
    const last = actionTsRef.current[key] || 0;
    if (now - last < DEBOUNCE_MS) {
      return true;
    }
    actionTsRef.current[key] = now;
    return false;
  }, []);

  const primeFromVideos = useCallback((videos = []) => {
    if (!Array.isArray(videos) || videos.length === 0) return;

    setFollowingMap((prev) => {
      const next = { ...prev };
      for (const v of videos) {
        if (v?.owner_id && typeof v.user_following === 'boolean' && next[v.owner_id] === undefined) {
          next[v.owner_id] = v.user_following;
        }
      }
      return next;
    });

    setLikeMap((prev) => {
      const next = { ...prev };
      for (const v of videos) {
        if (!v?.id || next[v.id] !== undefined) continue;
        next[v.id] = {
          liked: Boolean(v.user_liked),
          count: typeof v.likes === 'number' ? v.likes : 0,
        };
      }
      return next;
    });
  }, []);

  const primeOwnerFollow = useCallback((ownerId, isFollowing) => {
    if (!ownerId || typeof isFollowing !== 'boolean') return;
    setFollowingMap((prev) => {
      if (prev[ownerId] === isFollowing) return prev;
      return { ...prev, [ownerId]: isFollowing };
    });
  }, []);

  const hydrateSnapshot = useCallback(async ({ ownerIds = [], reelIds = [] } = {}) => {
    if (!isAuthenticated) return;
    incrementDebugStat('snapshotCalls');

    const uniqueOwnerIds = Array.from(new Set((ownerIds || []).filter(Boolean))).slice(0, 200);
    const uniqueReelIds = Array.from(new Set((reelIds || []).filter(Boolean))).slice(0, 200);
    if (!uniqueOwnerIds.length && !uniqueReelIds.length) return;

    const ownerKey = [...uniqueOwnerIds].sort().join(',');
    const reelKey = [...uniqueReelIds].sort().join(',');
    const cacheKey = `owners:${ownerKey}|reels:${reelKey}`;
    const now = Date.now();
    const ownerBaselineVersion = {};
    const reelBaselineVersion = {};

    for (const ownerId of uniqueOwnerIds) {
      ownerBaselineVersion[ownerId] = ownerMutationVersionRef.current[ownerId] || 0;
    }
    for (const reelId of uniqueReelIds) {
      reelBaselineVersion[reelId] = reelMutationVersionRef.current[reelId] || 0;
    }

    const cached = snapshotCacheRef.current[cacheKey];
    if (cached && now - cached.ts < SNAPSHOT_TTL_MS) {
      incrementDebugStat('snapshotCacheHits');
      return;
    }
    incrementDebugStat('snapshotCacheMisses');

    const inFlight = snapshotInFlightRef.current[cacheKey];
    if (inFlight) {
      incrementDebugStat('snapshotInFlightJoins');
      await inFlight;
      return;
    }

    const requestPromise = (async () => {
      incrementDebugStat('snapshotRequests');
      const response = await interactionsAPI.snapshot({
        owner_ids: uniqueOwnerIds.join(','),
        reel_ids: uniqueReelIds.join(','),
      });

      const followingSet = new Set(response?.data?.following_owner_ids || []);
      const likedSet = new Set(response?.data?.liked_reel_ids || []);
      let skippedStale = false;

      if (uniqueOwnerIds.length) {
        setFollowingMap((prev) => {
          const next = { ...prev };
          for (const ownerId of uniqueOwnerIds) {
            if ((ownerMutationVersionRef.current[ownerId] || 0) !== ownerBaselineVersion[ownerId]) {
              skippedStale = true;
              continue;
            }
            next[ownerId] = followingSet.has(ownerId);
          }
          return next;
        });
      }

      if (uniqueReelIds.length) {
        setLikeMap((prev) => {
          const next = { ...prev };
          for (const reelId of uniqueReelIds) {
            if ((reelMutationVersionRef.current[reelId] || 0) !== reelBaselineVersion[reelId]) {
              skippedStale = true;
              continue;
            }
            const current = next[reelId] || { liked: false, count: 0 };
            next[reelId] = { ...current, liked: likedSet.has(reelId) };
          }
          return next;
        });
      }

      if (!skippedStale) {
        snapshotCacheRef.current[cacheKey] = { ts: Date.now() };
        incrementDebugStat('snapshotCacheWrites');
      } else {
        incrementDebugStat('snapshotStaleSkips');
      }
    })();

    snapshotInFlightRef.current[cacheKey] = requestPromise;
    try {
      await requestPromise;
    } finally {
      delete snapshotInFlightRef.current[cacheKey];
    }
  }, [incrementDebugStat, isAuthenticated]);

  const toggleFollow = useCallback(async (ownerId) => {
    if (!isAuthenticated || !ownerId || ownerId === user?.id) {
      return { ok: false, following: false };
    }

    const pendingKey = `follow:${ownerId}`;
    if (pendingFollowMap[ownerId] || shouldDebounce(pendingKey)) {
      return { ok: false, following: Boolean(followingMap[ownerId]) };
    }

    const prevFollowing = Boolean(followingMap[ownerId]);
    const optimistic = !prevFollowing;
    incrementDebugStat('followToggles');
    markOwnerMutation(ownerId);

    setPendingFollowMap((prev) => ({ ...prev, [ownerId]: true }));
    setFollowingMap((prev) => ({ ...prev, [ownerId]: optimistic }));

    try {
      const response = await usersAPI.toggleFollow(ownerId);
      const serverFollowing =
        typeof response?.data?.following === 'boolean' ? response.data.following : optimistic;
      setFollowingMap((prev) => ({ ...prev, [ownerId]: serverFollowing }));
      invalidateSnapshotCache({ ownerId });
      return {
        ok: true,
        following: serverFollowing,
        followersCount: response?.data?.followers_count,
      };
    } catch (error) {
      setFollowingMap((prev) => ({ ...prev, [ownerId]: prevFollowing }));
      throw error;
    } finally {
      setPendingFollowMap((prev) => ({ ...prev, [ownerId]: false }));
    }
  }, [
    followingMap,
    incrementDebugStat,
    invalidateSnapshotCache,
    isAuthenticated,
    markOwnerMutation,
    pendingFollowMap,
    shouldDebounce,
    user?.id,
  ]);

  const toggleLike = useCallback(async (videoId, fallbackCount = 0) => {
    if (!isAuthenticated || !videoId) {
      return { ok: false, liked: false, likes: fallbackCount };
    }

    const pendingKey = `like:${videoId}`;
    if (pendingLikeMap[videoId] || shouldDebounce(pendingKey)) {
      const current = likeMap[videoId] || { liked: false, count: fallbackCount };
      return { ok: false, liked: current.liked, likes: current.count };
    }

    const prevLike = likeMap[videoId] || { liked: false, count: fallbackCount };
    const optimistic = {
      liked: !prevLike.liked,
      count: Math.max(0, prevLike.count + (prevLike.liked ? -1 : 1)),
    };
    incrementDebugStat('likeToggles');
    markReelMutation(videoId);

    setPendingLikeMap((prev) => ({ ...prev, [videoId]: true }));
    setLikeMap((prev) => ({ ...prev, [videoId]: optimistic }));

    try {
      const response = await videosAPI.like(videoId);
      const settled = {
        liked: typeof response?.data?.liked === 'boolean' ? response.data.liked : optimistic.liked,
        count: typeof response?.data?.likes === 'number' ? response.data.likes : optimistic.count,
      };
      setLikeMap((prev) => ({ ...prev, [videoId]: settled }));
      invalidateSnapshotCache({ reelId: videoId });
      return { ok: true, liked: settled.liked, likes: settled.count };
    } catch (error) {
      setLikeMap((prev) => ({ ...prev, [videoId]: prevLike }));
      throw error;
    } finally {
      setPendingLikeMap((prev) => ({ ...prev, [videoId]: false }));
    }
  }, [incrementDebugStat, invalidateSnapshotCache, isAuthenticated, likeMap, markReelMutation, pendingLikeMap, shouldDebounce]);

  const refreshWishlist = useCallback(async () => {
    if (!isAuthenticated) {
      setWishlistMap({});
      return;
    }

    const response = await wishlistAPI.get();
    const listings = response?.data?.listings || [];
    const nextMap = {};
    for (const item of listings) {
      const normalizedId = normalizeWishlistId(item?.id);
      if (!normalizedId) continue;
      nextMap[normalizedId] = true;
    }
    setWishlistMap(nextMap);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setWishlistMap({});
      return;
    }

    refreshWishlist().catch(() => {
      // Keep existing state if refresh fails.
    });
  }, [isAuthenticated, refreshWishlist]);

  const isWishlisted = useCallback((listingId) => {
    const normalizedId = normalizeWishlistId(listingId);
    if (!normalizedId) return false;
    return Boolean(wishlistMap[normalizedId]);
  }, [wishlistMap]);

  const toggleWishlist = useCallback(async (listingId) => {
    const normalizedId = normalizeWishlistId(listingId);
    if (!isAuthenticated || !normalizedId) {
      return { ok: false, wishlisted: false };
    }

    if (pendingWishlistMap[normalizedId]) {
      return { ok: false, wishlisted: Boolean(wishlistMap[normalizedId]) };
    }

    const wasWishlisted = Boolean(wishlistMap[normalizedId]);
    const optimistic = !wasWishlisted;

    setPendingWishlistMap((prev) => ({ ...prev, [normalizedId]: true }));
    setWishlistMap((prev) => ({ ...prev, [normalizedId]: optimistic }));

    try {
      if (wasWishlisted) {
        await wishlistAPI.remove(normalizedId);
      } else {
        await wishlistAPI.add(normalizedId);
      }
      return { ok: true, wishlisted: optimistic };
    } catch (error) {
      setWishlistMap((prev) => ({ ...prev, [normalizedId]: wasWishlisted }));
      throw error;
    } finally {
      setPendingWishlistMap((prev) => ({ ...prev, [normalizedId]: false }));
    }
  }, [isAuthenticated, pendingWishlistMap, wishlistMap]);

  const debugApi = useMemo(() => {
    if (!IS_DEV || typeof window === 'undefined') return null;
    return {
      getStats: getDebugStats,
      reset: resetDebugStats,
    };
  }, [getDebugStats, resetDebugStats]);

  useEffect(() => {
    if (!IS_DEV || typeof window === 'undefined') return;
    window.__interactionDebug = debugApi;
    return () => {
      if (window.__interactionDebug === debugApi) {
        window.__interactionDebug = null;
      }
    };
  }, [debugApi]);

  const value = useMemo(() => ({
    followingMap,
    likeMap,
    wishlistMap,
    pendingFollowMap,
    pendingLikeMap,
    pendingWishlistMap,
    primeFromVideos,
    primeOwnerFollow,
    hydrateSnapshot,
    toggleFollow,
    toggleLike,
    isWishlisted,
    toggleWishlist,
    refreshWishlist,
    interactionDebug: debugApi,
  }), [
    followingMap,
    likeMap,
    wishlistMap,
    pendingFollowMap,
    pendingLikeMap,
    pendingWishlistMap,
    primeFromVideos,
    primeOwnerFollow,
    hydrateSnapshot,
    toggleFollow,
    toggleLike,
    isWishlisted,
    toggleWishlist,
    refreshWishlist,
    debugApi,
  ]);

  return <InteractionContext.Provider value={value}>{children}</InteractionContext.Provider>;
};
