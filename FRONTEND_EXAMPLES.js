/**
 * EXAMPLE: HomeComponents.js (Infinite Scroll Implementation)
 * Shows how to implement infinite scroll for the main listings feed
 */

import React, { useEffect, useState } from 'react';
import ListingsAPI from '../services/listingsAPI';
import useInfiniteScroll from '../hooks/useInfiniteScroll';
import SkeletonLoaders from './SkeletonLoaders';
import ListingCard from './ListingCard'; // Your existing component

function HomeComponents() {
    const [filters, setFilters] = useState({});

    // Fetcher function for infinite scroll
    const fetcher = async (page, limit) => {
        return await ListingsAPI.getListings(filters, page, limit);
    };

    const { data: listings, loading, hasMore, observerTarget, error } = useInfiniteScroll(
        fetcher,
        20 // items per page
    );

    const handleFilterChange = (newFilters) => {
        setFilters(newFilters);
        // Note: Would need to reset infinite scroll state when filters change
        // Could add a reset method to useInfiniteScroll hook
    };

    return (
        <div className="home-page">
            {/* Filter Section */}
            <div className="filter-section">
                {/* Your filter controls here */}
            </div>

            {/* Listings Grid */}
            <div className="listings-grid">
                {listings.length === 0 && !loading ? (
                    <div className="no-listings">No listings found</div>
                ) : (
                    listings.map((listing) => (
                        <ListingCard key={listing.id} listing={listing} />
                    ))
                )}

                {/* Loading Skeletons */}
                {loading && (
                    <SkeletonLoaders count={5} type="listing-card" />
                )}

                {error && (
                    <div className="error-message">
                        {error}
                        <button onClick={() => window.location.reload()}>Retry</button>
                    </div>
                )}
            </div>

            {/* Infinite Scroll Trigger Element */}
            {hasMore && (
                <div ref={observerTarget} className="infinite-scroll-trigger">
                    {loading ? 'Loading more listings...' : 'Scroll for more'}
                </div>
            )}

            {!hasMore && listings.length > 0 && (
                <div className="end-message">
                    You've reached the end of listings
                </div>
            )}
        </div>
    );
}

export default HomeComponents;

// ============================================================================

/**
 * EXAMPLE: OwnerDashboard.js (Pagination Controls Implementation)
 * Shows how to implement pagination controls for the owner dashboard
 */

import React, { useEffect, useState } from 'react';
import ListingsAPI from '../services/listingsAPI';
import usePagination from '../hooks/usePagination';
import PaginationControls from './PaginationControls';

