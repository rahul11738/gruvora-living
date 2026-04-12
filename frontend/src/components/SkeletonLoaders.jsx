import React, { memo } from 'react';
import './skeleton.css';

/**
 * SKELETON LOADERS - Replace spinning loaders with perceived progress
 * 
 * Better perceived performance than spinners because users see
 * visual structure appearing instead of generic loading state.
 * 
 * Research shows skeleton loaders reduce perceived load time by ~30%
 * even though actual load time is the same!
 */

/**
 * Shimmer Animation CSS
 * Add this to your global CSS or inline
 */
export const shimmerCSS = `
  @keyframes shimmer {
    0% {
      background-position: -1000px 0;
    }
    100% {
      background-position: 1000px 0;
    }
  }
  
  .shimmer-loading {
    background: linear-gradient(
      90deg,
      #f0f0f0 25%,
      #e0e0e0 50%,
      #f0f0f0 75%
    );
    background-size: 1000px 100%;
    animation: shimmer 2s infinite;
  }
`;

/**
 * Generic Skeleton Loader
 */
export const Skeleton = ({ width = '100%', height = '20px', className = '', ...props }) => (
    <div
        className={`shimmer-loading rounded ${className}`}
        style={{ width, height }}
        {...props}
    />
);

export const RouteSkeleton = memo(function RouteSkeleton() {
    return (
        <div className="min-h-screen bg-stone-50 px-4 py-10">
            <div className="mx-auto max-w-6xl space-y-6">
                <Skeleton height="56px" className="rounded-2xl" />
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, idx) => (
                        <CardSkeleton key={idx} />
                    ))}
                </div>
            </div>
        </div>
    );
});

export const ProfileSkeleton = memo(function ProfileSkeleton() {
    return (
        <div className="min-h-screen bg-stone-50">
            <div className="mx-auto max-w-6xl px-4 py-10">
                <div className="rounded-2xl bg-white p-6 shadow-sm">
                    <div className="flex flex-col items-center gap-4 md:flex-row md:items-start">
                        <Skeleton width="128px" height="128px" className="rounded-full" />
                        <div className="w-full space-y-3">
                            <Skeleton width="40%" height="28px" />
                            <Skeleton width="60%" height="18px" />
                            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                                {Array.from({ length: 4 }).map((_, idx) => (
                                    <Skeleton key={idx} height="64px" className="rounded-xl" />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, idx) => (
                        <CardSkeleton key={idx} />
                    ))}
                </div>
            </div>
        </div>
    );
});

/**
 * Card Skeleton (for listing/property cards)
 * Perfect for grid layouts
 */
export const CardSkeleton = ({ className = '' }) => (
    <div className={`bg-white rounded-lg overflow-hidden shadow-md p-4 ${className}`}>
        {/* Image skeleton */}
        <Skeleton width="100%" height="200px" className="rounded-md mb-4" />

        {/* Title skeleton */}
        <Skeleton width="80%" height="20px" className="mb-3" />

        {/* Description lines */}
        <Skeleton width="100%" height="16px" className="mb-2" />
        <Skeleton width="95%" height="16px" className="mb-4" />

        {/* Price and button skeletons */}
        <div className="flex items-center justify-between">
            <Skeleton width="40%" height="24px" />
            <Skeleton width="25%" height="36px" className="rounded-md" />
        </div>
    </div>
);

/**
 * List Item Skeleton
 */
export const ListItemSkeleton = ({ className = '' }) => (
    <div className={`flex items-center gap-4 p-4 ${className}`}>
        {/* Avatar/Image */}
        <Skeleton width="48px" height="48px" className="rounded-full flex-shrink-0" />

        {/* Content */}
        <div className="flex-1">
            <Skeleton width="60%" height="16px" className="mb-2" />
            <Skeleton width="40%" height="14px" />
        </div>

        {/* Action */}
        <Skeleton width="80px" height="32px" className="rounded-md" />
    </div>
);

/**
 * Grid Skeleton (multiple cards)
 * @param count - Number of skeleton cards to show
 * @param cols - Number of columns (tailwind: 1, 2, 3, 4)
 */
