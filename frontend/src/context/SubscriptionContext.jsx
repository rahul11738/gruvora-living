import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { subscriptionAPI } from '../lib/api';

const SubscriptionContext = createContext(null);

export const useSubscription = () => useContext(SubscriptionContext);

export const SubscriptionProvider = ({ children }) => {
  const { user, isAuthenticated, isOwner } = useAuth();
  const [subData, setSubData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!isAuthenticated || !isOwner || user?.role === 'admin') {
      setSubData(null);
      return;
    }

    setLoading(true);
    try {
      const response = await subscriptionAPI.getStatus();
      // Always set the response data even if status is expired/pending/blocked
      // The response should contain has_subscription, status, model fields
      setSubData(response.data || { status: 'pending', has_subscription: false, model: 'subscription' });
    } catch (error) {
      // On error, set a default fallback object instead of null
      // This prevents "Subscription data unavailable" from showing for valid users
      console.error('Subscription fetch error:', error);
      setSubData({ status: 'pending', has_subscription: false, model: 'subscription', error: true });
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
  const needsPayment = (isPending || isExpired || isBlocked) && !isCommissionModel;
  const trialDaysLeft = subData?.trial_days_remaining ?? null;

  return (
    <SubscriptionContext.Provider
      value={{
        subData,
        loading,
        fetchStatus,
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
