import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authAPI, isBackendUnavailableError } from '../lib/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('gharsetu_token'));
  const [loading, setLoading] = useState(true);
  const lastFetchAttemptRef = useRef(0);

  const logout = useCallback(() => {
    localStorage.removeItem('gharsetu_token');
    setToken(null);
    setUser(null);
  }, []);

  const fetchUser = useCallback(async () => {
    const now = Date.now();
    // Prevent tight retry loops when backend is temporarily down.
    if (now - lastFetchAttemptRef.current < 8000) {
      setLoading(false);
      return;
    }
    lastFetchAttemptRef.current = now;

    const MAX_RETRIES = 2;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await authAPI.getMe();
        setUser(response.data);
        setLoading(false);
        return;
      } catch (error) {
        const status = error?.response?.status;
        if (status === 401 || status === 403 || status === 404) {
          // Auth error - logout immediately, no retry
          console.info('Session expired or invalid token. Logging out.');
          logout();
          setLoading(false);
          return;
        }
        if (isBackendUnavailableError(error)) {
          // Keep existing login state; avoid aggressive retries during gateway outage.
          setLoading(false);
          return;
        }
        if (attempt < MAX_RETRIES) {
          // Network/timeout error - wait and retry
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        // All retries exhausted - keep existing user state if we have one
        // (don't logout on network timeout - user may just have slow connection)
        console.error('Failed to fetch user after retries:', error);
        setLoading(false);
        return;
      }
    }
  }, [logout]);

  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [fetchUser, token]);

  const login = async (email, password) => {
    const response = await authAPI.login({ email, password });
    const { token: newToken, user: userData } = response.data;
    localStorage.setItem('gharsetu_token', newToken);
    setToken(newToken);
    setUser(userData);
    return response.data;
  };

  const register = async (userData) => {
    const response = await authAPI.register(userData);
    const { token: newToken, user: newUser } = response.data;
    localStorage.setItem('gharsetu_token', newToken);
    setToken(newToken);
    setUser(newUser);
    return response.data;
  };

  const registerOwner = async (ownerData) => {
    const response = await authAPI.registerOwner(ownerData);
    const { token: newToken, user: newUser } = response.data;
    localStorage.setItem('gharsetu_token', newToken);
    setToken(newToken);
    setUser(newUser);
    return response.data;
  };

  const updateProfile = async (updates) => {
    await authAPI.updateProfile(updates);
    await fetchUser();
  };

  // Role checks
  const normalizeRole = (role) => role?.toLowerCase()?.replace(/\s+/g, '_') || '';
  const currentRole = normalizeRole(user?.role);

  const isOwner = ['property_owner', 'stay_owner', 'service_provider', 'hotel_owner', 'event_owner', 'admin'].includes(currentRole);
  const isAdmin = currentRole === 'admin';
  const isPropertyOwner = currentRole === 'property_owner';
  const isStayOwner = currentRole === 'stay_owner';
  const isServiceProvider = currentRole === 'service_provider';
  const isHotelOwner = currentRole === 'hotel_owner';
  const isEventOwner = currentRole === 'event_owner';

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!user,
    isOwner,
    isAdmin,
    isPropertyOwner,
    isStayOwner,
    isServiceProvider,
    isHotelOwner,
    isEventOwner,
    login,
    register,
    registerOwner,
    logout,
    updateProfile,
    refreshUser: fetchUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
