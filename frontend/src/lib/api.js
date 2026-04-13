import axios from 'axios';
import { generateCloudinaryVideoUrl } from './cloudinary';

const FALLBACK_LOCAL_BACKEND_URLS = [
  'http://127.0.0.1:8000',
  'http://127.0.0.1:8001',
  'http://localhost:8000',
  'http://localhost:8001',
];

const resolveInitialBackendUrl = () => {
  if (process.env.REACT_APP_BACKEND_URL) {
    return process.env.REACT_APP_BACKEND_URL;
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname || '';
    const isLocalHost = host === 'localhost' || host === '127.0.0.1';
    if (!isLocalHost) {
      // On Vercel/prod domains, route requests through same-origin rewrite
      // to avoid browser CORS preflight failures.
      return '/backend-proxy';
    }
  }

  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem('gharsetu_backend_url');
    if (stored) {
      return stored;
    }
  }

  return FALLBACK_LOCAL_BACKEND_URLS[0];
};

let activeBackendUrl = resolveInitialBackendUrl();
let backendDiscoveryPromise = null;

const setActiveBackendUrl = (nextUrl) => {
  activeBackendUrl = nextUrl;
  api.defaults.baseURL = `${activeBackendUrl}/api`;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('gharsetu_backend_url', nextUrl);
  }
};

const discoverLocalBackendUrl = async () => {
  if (process.env.REACT_APP_BACKEND_URL || typeof window === 'undefined') {
    return activeBackendUrl;
  }

  const candidateUrls = [
    activeBackendUrl,
    ...FALLBACK_LOCAL_BACKEND_URLS.filter((url) => url !== activeBackendUrl),
  ];

  for (const baseUrl of candidateUrls) {
    try {
      const response = await fetch(`${baseUrl}/api/health`, { method: 'GET' });
      if (response.ok) {
        if (baseUrl !== activeBackendUrl) {
          setActiveBackendUrl(baseUrl);
        }
        return activeBackendUrl;
      }
    } catch {
      // Try next candidate URL.
    }
  }

  return activeBackendUrl;
};

const ensureBackendDiscovered = async () => {
  if (process.env.REACT_APP_BACKEND_URL || typeof window === 'undefined') {
    return activeBackendUrl;
  }

  if (!backendDiscoveryPromise) {
    backendDiscoveryPromise = discoverLocalBackendUrl().finally(() => {
      backendDiscoveryPromise = null;
    });
  }

  return backendDiscoveryPromise;
};

const api = axios.create({
  baseURL: `${activeBackendUrl}/api`,
  timeout: 12000,
});

const CLOUDINARY_REEL_OPTIONS = {
  width: null,
  height: null,
  crop: 'fill',
  quality: 'auto',
  format: 'mp4',
};

const forceHttpsInPayload = (value) => {
  if (typeof value === 'string') {
    return value.replace('http://', 'https://');
  }

  if (Array.isArray(value)) {
    return value.map((item) => forceHttpsInPayload(item));
  }

  if (value && typeof value === 'object') {
    const next = {};
    Object.entries(value).forEach(([key, item]) => {
      next[key] = forceHttpsInPayload(item);
    });

    if (next.video_public_id) {
      next.video_url = generateCloudinaryVideoUrl(next.video_public_id, next.video_version, CLOUDINARY_REEL_OPTIONS);
      next.url = next.video_url;
    } else if (typeof next.video_url === 'string' || typeof next.url === 'string') {
      const rawVideoRef = next.video_url || next.url;
      const rebuilt = generateCloudinaryVideoUrl(rawVideoRef, next.video_version, CLOUDINARY_REEL_OPTIONS);
      if (rebuilt) {
        next.video_url = rebuilt;
        next.url = rebuilt;
      }
    }

    return next;
  }

  return value;
};

