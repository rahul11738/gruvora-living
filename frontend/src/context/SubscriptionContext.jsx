import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { subscriptionAPI } from '../lib/api';

const SubscriptionContext = createContext(null);

export const useSubscription = () => useContext(SubscriptionContext);

export const SubscriptionProvider = ({ children }) => {
  const { user, isAuthenticated, isOwner } = useAuth();
  const [subData, setSubData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Allow direct update from payment callback (avoids CORS-prone refetch)
  const updateSubData = (newData) => setSubData(prev => ({ ...prev, ...newData }));

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
      // Never downgrade an already-active status from an optimistic update
      // (can happen if DB read-after-write returns stale data right after payment)
      setSubData(prev => {
        if (prev?.status === 'active' && incoming.status !== 'active') {
          return prev;
        }
        return incoming;
      });
    } catch (error) {
      console.error('Subscription fetch error (CORS or 500):', error);
      setSubData(prev => prev || { status: 'pending', has_subscription: false, model: 'subscription', error: true });
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isOwner, user?.role]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const isBlocked = subData?.status === 'blocked';
  const isTrial = subData?.status === 'trial';
  const isActive = subData?.status === 'active';
  const isPending = subData?.status === 'pending';
  const isExpired = subData?.status === 'expired';
  const isCommissionModel = subData?.model === 'commission';
  const isHybridModel = subData?.model === 'hybrid';

  // For hybrid/commission, if they have an active sub, don't show as needing payment
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
