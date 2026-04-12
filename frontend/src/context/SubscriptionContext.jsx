import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { subscriptionAPI } from '../lib/api';

const SubscriptionContext = createContext(null);
const CACHE_KEY = 'gruvora_sub_status';

export const useSubscription = () => useContext(SubscriptionContext);

// Build a minimal subData object from the user record (available immediately after login)
const subDataFromUser = (user) => {
  if (!user) return null;
  const status = user.subscription_status || 'pending';
  const hasActive = status === 'active' || status === 'trial';
  return {
    status,
    has_subscription: hasActive,
    subscription_plan: user.subscription_plan || 'basic',
    next_billing_date: user.next_billing_date || null,
    last_payment_date: user.last_payment_date || null,
    trial_end_date: user.trial_end_date || null,
    block_status: user.block_status || null,
    model: 'subscription',
    _fromUser: true, // flag so we know this is a seed, not a full status fetch
  };
};

const readCache = (userId) => {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY}_${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Cache valid for 5 minutes
    if (Date.now() - (parsed._cachedAt || 0) > 5 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeCache = (userId, data) => {
  try {
    localStorage.setItem(`${CACHE_KEY}_${userId}`, JSON.stringify({ ...data, _cachedAt: Date.now() }));
  } catch { /* storage full - ignore */ }
};

const clearCache = (userId) => {
  try { localStorage.removeItem(`${CACHE_KEY}_${userId}`); } catch { /* ignore */ }
};

export const SubscriptionProvider = ({ children }) => {
  const { user, isAuthenticated, isOwner } = useAuth();
  const [subData, setSubData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Seed from user object or cache immediately when user changes (no network needed)
  useEffect(() => {
    if (!isAuthenticated || !isOwner || user?.role === 'admin') {
      setSubData(null);
      return;
    }
    // Try cache first (survives logout/login within 5 min)
    const cached = readCache(user.id);
    if (cached) {
      setSubData(cached);
      return;
    }
    // Fall back to user object fields from login response
    const seed = subDataFromUser(user);
    if (seed) setSubData(seed);
  }, [user?.id, isAuthenticated, isOwner, user?.role]);

  const updateSubData = useCallback((newData) => {
    setSubData(prev => {
      const merged = { ...prev, ...newData };
      if (user?.id) writeCache(user.id, merged);
      return merged;
    });
  }, [user?.id]);

  const fetchStatus = useCallback(async () => {
    if (!isAuthenticated || !isOwner || user?.role === 'admin') {
      setSubData(null);
      return;
    }

    setLoading(true);
    try {
      const response = await subscriptionAPI.getStatus();
      if (response.data?.error) {
        console.warn('Backend subscription status warning:', response.data.error);
      }
      const incoming = response.data || { status: 'pending', has_subscription: false, model: 'subscription' };

      setSubData(prev => {
        // Never downgrade an already-active status (race condition guard)
        if (prev?.status === 'active' && incoming.status !== 'active' && prev?._fromUser !== true) {
          return prev;
        }
        if (user?.id) writeCache(user.id, incoming);
        return incoming;
      });
    } catch (error) {
      console.error('Subscription fetch error:', error);
      // Keep existing data on error - don't wipe a valid active status
      setSubData(prev => prev || { status: 'pending', has_subscription: false, model: 'subscription', error: true });
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isOwner, user?.id, user?.role]);

  // Fetch fresh status from server on mount (after seed is set)
  useEffect(() => {
    if (!isAuthenticated || !isOwner || user?.role === 'admin') return;
    fetchStatus();
  }, [fetchStatus]);

  // Clear cache on logout
  useEffect(() => {
    if (!isAuthenticated && user === null) {
      // user just logged out - clear all sub caches
      try {
        Object.keys(localStorage)
          .filter(k => k.startsWith(CACHE_KEY))
          .forEach(k => localStorage.removeItem(k));
      } catch { /* ignore */ }
    }
  }, [isAuthenticated, user]);

  const isBlocked = subData?.status === 'blocked';
  const isTrial = subData?.status === 'trial';
  const isActive = subData?.status === 'active';
  const isPending = subData?.status === 'pending';
  const isExpired = subData?.status === 'expired';
  const isCommissionModel = subData?.model === 'commission';
  const isHybridModel = subData?.model === 'hybrid';

  const hasActiveSubscription = isActive || isTrial;
  const needsPayment = (isPending || isExpired || isBlocked) && !isCommissionModel && !hasActiveSubscription;
  const trialDaysLeft = subData?.trial_days_remaining ?? null;

  return (
    <SubscriptionContext.Provider
      value={{
        subData,
        loading,
        fetchStatus,
        updateSubData,
        isBlocked,
        isTrial,
        isActive,
        isPending,
        isExpired,
        isCommissionModel,
        isHybridModel,
        needsPayment,
        trialDaysLeft,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};
