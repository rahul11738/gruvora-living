import { useCallback, useEffect, useRef, useState, useMemo } from 'react';

/**
 * PERFORMANCE HOOKS
 * 
 * These hooks implement critical performance patterns:
 * 1. useDebounce: Reduce API calls on search/input
 * 2. usePrefetch: Load data before user needs it
 * 3. useVirtualization: Render only visible items in long lists
 * 4. useMemoizedCallback: Stable function references
 */

/**
 * useDebounce Hook
 * 
 * Delays function execution until user stops interacting.
 * Reduces API calls: 1 call instead of 100 for "hello" search
 * 
 * @param callback - Function to debounce
 * @param delay - Milliseconds to wait (default: 300ms)
 * @returns - Debounced function
 * 
 * @example
 * const handleSearch = useDebounce(async (query) => {
 *   const results = await api.search(query);
 *   setResults(results);
 * }, 300);
 * 
 * <input onChange={(e) => handleSearch(e.target.value)} />
 */
export function useDebounce(callback, delay = 300) {
    const timeoutRef = useRef(null);
    const isInitialRender = useRef(true);

    // Clear timeout on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return useCallback((...args) => {
        // Skip first render to prevent immediate call
        if (isInitialRender.current) {
            isInitialRender.current = false;
            return;
        }

        // Clear existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Set new timeout
        timeoutRef.current = setTimeout(() => {
            callback(...args);
        }, delay);
    }, [callback, delay]);
}

/**
 * useDebounceValue Hook
 * 
 * Returns debounced value instead of debounced function.
 * Useful for effects that depend on debounced input.
 * 
 * @example
 * const [searchInput, setSearchInput] = useState('');
 * const debouncedQuery = useDebounceValue(searchInput, 300);
 * 
 * useEffect(() => {
 *   if (debouncedQuery) {
 *     api.search(debouncedQuery);
 *   }
 * }, [debouncedQuery]);
 */
export function useDebounceValue(value, delay = 300) {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => clearTimeout(timer);
    }, [value, delay]);

    return debouncedValue;
}

/**
 * usePrefetch Hook
 * 
 * Loads data on hover or idle time before user navigates.
 * Dramatically improves perceived performance.
 * 
 * @param fetchFn - Async function to prefetch data
 * @param options.delay - Delay before prefetching (ms)
 * @param options.trigger - 'hover', 'focus', or 'idle'
 * @returns { prefetch, isPrefetching }
 * 
 * @example
 * const { prefetch } = usePrefetch(
 *   () => api.getListingDetails(id),
 *   { delay: 200, trigger: 'hover' }
 * );
 * 
 * <Link 
 *   to={`/listing/${id}`}
 *   onMouseEnter={() => prefetch()}
 * >
 *   View Details
 * </Link>
 */
export function usePrefetch(fetchFn, options = {}) {
    const {
        delay = 200,
        trigger = 'hover',
        cache = true,
    } = options;

    const [isPrefetching, setIsPrefetching] = useState(false);
    const cacheRef = useRef(new Map());
    const timeoutRef = useRef(null);

    const prefetch = useCallback(async () => {
        // Return if already cached
        if (cache && cacheRef.current.has('data')) {
            return cacheRef.current.get('data');
        }

        try {
            setIsPrefetching(true);
            const data = await fetchFn();
            if (cache) {
                cacheRef.current.set('data', data);
            }
            return data;
        } finally {
            setIsPrefetching(false);
        }
    }, [fetchFn, cache]);

    const debouncedPrefetch = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            prefetch();
        }, delay);
    }, [prefetch, delay]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return {
        prefetch: debouncedPrefetch,
        isPrefetching,
        getCachedData: () => cacheRef.current.get('data'),
    };
}

/**
 * usePrefetchOnIdle Hook
 * 
 * Automatically prefetch data when browser is idle (using requestIdleCallback).
 * Perfect for background data loading.
 * 
 * @example
 * usePrefetchOnIdle(() => api.getTrendingListings());
 */
export function usePrefetchOnIdle(fetchFn) {
    useEffect(() => {
        if (!('requestIdleCallback' in window)) {
            // Fallback for browsers without requestIdleCallback
            const timeout = setTimeout(fetchFn, 3000);
            return () => clearTimeout(timeout);
        }

        const id = requestIdleCallback(async () => {
            try {
                await fetchFn();
            } catch (error) {
                console.warn('Prefetch on idle failed:', error);
            }
        });

        return () => cancelIdleCallback(id);
    }, [fetchFn]);
}

/**
 * useVirtualization Hook
 * 
 * Renders only visible items in large lists.
 * For 1000 items, renders ~20 instead = 98% performance gain!
 * 
 * Compatible with react-window or custom implementation.
 * 
 * @example
 * const { items, startIndex, endIndex } = useVirtualization(
 *   allItems,
 *   { itemHeight: 60, containerHeight: 400 }
 * );
 * 
 * {items.map(item => <ListItem item={item} />)}
 */