api.interceptors.request.use((config) => {
  if (!process.env.REACT_APP_BACKEND_URL && typeof window !== 'undefined') {
    const effectiveBaseUrl = config.baseURL || `${activeBackendUrl}/api`;
    if (!config.url?.startsWith('http')) {
      config.baseURL = effectiveBaseUrl;
    }
  }

  const token = localStorage.getItem('gharsetu_token');
  if (token && !config.skipAuth) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ✅ Auto token refresh on 401
api.interceptors.response.use(
  (response) => {
    response.data = forceHttpsInPayload(response.data);
    return response;
  },
  async (error) => {
    const originalRequest = error.config || {};

    const status = error.response?.status;
    const isTransientGatewayError = !status || status === 502 || status === 503 || status === 504;
    if (isTransientGatewayError && !originalRequest._gatewayRetry) {
      originalRequest._gatewayRetry = true;
      await new Promise((resolve) => setTimeout(resolve, 450));
      return api(originalRequest);
    }

    if (
      !process.env.REACT_APP_BACKEND_URL &&
      typeof window !== 'undefined' &&
      !originalRequest._backendRetried &&
      !error.response
    ) {
      originalRequest._backendRetried = true;
      await ensureBackendDiscovered();
      originalRequest.baseURL = `${activeBackendUrl}/api`;
      return api(originalRequest);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const token = localStorage.getItem('gharsetu_token');
      if (token) {
        try {
          const refreshResponse = await axios.post(
            `${activeBackendUrl}/api/auth/refresh`,
            { token },
            { headers: { 'Content-Type': 'application/json' } }
          );

          const newToken = refreshResponse.data.token;
          localStorage.setItem('gharsetu_token', newToken);
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh failed - logout
          localStorage.removeItem('gharsetu_token');
          window.location.href = '/login';
        }
      } else {
        localStorage.removeItem('gharsetu_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  registerOwner: (data) => api.post('/auth/register/owner', data),
  getMe: () => api.get('/auth/me'),
  verifyEmail: (token) => api.get(`/auth/verify/${token}`),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
};

// Listings APIs
const sanitizeListingsParams = (params = {}) => {
  const next = { ...(params || {}) };

  const normalizeOptional = (value) => {
    if (value === null || value === undefined) return undefined;
    const text = String(value).trim();
    return text.length ? text : undefined;
  };

  next.category = normalizeOptional(next.category);
  if (next.category) {
    const normalizedCategory = next.category.toLowerCase();
    if (['all', 'any', '*'].includes(normalizedCategory)) {
      next.category = undefined;
    } else if (normalizedCategory === 'hotel') {
      next.category = 'stay';
    } else {
      next.category = normalizedCategory;
    }
  }

  next.listing_type = normalizeOptional(next.listing_type);
  if (next.listing_type) {
    const normalizedListingType = next.listing_type.toLowerCase();
    next.listing_type = ['all', 'any', '*'].includes(normalizedListingType)
      ? undefined
      : normalizedListingType;
  }

  ['min_price', 'max_price', 'page', 'limit', 'lat', 'lng', 'radius'].forEach((key) => {
    const value = normalizeOptional(next[key]);
    if (value === undefined) {
      next[key] = undefined;
      return;
    }

    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      next[key] = undefined;
      return;
    }

    next[key] = key === 'page' || key === 'limit' ? Math.floor(numeric) : numeric;
  });

  const cleaned = {};
  Object.entries(next).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      cleaned[key] = value;
    }
  });
  return cleaned;
};

export const listingsAPI = {
  getAll: (params) => api.get('/listings', { params: sanitizeListingsParams(params) }),
  smartSearch: (query, params = {}) => api.get('/search/smart', { params: { query, ...params } }),
  suggestSearch: (query, params = {}) => api.get('/search/suggest', { params: { query, ...params } }),
  getTrending: (limit = 10, category) => api.get('/listings/trending', { params: { limit, category } }),
  getRecommended: (limit = 10) => api.get('/listings/recommended', { params: { limit } }),
  getNearby: (lat, lng, radius = 5) => api.get('/listings/nearby', { params: { lat, lng, radius } }),
  getDiscoverData: (bounds) => api.get('/listings/map', { params: bounds }),
  getHeatmap: (city) => api.get('/listings/heatmap', { params: { city } }),
  getOne: (id) => api.get(`/listings/${id}`),
  getPriceHistory: (id) => api.get(`/listings/${id}/price-history`),
  create: (data) => api.post('/listings', data),
  update: (id, data) => api.put(`/listings/${id}`, data),
  delete: (id) => api.delete(`/listings/${id}`),
  like: (id) => api.post(`/listings/${id}/like`),
  share: (id) => api.post(`/listings/${id}/share`),
  boost: (data) => api.post('/listings/boost', data),
  lock: (listing_id) => api.post('/lock-listing', { listing_id }),
  unlock: (listing_id) => api.post('/unlock-listing', { listing_id }),
  revealContact: (listing_id) => api.post('/listings/contact/reveal', { listing_id }),
};

// Wishlist APIs
export const wishlistAPI = {
  get: () => api.get('/wishlist'),
  add: (listingId) => api.post(`/wishlist/${listingId}`),
  remove: (listingId) => api.delete(`/wishlist/${listingId}`),
};

// Bookings APIs
export const bookingsAPI = {
  create: (data) => api.post('/bookings', data),
  getUserBookings: () => api.get('/bookings'),
  getOwnerBookings: () => api.get('/bookings/owner'),
  updateStatus: (id, status) => api.put(`/bookings/${id}/status`, null, { params: { status } }),
};

// Visits APIs
export const visitsAPI = {
  schedule: (data) => api.post('/visits/schedule', data),
  getUserVisits: () => api.get('/visits'),
  getOwnerVisits: () => api.get('/visits/owner'),
};

// Negotiations APIs
export const negotiationsAPI = {
  create: (data) => api.post('/negotiations', data),
  respond: (id, data) => api.put(`/negotiations/${id}/respond`, data),
  getUserNegotiations: () => api.get('/negotiations'),
  getOwnerNegotiations: () => api.get('/negotiations/owner'),
};

// Reviews APIs
export const reviewsAPI = {
  create: (data) => api.post('/reviews', data),
  getListingReviews: (listingId, page = 1) => api.get(`/reviews/listing/${listingId}`, { params: { page } }),
};

// Videos APIs
export const videosAPI = {
  getAll: (params) => api.get('/videos', { params }),
  getOne: (id) => api.get(`/videos/${id}`),
  getFeed: (page = 1) => api.get('/videos/feed', { params: { page } }),
  create: (data) => api.post('/videos', data),
  like: (id) => api.post(`/videos/${id}/like`),
  share: (id) => api.post(`/videos/${id}/share`),
  save: (id) => api.post(`/videos/${id}/save`),
  unsave: (id) => api.delete(`/videos/${id}/save`),
  hideReel: (id) => api.patch(`/videos/${id}/hide`),
  deleteReel: (id) => api.delete(`/videos/${id}`),
  getSaved: () => api.get('/videos/saved'),
  // View tracking should be fire-and-forget and avoid auth-preflight overhead.
  recordView: (id) => api.post(`/videos/${id}/view`, null, { skipAuth: true, timeout: 4000 }),
  upload: (formData) => api.post('/videos/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getComments: (id, page = 1) => api.get(`/videos/${id}/comments`, { params: { page } }),
  addComment: (id, comment) => api.post(`/videos/${id}/comments`, { comment }),
  deleteComment: (videoId, commentId) => api.delete(`/videos/${videoId}/comments/${commentId}`),
};

export const reelsAPI = {
  upload: (formData) => api.post('/reels/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getFeed: (params) => api.get('/reels/feed', { params }),
  getMyReels: (params) => api.get('/reels/my-reels', { params }),
  hideOwn: (id) => api.patch(`/reels/${id}/hide`),
  deleteOwn: (id) => api.delete(`/reels/${id}`),
  reportPlaybackMetric: (payload) => api.post('/reels/playback-metrics', payload, { timeout: 3000 }),
};

// Upload APIs
export const uploadAPI = {
  uploadImage: (file, folder = 'listings') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    return api.post('/upload/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  uploadImages: (files, folder = 'listings') => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    formData.append('folder', folder);
    return api.post('/upload/images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  uploadVideo: (file, title, description, category, listingId) => {
    const formData = new FormData();
    formData.append('video', file);
    formData.append('title', title);
    if (description) formData.append('description', description);
    formData.append('category', category);
    if (listingId) formData.append('listing_id', listingId);
    return api.post('/videos/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
};

// Users/Follow APIs
export const usersAPI = {
  getProfile: (id) => api.get(`/users/${id}`),
  toggleFollow: (id) => api.post(`/users/${id}/follow/toggle`),
  follow: (id) => api.post(`/users/${id}/follow`),
  unfollow: (id) => api.delete(`/users/${id}/follow`),
  getFollowers: (id) => api.get(`/users/${id}/followers`),
  getFollowing: (id) => api.get(`/users/${id}/following`),
};

export const interactionsAPI = {
  snapshot: (params) => api.get('/interactions/snapshot', { params }),
};

export const debugAPI = {
  saveReelsSession: (payload) => api.post('/debug/reels-session', payload),
};

// Messages APIs
export const messagesAPI = {
  send: (data) => api.post('/messages', {
    ...data,
    message: data?.message ?? data?.content,
  }),
  getConversations: () => api.get('/messages/conversations'),
  getMessages: (conversationId, page = 1) => api.get(`/messages/conversation/${conversationId}`, { params: { page } }),
};

export const paymentsAPI = {
  createOrder: (data) => api.post('/payments/create-order', data),
  verify: (data) => api.post('/payments/verify', data),
  getConfig: () => api.get('/payments/config'),
};

// Notifications APIs
export const notificationsAPI = {
  getAll: (page = 1, limit = 50) => api.get('/notifications', { params: { page, limit } }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};

// AI Recommendations API
export const recommendationsAPI = {
  getRecommendations: (limit = 6) => api.get('/recommendations', { params: { limit } }),
  getSimilar: (listingId, limit = 4) => api.get(`/recommendations/similar/${listingId}`, { params: { limit } }),
};

// Boost Listing API
export const boostAPI = {
  createOrder: (listingId, duration) => api.post('/listings/boost/create-order', { listing_id: listingId, duration }),
  verify: (data) => api.post('/listings/boost/verify', data),
  getStatus: (listingId) => api.get(`/listings/${listingId}/boost-status`),
};

// Chat API
export const chatAPI = {
  send: (message) => api.post('/chat', { message }),
  voiceSearch: (query) => api.post('/chat/voice', null, { params: { query } }),
};

// Search APIs
export const searchAPI = {
  addHistory: (query) => api.post('/search/history', null, { params: { query } }),
  getHistory: () => api.get('/search/history'),
};

// Categories API
export const categoriesAPI = {
  getAll: () => api.get('/categories'),
};

// Platform API
export const platformAPI = {
  getFees: () => api.get('/platform/fees'),
};

// Owner APIs
export const ownerAPI = {
  getListings: (params) => api.get('/owner/listings', { params }),
  getStats: () => api.get('/owner/stats'),
  getAnalytics: (days = 30) => api.get('/owner/analytics', { params: { days } }),
};

// Admin APIs
export const adminAPI = {
  // Legacy methods (kept for compatibility)
  getUsers: (params) => api.get('/admin/users', { params }),
  getListings: (params) => api.get('/admin/listings', { params }),
  updateListingStatus: (id, status) => api.put(`/admin/listings/${id}/status`, null, { params: { status } }),
  verifyAadhar: (userId, status) => api.put(`/admin/users/${userId}/verify-aadhar`, null, { params: { status } }),
  getBookings: (params) => api.get('/admin/bookings', { params }),
  getStats: () => api.get('/admin/stats'),
  getRevenue: () => api.get('/admin/revenue'),
  getSettings: () => api.get('/admin/settings'),
  updateSettings: (data) => api.post('/admin/settings', data),
  createAdmin: (data) => api.post('/admin/create', data),
  getMediaDeleteJobs: (params) => api.get('/admin/media-delete-jobs', { params }),
  retryMediaDeleteJob: (jobId) => api.post(`/admin/media-delete-jobs/${jobId}/retry`),
  resetRetryMediaDeleteJob: (jobId) => api.post(`/admin/media-delete-jobs/${jobId}/reset-retry`),
  // params: { action?, from_date?, to_date?, page?, limit? }
  getAuditLogs: (params) => api.get('/admin/audit-logs', { params }),
  // params: { action?, from_date?, to_date?, limit? }
  getAuditLogsCsv: (params) => api.get('/admin/audit-logs/export', { params, responseType: 'blob' }),
  // params: { stress_session_id?, user_id?, include_captures?, page?, limit? }
  getReelsDebugSessions: (params) => api.get('/admin/debug/reels-sessions', { params }),
  getChats: (params) => api.get('/admin/chats', { params }),
  getChatConversation: (conversationId, params) => api.get(`/admin/chats/${conversationId}`, { params }),

  // SaaS admin extensions
  getUserProfile: (userId) => api.get(`/admin/users/${userId}/profile`),
  verifyEmail: (userId) => api.post(`/admin/users/${userId}/verify-email`),
  blockUser: (userId, data) => api.post(`/admin/users/${userId}/block`, data),
  unblockUser: (userId) => api.post(`/admin/users/${userId}/unblock`),
  deleteUser: (userId, reason) => api.delete(`/admin/users/${userId}`, { params: { reason } }),
  getPendingOwners: (params) => api.get('/admin/owners/pending', { params }),
  verifyOwnerAadhar: (userId, data) => api.put(`/admin/owners/${userId}/verify-aadhar`, data),
  getPendingListings: (params) => api.get('/admin/listings/pending', { params }),
  updateListingStatusV2: (id, status, reason) =>
    api.put(`/admin/listings/${id}/status`, null, { params: { status, reason } }),
  removeListing: (listingId, reason) => api.delete(`/admin/listings/${listingId}`, { params: { reason } }),
  sendNotification: (data) => api.post('/admin/notifications/send', data),
  getSentNotifications: (params) => api.get('/admin/notifications/sent', { params }),
  getActivityLogs: (params) => api.get('/admin/activity-logs', { params }),
  getUserReels: (userId, params) => api.get(`/admin/reels/user/${userId}`, { params }),
  hideReel: (reelId) => api.patch(`/admin/reels/${reelId}/hide`),
  deleteReel: (reelId) => api.delete(`/admin/reels/${reelId}`),
};

// Subscription APIs (Service Provider)
export const subscriptionAPI = {
  createOrder: (plan = 'monthly') => api.post('/subscriptions/create-order', { plan }),
  verify: (data) => api.post('/subscriptions/verify', data),
  getStatus: () => api.get('/subscriptions/status'),
  validateCoupon: (data) => api.post('/subscriptions/coupon/validate', data),
  toggleAutoRenew: () => api.put('/subscriptions/auto-renew'),
  getInvoices: () => api.get('/subscriptions/invoices'),
  selfRepair: () => api.post('/subscriptions/self-repair'),
};

export default api;
