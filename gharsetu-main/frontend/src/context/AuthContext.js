import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

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

  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    const { token: newToken, user: userData } = response.data;
    localStorage.setItem('gharsetu_token', newToken);
    setToken(newToken);
    setUser(userData);
    return response.data;
  };

  const register = async (userData) => {
    const response = await axios.post(`${API}/auth/register`, userData);
    const { token: newToken, user: newUser } = response.data;
    localStorage.setItem('gharsetu_token', newToken);
    setToken(newToken);
    setUser(newUser);
    return response.data;
  };

  const registerOwner = async (ownerData) => {
    const response = await axios.post(`${API}/auth/register/owner`, ownerData);
    const { token: newToken, user: newUser } = response.data;
    localStorage.setItem('gharsetu_token', newToken);
    setToken(newToken);
    setUser(newUser);
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('gharsetu_token');
    setToken(null);
    setUser(null);
  };

  const updateProfile = async (updates) => {
    await axios.put(`${API}/auth/profile`, updates, {
      headers: { Authorization: `Bearer ${token}` }
    });
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
