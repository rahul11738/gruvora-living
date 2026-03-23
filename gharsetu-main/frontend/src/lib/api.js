import axios from 'axios';

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
});

api.interceptors.request.use((config) => {
  if (!process.env.REACT_APP_BACKEND_URL && typeof window !== 'undefined') {
    const effectiveBaseUrl = config.baseURL || `${activeBackendUrl}/api`;
    if (!config.url?.startsWith('http')) {
      config.baseURL = effectiveBaseUrl;
    }
  }

  const token = localStorage.getItem('gharsetu_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ✅ Auto token refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {};

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
};

// Listings APIs
export const listingsAPI = {
  getAll: (params) => api.get('/listings', { params }),
  smartSearch: (query, params = {}) => api.get('/search/smart', { params: { query, ...params } }),
  suggestSearch: (query, params = {}) => api.get('/search/suggest', { params: { query, ...params } }),
  getTrending: (limit = 10, category) => api.get('/listings/trending', { params: { limit, category } }),
  getRecommended: (limit = 10) => api.get('/listings/recommended', { params: { limit } }),
  getNearby: (lat, lng, radius = 5) => api.get('/listings/nearby', { params: { lat, lng, radius } }),
  getMap: (bounds) => api.get('/listings/map', { params: bounds }),
  getHeatmap: (city) => api.get('/listings/heatmap', { params: { city } }),
  getOne: (id) => api.get(`/listings/${id}`),
  getPriceHistory: (id) => api.get(`/listings/${id}/price-history`),
  create: (data) => api.post('/listings', data),
  update: (id, data) => api.put(`/listings/${id}`, data),
  delete: (id) => api.delete(`/listings/${id}`),
  like: (id) => api.post(`/listings/${id}/like`),
  share: (id) => api.post(`/listings/${id}/share`),
  boost: (data) => api.post('/listings/boost', data),
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
  getSaved: () => api.get('/videos/saved'),
  recordView: (id) => api.post(`/videos/${id}/view`),
  upload: (formData) => api.post('/videos/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getComments: (id, page = 1) => api.get(`/videos/${id}/comments`, { params: { page } }),
  addComment: (id, comment) => api.post(`/videos/${id}/comments`, { comment }),
  deleteComment: (videoId, commentId) => api.delete(`/videos/${videoId}/comments/${commentId}`),
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
  send: (data) => api.post('/messages', data),
  getConversations: () => api.get('/messages/conversations'),
  getMessages: (conversationId, page = 1) => api.get(`/messages/conversation/${conversationId}`, { params: { page } }),
};

// Notifications APIs
export const notificationsAPI = {
  getAll: (page = 1) => api.get('/notifications', { params: { page } }),
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

// Owner APIs
export const ownerAPI = {
  getListings: (params) => api.get('/owner/listings', { params }),
  getStats: () => api.get('/owner/stats'),
  getAnalytics: (days = 30) => api.get('/owner/analytics', { params: { days } }),
};

// Admin APIs
export const adminAPI = {
  getUsers: (params) => api.get('/admin/users', { params }),
  getListings: (params) => api.get('/admin/listings', { params }),
  updateListingStatus: (id, status) => api.put(`/admin/listings/${id}/status`, null, { params: { status } }),
  verifyAadhar: (userId, status) => api.put(`/admin/users/${userId}/verify-aadhar`, null, { params: { status } }),
  getBookings: (params) => api.get('/admin/bookings', { params }),
  getStats: () => api.get('/admin/stats'),
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
};

// Subscription APIs (Service Provider)
export const subscriptionAPI = {
  createOrder: (plan = 'monthly') => api.post('/subscriptions/create-order', { plan }),
  verify: (data) => api.post('/subscriptions/verify', data),
  getStatus: () => api.get('/subscriptions/status'),
};

export default api;