function OwnerDashboard() {
    const ITEMS_PER_PAGE = 20;

    // Fetcher for pagination
    const fetcher = async (page, limit) => {
        return await ListingsAPI.getOwnerListings(page, limit);
    };

    const { data: listings, page, pages, total, loading, error, goToPage } = usePagination(
        fetcher,
        1,
        ITEMS_PER_PAGE
    );

    return (
        <div className="owner-dashboard">
            <h1>My Listings</h1>

            {loading && <div className="loading">Loading...</div>}

            {error && (
                <div className="error-message">
                    {error}
                    <button onClick={() => goToPage(1)}>Retry</button>
                </div>
            )}

            {!loading && listings.length === 0 ? (
                <div className="no-listings">
                    You haven't created any listings yet.
                    <button>Create First Listing</button>
                </div>
            ) : (
                <>
                    <table className="listings-table">
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Category</th>
                                <th>Price</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {listings.map((listing) => (
                                <tr key={listing.id}>
                                    <td>{listing.title}</td>
                                    <td>{listing.category}</td>
                                    <td>₹{listing.price}</td>
                                    <td>
                                        <span className={`status status-${listing.status}`}>
                                            {listing.status}
                                        </span>
                                    </td>
                                    <td>
                                        <button>Edit</button>
                                        <button>Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Pagination Controls */}
                    <PaginationControls
                        page={page}
                        pages={pages}
                        total={total}
                        loading={loading}
                        onPageChange={goToPage}
                        showItemsPerPage={false}
                    />
                </>
            )}
        </div>
    );
}

export default OwnerDashboard;

// ============================================================================

/**
 * EXAMPLE: ReelsPage.js (Infinite Scroll for Videos)
 * Shows how to implement infinite scroll for video feed
 */

import React from 'react';
import ListingsAPI from '../services/listingsAPI';
import useInfiniteScroll from '../hooks/useInfiniteScroll';
import VideoCard from './reels/VideoCard'; // Your existing video component

function ReelsPage() {
    const fetcher = async (page, limit) => {
        return await ListingsAPI.getVideoFeed(page, limit);
    };

    const { data: videos, loading, hasMore, observerTarget, error } = useInfiniteScroll(
        fetcher,
        12 // items per page for videos
    );

    return (
        <div className="reels-page">
            <h1>Trending Reels</h1>

            <div className="reels-grid">
                {videos.length === 0 && !loading ? (
                    <div className="no-videos">No videos available</div>
                ) : (
                    videos.map((video) => (
                        <VideoCard key={video.id} video={video} />
                    ))
                )}

                {error && (
                    <div className="error-message">
                        Failed to load videos: {error}
                    </div>
                )}
            </div>

            {/* Infinite Scroll Trigger */}
            <div ref={observerTarget} className="load-more-trigger">
                {loading && <div className="loading-spinner">Loading more videos...</div>}
                {hasMore && !loading && <div>Scroll for more videos</div>}
                {!hasMore && videos.length > 0 && <div className="end-message">No more videos</div>}
            </div>
        </div>
    );
}

export default ReelsPage;

// ============================================================================

/**
 * EXAMPLE: WishlistPage.js (Pagination for Wishlist)
 * Shows how to implement pagination for user's wishlist
 */

import React from 'react';
import ListingsAPI from '../services/listingsAPI';
import usePagination from '../hooks/usePagination';
import PaginationControls from './PaginationControls';

function WishlistPage() {
    const fetcher = async (page, limit) => {
        return await ListingsAPI.getWishlist(page, limit);
    };

    const { data: wishlistItems, page, pages, total, loading, error, goToPage } = usePagination(
        fetcher,
        1,
        20
    );

    return (
        <div className="wishlist-container">
            <h1>My Wishlist ({total} items)</h1>

            {loading && !wishlistItems.length ? (
                <div className="loading">Loading wishlist...</div>
            ) : error ? (
                <div className="error-message">{error}</div>
            ) : wishlistItems.length === 0 ? (
                <div className="empty-wishlist">
                    <p>Your wishlist is empty</p>
                    <p>Start adding listings you love!</p>
                    <button onClick={() => window.location.href = '/'}>Explore Listings</button>
                </div>
            ) : (
                <>
                    <div className="wishlist-grid">
                        {wishlistItems.map((listing) => (
                            <ListingCard
                                key={listing.id}
                                listing={listing}
                                showWishlistButton={true}
                            />
                        ))}
                    </div>

                    <PaginationControls
                        page={page}
                        pages={pages}
                        total={total}
                        loading={loading}
                        onPageChange={goToPage}
                        showItemsPerPage={false}
                    />
                </>
            )}
        </div>
    );
}

export default WishlistPage;

// ============================================================================

/**
 * IMPLEMENTATION SUMMARY
 * 
 * 1. Infinite Scroll Pattern (Use for: Home, ReelsPage, feed-style pages)
 *    - Data accumulates as user scrolls
 *    - Better UX for discovery/browsing
 *    - Automatic loading at bottom of page
 * 
 * 2. Pagination Pattern (Use for: Dashboard, Wishlist, search results)
 *    - User controls page navigation
 *    - Better for finding specific items
 *    - Explicit Previous/Next buttons
 * 
 * 3. Common Props & Methods:
 *    Infinite Scroll: { data, loading, hasMore, observerTarget, error, reset }
 *    Pagination: { data, page, pages, total, loading, error, goToPage, nextPage, prevPage }
 * 
 * 4. Performance Tips:
 *    - Memoize ListingCard components
 *    - Use React.lazy() for heavy components
 *    - Virtual scroll for very long lists (react-window library)
 *    - Cancel previous requests if new request fired (AbortController)
 */
