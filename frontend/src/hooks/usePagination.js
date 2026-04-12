/**
 * usePagination Hook
 * Reusable pagination logic for any listing/data endpoint
 * 
 * Usage:
 * const { data, page, pages, total, loading, goToPage, nextPage, prevPage } 
 *   = usePagination(fetcher, initialPage, itemsPerPage);
 */

import { useState, useCallback, useEffect } from 'react';

const usePagination = (
    fetcher, // async function(page, limit) => { data, total, pages }
    initialPage = 1,
    itemsPerPage = 20
) => {
    const [data, setData] = useState([]);
    const [page, setPage] = useState(initialPage);
    const [total, setTotal] = useState(0);
    const [pages, setPages] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Fetch data for current page
    const loadPage = useCallback(
        async (pageNum) => {
            setLoading(true);
            setError(null);
            try {
                const result = await fetcher(pageNum, itemsPerPage);
                setData(result.data || result.listings || result.videos || []);
                setTotal(result.total || 0);
                setPages(result.pages || 1);
                setPage(pageNum);
            } catch (err) {
                setError(err.message || 'Failed to load data');
                console.error('Pagination error:', err);
            } finally {
                setLoading(false);
            }
        },
        [fetcher, itemsPerPage]
    );

    // Load initial page on mount
    useEffect(() => {
        loadPage(initialPage);
    }, []);

    // Helper functions
    const nextPage = useCallback(() => {
        if (page < pages) {
            loadPage(page + 1);
        }
    }, [page, pages, loadPage]);

    const prevPage = useCallback(() => {
        if (page > 1) {
            loadPage(page - 1);
        }
    }, [page, loadPage]);

    const goToPage = useCallback(
        (pageNum) => {
            const num = Math.max(1, Math.min(pageNum, pages));
            loadPage(num);
        },
        [pages, loadPage]
    );

    return {
        data,
        page,
        pages,
        total,
        loading,
        error,
        goToPage,
        nextPage,
        prevPage,
        hasNextPage: page < pages,
        hasPrevPage: page > 1,
        isFirstPage: page === 1,
        isLastPage: page === pages,
    };
};

export default usePagination;