export function useVirtualization(items, options = {}) {
    const {
        itemHeight = 60,
        containerHeight = 400,
        overscan = 5, // Render extra items outside viewport for smoother scrolling
    } = options;

    const [scrollTop, setScrollTop] = useState(0);
    const containerRef = useRef(null);

    const visibleRange = useMemo(() => {
        const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
        const endIndex = Math.min(
            items.length,
            Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
        );
        return { startIndex, endIndex };
    }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

    const visibleItems = useMemo(() => {
        return items.slice(visibleRange.startIndex, visibleRange.endIndex);
    }, [items, visibleRange.startIndex, visibleRange.endIndex]);

    const handleScroll = useCallback((e) => {
        setScrollTop(e.currentTarget.scrollTop);
    }, []);

    // Calculate offsets for smooth scrolling
    const offsetY = visibleRange.startIndex * itemHeight;
    const totalHeight = items.length * itemHeight;

    return {
        visibleItems,
        handleScroll,
        containerRef,
        offsetY,
        totalHeight,
        ...visibleRange,
    };
}

/**
 * useIntersectionObserver Hook
 * 
 * Detect when elements enter/exit viewport.
 * Perfect for lazy loading images and infinite scroll.
 * 
 * @example
 * const { ref, isVisible } = useIntersectionObserver({
 *   threshold: 0.1,
 *   rootMargin: '50px',
 * });
 * 
 * <div ref={ref}>
 *   {isVisible ? <ExpensiveComponent /> : <Skeleton />}
 * </div>
 */
export function useIntersectionObserver(options = {}) {
    const {
        threshold = 0.1,
        rootMargin = '0px',
        once = true, // Only trigger once
    } = options;

    const ref = useRef(null);
    const [isVisible, setIsVisible] = useState(false);
    const hasTriggered = useRef(false);

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsVisible(true);
                hasTriggered.current = true;

                if (once && ref.current) {
                    observer.unobserve(ref.current);
                }
            } else if (!once) {
                setIsVisible(false);
            }
        }, {
            threshold,
            rootMargin,
        });

        if (ref.current) {
            observer.observe(ref.current);
        }

        return () => {
            if (ref.current) {
                observer.unobserve(ref.current);
            }
        };
    }, [threshold, rootMargin, once]);

    return { ref, isVisible };
}

/**
 * useLocalStorage Hook
 * 
 * Persist state in localStorage with automatic sync.
 * Great for caching search history, user preferences.
 * 
 * @example
 * const [favorites, setFavorites] = useLocalStorage('favorites', []);
 */
export function useLocalStorage(key, initialValue) {
    const [storedValue, setStoredValue] = useState(() => {
        try {
            const item = typeof window !== 'undefined'
                ? window.localStorage?.getItem(key)
                : null;
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.warn(`Error reading localStorage key "${key}":`, error);
            return initialValue;
        }
    });

    const setValue = useCallback((value) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);

            if (typeof window !== 'undefined') {
                window.localStorage?.setItem(key, JSON.stringify(valueToStore));
            }
        } catch (error) {
            console.warn(`Error setting localStorage key "${key}":`, error);
        }
    }, [key, storedValue]);

    return [storedValue, setValue];
}

/**
 * useAsync Hook
 * 
 * Manages loading, error, and data states for async operations.
 * 
 * @example
 * const { data, loading, error } = useAsync(
 *   () => api.getListings(),
 *   [category]
 * );
 */
export function useAsync(asyncFunction, immediate = true, deps = []) {
    const [status, setStatus] = useState('idle');
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    // Execute async function
    const execute = useCallback(async () => {
        setStatus('pending');
        setData(null);
        setError(null);

        try {
            const response = await asyncFunction();
            setData(response);
            setStatus('success');
            return response;
        } catch (err) {
            setError(err);
            setStatus('error');
            throw err;
        }
    }, [asyncFunction]);

    // Call on mount if immediate
    useEffect(() => {
        if (immediate) {
            execute();
        }
    }, [execute, immediate]); // Note: depends on execute function

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (immediate) {
            execute();
        }
    }, deps);

    return {
        execute,
        status,
        data,
        error,
        isLoading: status === 'pending',
        isError: status === 'error',
        isSuccess: status === 'success',
    };
}

/**
 * useMemoizedCallback Hook
 * 
 * Ensures callback stability across renders.
 * Useful for event handlers passed to optimized child components.
 * 
 * @example
 * const handleClick = useMemoizedCallback(
 *   (id) => { /* handle click */ },
 * [dependency]
    * );
 */
export function useMemoizedCallback(callback, deps) {
    return useCallback(callback, deps);
}

/**
 * USAGE SUMMARY:
 * 
 * API Calls (Search):
 * const handleSearch = useDebounce(async (q) => { ... }, 300);
 * 
 * Data Loading:
 * const { data, isLoading } = useAsync(() => api.fetch(), []);
 * 
 * Navigation Prefetch:
 * const { prefetch } = usePrefetch(() => api.getDetails(id));
 * 
 * Long Lists:
 * const { visibleItems, offsetY } = useVirtualization(items, { itemHeight: 60 });
 * 
 * Lazy Loading Images:
 * const { ref, isVisible } = useIntersectionObserver();
 * 
 * Persistent Data:
 * const [saved, setSaved] = useLocalStorage('favorites', []);
 */
