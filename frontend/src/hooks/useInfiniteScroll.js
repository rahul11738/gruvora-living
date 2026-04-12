/**
 * useInfiniteScroll Hook
 * Handles infinite scroll pagination for feed-style pages
 * 
 * Usage:
 * const { data, loading, hasMore, observerTarget } = useInfiniteScroll(fetcher);
 */

import { useState, useCallback, useRef, useEffect } from 'react';

const useInfiniteScroll = (
    fetcher, // async function(page, limit) => { data, pages }
    itemsPerPage = 20
) => {
    const [data, setData] = useState([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const observerTarget = useRef(null);

    // Load more items
    const loadMore = useCallback(async () => {
        if (loading || !hasMore) return;

        setLoading(true);
        setError(null);

        try {
            const result = await fetcher(page, itemsPerPage);
            const newData = result.data || result.listings || result.videos || [];

            setData((prev) => [...prev, ...newData]);

            // Check if there are more pages
            const totalPages = result.pages || 1;
            const nextPage = page + 1;
            setPage(nextPage);
            setHasMore(nextPage <= totalPages);
        } catch (err) {
            setError(err.message || 'Failed to load more items');
            console.error('Infinite scroll error:', err);
        } finally {
            setLoading(false);
        }
    }, [page, loading, hasMore, fetcher, itemsPerPage]);

    // Initial load on mount
    useEffect(() => {
        loadMore();
    }, []);

    // Intersection Observer for infinite scroll
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && hasMore && !loading) {
                    loadMore();
                }
            },
            {
                threshold: 0.5, // Trigger when 50% of the element is visible
                rootMargin: '100px', // Start loading 100px before reaching the element
            }
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => {
            if (observerTarget.current) {
                observer.unobserve(observerTarget.current);
            }
        };
    }, [loadMore, hasMore, loading]);

    const reset = useCallback(() => {
        setData([]);
        setPage(1);
        setHasMore(true);
        setError(null);
    }, []);

    return {
        data,
        loading,
        hasMore,
        error,
        observerTarget,
        reset,
        totalItems: data.length,
    };
};

export default useInfiniteScroll;
