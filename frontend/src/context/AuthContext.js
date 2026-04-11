import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../lib/api';

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

  const logout = useCallback(() => {
    localStorage.removeItem('gharsetu_token');
    setToken(null);
    setUser(null);
  }, []);

  const fetchUser = useCallback(async () => {
    try {
      const response = await authAPI.getMe();
      setUser(response.data);
    } catch (error) {
      const status = error?.response?.status;
      if (status === 401) {
        console.info('Session expired or invalid token. Logging out.');
      } else {
        console.error('Failed to fetch user:', error);
      }
      logout();
    } finally {
      setLoading(false);
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
  const isOwner = user?.role && ['property_owner', 'service_provider', 'hotel_owner', 'event_owner', 'admin'].includes(user.role);
  const isAdmin = user?.role === 'admin';
  const isPropertyOwner = user?.role === 'property_owner';
  const isServiceProvider = user?.role === 'service_provider';
  const isHotelOwner = user?.role === 'hotel_owner';
  const isEventOwner = user?.role === 'event_owner';

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!user,
    isOwner,
    isAdmin,
    isPropertyOwner,
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
