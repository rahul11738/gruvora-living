"""
Frontend Integration Guide - API Pagination Migration
Purpose: Update React components to leverage new pagination capabilities

Key Changes:
1. Pass page/limit query params to API endpoints
2. Parse pagination metadata from responses
3. Update pagination UI components
4. Implement infinite scroll OR pagination controls
"""

# ============================================================================
# MIGRATION REFERENCE
# ============================================================================

"""
BEFORE (No pagination):
  GET /api/listings?category=homestay
  Response: {"listings": [...100 items...]}

AFTER (With pagination):
  GET /api/listings?category=homestay&page=1&limit=20
  Response: {
    "listings": [...20 items...],
    "total": 250,
    "page": 1,
    "pages": 13
  }
"""

# ============================================================================
# API SERVICE PATTERN
# ============================================================================

"""
Create/Update frontend/src/services/listingsAPI.js:

import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

class ListingsAPI {
  // Main feed with pagination
  static async getListings(filters = {}, page = 1, limit = 20) {
    const params = {
      ...filters,
      page,
      limit
    };
    const response = await axios.get(`${API_BASE}/listings`, { params });
    return response.data; // { listings, total, page, pages }
  }

  // Trending with pagination
  static async getTrendingListings(page = 1, limit = 10) {
    const response = await axios.get(`${API_BASE}/trending-listings`, {
      params: { page, limit }
    });
    return response.data; // { listings, total, page, pages }
  }

  // Recommended with pagination
  static async getRecommendedListings(page = 1, limit = 12) {
    const response = await axios.get(`${API_BASE}/recommended-listings`, {
      params: { page, limit }
    });
    return response.data;
  }

  // Nearby with pagination
  static async getNearbyListings(
    latitude, 
    longitude, 
    radius = 5, 
    page = 1, 
    limit = 15
  ) {
    const response = await axios.get(`${API_BASE}/nearby-listings`, {
      params: { latitude, longitude, radius, page, limit }
    });
    return response.data;
  }

  // Map view with pagination
  static async getMapListings(bounds, page = 1, limit = 50) {
    const response = await axios.get(`${API_BASE}/map-listings`, {
      params: { ...bounds, page, limit }
    });
    return response.data;
  }

  // Wishlist with pagination
  static async getWishlist(page = 1, limit = 20) {
    const response = await axios.get(`${API_BASE}/wishlist`, {
      params: { page, limit }
    });
    return response.data;
  }

  // Owner dashboard listings
  static async getOwnerListings(page = 1, limit = 20) {
    const response = await axios.get(`${API_BASE}/owner/listings`, {
      params: { page, limit }
    });
    return response.data;
  }

  // Video feed with pagination
  static async getVideos(page = 1, limit = 20) {
    const response = await axios.get(`${API_BASE}/videos`, {
      params: { page, limit }
    });
    return response.data;
  }

  // Video feed (reels)
  static async getVideoFeed(page = 1, limit = 12) {
    const response = await axios.get(`${API_BASE}/video-feed`, {
      params: { page, limit }
    });
    return response.data;
  }

  // Saved videos with pagination
  static async getSavedVideos(page = 1, limit = 20) {
    const response = await axios.get(`${API_BASE}/saved-videos`, {
      params: { page, limit }
    });
    return response.data;
  }
}

export default ListingsAPI;
"""

# ============================================================================
# COMPONENT PATTERN - INFINITE SCROLL
# ============================================================================

"""
Use this pattern for mobile/feed-style components (HomeComponents, ReelsPage):

import { useState, useEffect, useCallback, useRef } from 'react';
import ListingsAPI from '../services/listingsAPI';

function ListingsFeed() {
  const [listings, setListings] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  
  const observerTarget = useRef(null);

  // Load more listings
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    
    setLoading(true);
    try {
      const data = await ListingsAPI.getListings({}, page, 20);
      
      setListings(prev => [...prev, ...data.listings]);
      setPage(prev => prev + 1);
      setHasMore(page < data.pages); // Stop when reached last page
    } catch (error) {
      console.error('Failed to load listings:', error);
    } finally {
      setLoading(false);
    }
  }, [page, loading, hasMore]);

  // Infinite scroll effect
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.5 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [loadMore, hasMore, loading]);

  // Initial load
  useEffect(() => {
    loadMore();
  }, []); // Only on mount

  return (
    <div>
      <div className="listings-grid">
        {listings.map(listing => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>
      
      {hasMore && (
        <div ref={observerTarget} className="loading-indicator">
          Loading more listings...
        </div>
      )}
      
      {!hasMore && listings.length > 0 && (
        <div className="end-message">No more listings to load</div>
      )}
    </div>
  );
}

export default ListingsFeed;
"""

# ============================================================================
# COMPONENT PATTERN - PAGINATION CONTROLS
# ============================================================================