export const CardGridSkeleton = ({ count = 6, cols = 3 }) => {
    const colsClass = {
        1: 'grid-cols-1',
        2: 'grid-cols-1 sm:grid-cols-2',
        3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    }[cols];

    return (
        <div className={`grid ${colsClass} gap-4`}>
            {Array.from({ length: count }).map((_, i) => (
                <CardSkeleton key={i} />
            ))}
        </div>
    );
};

/**
 * Page Skeleton (for full page loads)
 */
export const PageSkeleton = () => (
    <div className="min-h-screen bg-stone-50 p-4">
        {/* Header skeleton */}
        <div className="mb-8">
            <Skeleton width="30%" height="32px" className="mb-4" />
            <Skeleton width="70%" height="20px" />
        </div>

        {/* Content skeleton */}
        <CardGridSkeleton count={9} cols={3} />
    </div>
);

/**
 * Search Results Skeleton
 */
export const SearchResultsSkeleton = ({ count = 5 }) => (
    <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
            <ListItemSkeleton key={i} />
        ))}
    </div>
);

/**
 * Listing Detail Skeleton
 */
export const ListingDetailSkeleton = () => (
    <div className="min-h-screen bg-white p-4">
        {/* Image gallery skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
            <Skeleton width="100%" height="400px" className="rounded-lg lg:col-span-2" />
            <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} width="100%" height="180px" className="rounded-lg" />
                ))}
            </div>
        </div>

        {/* Title and price */}
        <div className="mb-6">
            <Skeleton width="50%" height="28px" className="mb-3" />
            <Skeleton width="30%" height="24px" className="mb-4" />
            <Skeleton width="80%" height="18px" />
        </div>

        {/* Details skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <Skeleton width="40%" height="20px" className="mb-4" />
                <Skeleton width="100%" height="16px" className="mb-2" />
                <Skeleton width="100%" height="16px" className="mb-2" />
                <Skeleton width="80%" height="16px" />
            </div>
            <div>
                <Skeleton width="40%" height="20px" className="mb-4" />
                <Skeleton width="100%" height="16px" className="mb-2" />
                <Skeleton width="100%" height="16px" className="mb-2" />
                <Skeleton width="80%" height="16px" />
            </div>
        </div>
    </div>
);

/**
 * Reels Feed Skeleton
 */
export const ReelsSkeleton = ({ count = 3 }) => (
    <div className="space-y-4">
        {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg overflow-hidden shadow-md">
                {/* Video skeleton */}
                <Skeleton width="100%" height="300px" />

                {/* Info skeleton */}
                <div className="p-4">
                    <Skeleton width="60%" height="20px" className="mb-3" />
                    <Skeleton width="100%" height="16px" className="mb-2" />
                    <Skeleton width="80%" height="16px" />
                </div>
            </div>
        ))}
    </div>
);

/**
 * Chat Message Skeleton
 */
export const ChatMessageSkeleton = ({ isOwn = false }) => {
    const alignClass = isOwn ? 'flex-row-reverse' : 'flex-row';
    const marginClass = isOwn ? 'mr-8' : 'ml-8';

    return (
        <div className={`flex ${alignClass} gap-3 mb-4`}>
            <Skeleton width="36px" height="36px" className="rounded-full flex-shrink-0" />
            <Skeleton width="200px" height="60px" className={`rounded-lg ${marginClass}`} />
        </div>
    );
};

/**
 * Dashboard Stats Skeleton
 */
export const DashboardStatsSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg p-6 shadow-md">
                <Skeleton width="60%" height="14px" className="mb-3" />
                <Skeleton width="80%" height="28px" className="mb-2" />
                <Skeleton width="50%" height="12px" />
            </div>
        ))}
    </div>
);

/**
 * USAGE EXAMPLES:
 * 
 * Replace spinners:
 * ```jsx
 * {isLoading ? <CardGridSkeleton count={6} cols={3} /> : <YourContent />}
 * ```
 * 
 * For suspense boundaries:
 * ```jsx
 * <Suspense fallback={<PageSkeleton />}>
 *   <LazyComponent />
 * </Suspense>
 * ```
 * 
 * For individual items:
 * ```jsx
 * {item ? <Card item={item} /> : <CardSkeleton />}
 * ```
 */
