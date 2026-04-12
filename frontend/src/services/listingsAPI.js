/**
 * Listings API Service
 * Handles all API calls related to listings with pagination support
 */

import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

class ListingsAPI {
    /**
     * Get main listings feed with pagination
     * @param {Object} filters - Filter criteria (category, city, price range, etc.)
     * @param {number} page - Page number (defaults to 1)
     * @param {number} limit - Items per page (defaults to 20)
     * @returns {Promise} { listings, total, page, pages }
     */
    static async getListings(filters = {}, page = 1, limit = 20) {
        const params = {
            ...filters,
            page,
            limit
        };
        const response = await axios.get(`${API_BASE}/listings`, { params });
        return response.data;
    }

    /**
     * Get trending listings with pagination
     * @param {number} page - Page number
     * @param {number} limit - Items per page (defaults to 10)
     */
    static async getTrendingListings(page = 1, limit = 10) {
        const response = await axios.get(`${API_BASE}/trending-listings`, {
            params: { page, limit }
        });
        return response.data;
    }

    /**
     * Get recommended listings for current user
     * @param {number} page - Page number
     * @param {number} limit - Items per page (defaults to 12)
     */
    static async getRecommendedListings(page = 1, limit = 12) {
        const response = await axios.get(`${API_BASE}/recommended-listings`, {
            params: { page, limit }
        });
        return response.data;
    }

    /**
     * Get nearby listings based on location
     * @param {number} latitude - User latitude
     * @param {number} longitude - User longitude
     * @param {number} radius - Search radius in km (defaults to 5)
     * @param {number} page - Page number
     * @param {number} limit - Items per page (defaults to 15)
     */
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

    /**
     * Get listings for map view with bounds filtering
     * @param {Object} bounds - Map bounds { north, south, east, west }
     * @param {number} page - Page number
     * @param {number} limit - Items per page (defaults to 50)
     */
    static async getMapListings(bounds = {}, page = 1, limit = 50) {
        const response = await axios.get(`${API_BASE}/map-listings`, {
            params: { ...bounds, page, limit }
        });
        return response.data;
    }

    /**
     * Get user's wishlist with pagination
     * @param {number} page - Page number
     * @param {number} limit - Items per page (defaults to 20)
     */
    static async getWishlist(page = 1, limit = 20) {
        const response = await axios.get(`${API_BASE}/wishlist`, {
            params: { page, limit }
        });
        return response.data;
    }

    /**
     * Get owner's listings for dashboard
     * @param {number} page - Page number
     * @param {number} limit - Items per page (defaults to 20)
     */
    static async getOwnerListings(page = 1, limit = 20) {
        const response = await axios.get(`${API_BASE}/owner/listings`, {
            params: { page, limit }
        });
        return response.data;
    }

    /**
     * Get videos/reels list
     * @param {number} page - Page number
     * @param {number} limit - Items per page (defaults to 20)
     */
    static async getVideos(page = 1, limit = 20) {
        const response = await axios.get(`${API_BASE}/videos`, {
            params: { page, limit }
        });
        return response.data;
    }

    /**
     * Get video feed (public videos)
     * @param {number} page - Page number
     * @param {number} limit - Items per page (defaults to 12)
     */
    static async getVideoFeed(page = 1, limit = 12) {
        const response = await axios.get(`${API_BASE}/video-feed`, {
            params: { page, limit }
        });
        return response.data;
    }

    /**
     * Get user's saved videos with pagination
     * @param {number} page - Page number
     * @param {number} limit - Items per page (defaults to 20)
     */
    static async getSavedVideos(page = 1, limit = 20) {
        const response = await axios.get(`${API_BASE}/saved-videos`, {
            params: { page, limit }
        });
        return response.data;
    }

    /**
     * Get single listing details
     * @param {string} listingId - Listing ID
     */
    static async getListingDetail(listingId) {
        const response = await axios.get(`${API_BASE}/listings/${listingId}`);
        return response.data;
    }

    /**
     * Search listings with filters
     * @param {Object} searchParams - Search filters
     * @param {number} page - Page number
     * @param {number} limit - Items per page
     */
    static async searchListings(searchParams = {}, page = 1, limit = 20) {
        const params = {
            ...searchParams,
            page,
            limit
        };
        const response = await axios.get(`${API_BASE}/search/listings`, { params });
        return response.data;
    }
}

export default ListingsAPI;