"""
Use this pattern for dashboard-style components (OwnerDashboard, AdminDashboard):

import { useState, useEffect } from 'react';
import ListingsAPI from '../services/listingsAPI';

function OwnerListingsDashboard() {
  const [listings, setListings] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const ITEMS_PER_PAGE = 20;

  // Load listings for current page
  const loadListings = async (pageNum) => {
    setLoading(true);
    try {
      const data = await ListingsAPI.getOwnerListings(pageNum, ITEMS_PER_PAGE);
      
      setListings(data.listings);
      setTotal(data.total);
      setPages(data.pages);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to load listings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadListings(1);
  }, []);

  return (
    <div>
      <h2>My Listings ({total} total)</h2>
      
      {loading && <div className="loading">Loading...</div>}
      
      {!loading && (
        <>
          <table className="listings-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {listings.map(listing => (
                <tr key={listing.id}>
                  <td>{listing.title}</td>
                  <td>{listing.status}</td>
                  <td>
                    <button>Edit</button>
                    <button>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination Controls */}
          <div className="pagination">
            <button
              disabled={page === 1}
              onClick={() => loadListings(page - 1)}
            >
              Previous
            </button>
            
            <span>
              Page {page} of {pages}
            </span>
            
            <button
              disabled={page === pages}
              onClick={() => loadListings(page + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default OwnerListingsDashboard;
"""

# ============================================================================
# COMPONENT PATTERN - WISHLIST PAGINATION
# ============================================================================

"""
Use this pattern for wishlist component:

import { useState, useEffect } from 'react';
import ListingsAPI from '../services/listingsAPI';

function WishlistPage() {
  const [wishlistItems, setWishlistItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const loadWishlist = async (pageNum) => {
    setLoading(true);
    try {
      const data = await ListingsAPI.getWishlist(pageNum, 20);
      
      setWishlistItems(data.listings);
      setTotal(data.total);
      setPages(data.pages);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to load wishlist:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWishlist(1);
  }, []);

  return (
    <div className="wishlist-container">
      <h1>My Wishlist ({total} items)</h1>
      
      {wishlistItems.length === 0 ? (
        <p>Your wishlist is empty</p>
      ) : (
        <>
          <div className="wishlist-grid">
            {wishlistItems.map(listing => (
              <WishlistCard key={listing.id} listing={listing} />
            ))}
          </div>

          {pages > 1 && (
            <div className="pagination-container">
              <button
                disabled={page === 1}
                onClick={() => loadWishlist(page - 1)}
              >
                ← Previous
              </button>
              
              <span className="page-info">
                Page {page} of {pages}
              </span>
              
              <button
                disabled={page === pages}
                onClick={() => loadWishlist(page + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default WishlistPage;
"""

# ============================================================================
# STYLING REFERENCE - PAGINATION CONTROLS
# ============================================================================

"""
Add to frontend/src/styles/pagination.css:

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 2rem;
  padding: 1rem;
  border-top: 1px solid #e0e0e0;
}

.pagination button {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.pagination button:hover:not(:disabled) {
  background: #f0f0f0;
  border-color: #999;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-container {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1.5rem;
  margin-top: 2rem;
  padding: 1.5rem;
}

.page-info {
  font-size: 0.95rem;
  color: #666;
  min-width: 150px;
  text-align: center;
}

/* Responsive */
@media (max-width: 768px) {
  .pagination {
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .pagination button {
    padding: 0.4rem 0.8rem;
    font-size: 0.9rem;
  }

  .page-info {
    font-size: 0.85rem;
    min-width: 120px;
  }
}
"""

# ============================================================================
# TESTING CHECKLIST
# ============================================================================

"""
✅ Frontend Integration Checklist:

1. API Service Layer
   - [ ] Create frontend/src/services/listingsAPI.js
   - [ ] Add pagination params to all 9 methods
   - [ ] Test with curl/Postman first
   
2. Feed Components (Infinite Scroll)
   - [ ] HomeComponents.js - Main listings feed
   - [ ] ReelsPage.js - Video feed
   - [ ] Implement IntersectionObserver
   - [ ] Test: Scroll down, new items load
   
3. Dashboard Components (Pagination Controls)
   - [ ] OwnerDashboard.js - Owner listings
   - [ ] AdminDashboard.js - Admin listings
   - [ ] Add Previous/Next buttons
   - [ ] Test: Click buttons, page changes
   
4. User-Specific Components
   - [ ] WishlistPage.js - User wishlist
   - [ ] SettingsPage.js - Saved items
   - [ ] Update with pagination metadata
   
5. Performance Verification
   - [ ] Open DevTools Network tab
   - [ ] Verify limit query param is sent
   - [ ] Verify response includes {items, total, page, pages}
   - [ ] Measure Time to Interactive (TTI)
   
6. Error Handling
   - [ ] Handle network errors gracefully
   - [ ] Show loading states
   - [ ] Show "No more items" when at last page
   
7. Mobile Testing
   - [ ] Test infinite scroll on mobile
   - [ ] Verify pagination buttons are touch-friendly
   - [ ] Test with reduced data (simulate slow network)
"""

# ============================================================================
# QUICK START COMMANDS
# ============================================================================

"""
1. Test API responses (before frontend changes):
   curl "http://localhost:8000/api/listings?page=1&limit=20"
   
2. Expected response:
   {
     "listings": [...20 items...],
     "total": 312,
     "page": 1,
     "pages": 16
   }

3. Test another page:
   curl "http://localhost:8000/api/listings?page=2&limit=20"

4. After frontend updates, test in browser console:
   fetch('/api/listings?page=1&limit=20')
     .then(r => r.json())
     .then(d => console.log(d.total, d.pages))
"""
