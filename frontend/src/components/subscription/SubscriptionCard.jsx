import { useState } from 'react';
import { useSubscription } from '../../context/SubscriptionContext';
import { useAuth } from '../../context/AuthContext';
import { subscriptionAPI } from '../../lib/api';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Check,
  Clock,
  Crown,
  FileText,
  RefreshCw,
  Shield,
  Zap,
} from 'lucide-react';

const STATUS_CONFIG = {
  trial: { color: 'bg-blue-100 text-blue-700', icon: Zap, label: 'Free Trial' },
  active: { color: 'bg-green-100 text-green-700', icon: Check, label: 'Active' },
  expired: { color: 'bg-red-100 text-red-700', icon: AlertTriangle, label: 'Expired' },
  blocked: { color: 'bg-red-100 text-red-700', icon: AlertTriangle, label: 'Suspended' },
  pending: { color: 'bg-yellow-100 text-yellow-700', icon: Clock, label: 'Payment Pending' },
};

const PlanDetails = ({ subData, onPay, paying, role: rawRole }) => {
  const role = rawRole?.toLowerCase()?.replace(/\s+/g, '_') || '';
  const plan = subData?.subscription_plan || 'basic';
  const isPro = plan === 'pro' || plan === 'unlimited';

  if (role === 'service_provider') {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4">
          {/* Basic Plan */}
          <div className={`p-4 rounded-xl border-2 transition-all ${plan === 'service_basic' ? 'border-primary bg-primary/5' : 'border-stone-100 bg-stone-50'}`}>
            <div className="flex justify-between items-start mb-2">
              <div>
                <h4 className="font-bold text-stone-900">Basic Plan</h4>
                <p className="text-xs text-muted-foreground">Stay active on the platform</p>
              </div>
              <span className="font-bold text-lg">₹50/mo</span>
            </div>
            <ul className="text-xs space-y-1.5 text-stone-600 mb-4">
              <li className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-500" /> Listing visible</li>
              <li className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-500" /> 1 reel upload per week</li>
              <li className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-500" /> Basic profile badge</li>
            </ul>
            {plan !== 'service_basic' && (
              <Button onClick={() => onPay('service_basic')} disabled={paying} variant="outline" className="w-full text-xs h-8">
                Choose Basic
              </Button>
            )}
          </div>

          {/* Verified Plan */}
          <div className={`p-4 rounded-xl border-2 transition-all ${plan === 'service_verified' ? 'border-primary bg-primary/5' : 'border-stone-100 bg-stone-50'}`}>
            <div className="flex justify-between items-start mb-2">
              <div>
                <h4 className="font-bold text-stone-900">Verified Plan</h4>
                <p className="text-xs text-muted-foreground">Build trust with customers</p>
              </div>
              <span className="font-bold text-lg">₹99/mo</span>
            </div>
            <ul className="text-xs space-y-1.5 text-stone-600 mb-4">
              <li className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-500" /> Verified by Gruvora badge</li>
              <li className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-500" /> 2 reel uploads per week</li>
              <li className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-500" /> Higher search visibility</li>
            </ul>
            {plan !== 'service_verified' && (
              <Button onClick={() => onPay('service_verified')} disabled={paying} className="w-full text-xs h-8 btn-primary">
                Upgrade to Verified
              </Button>
            )}
          </div>

          {/* Top Listing Plan */}
          <div className={`p-4 rounded-xl border-2 transition-all ${plan === 'service_top' ? 'border-amber-500 bg-amber-50' : 'border-stone-100 bg-stone-50'}`}>
            <div className="flex justify-between items-start mb-2">
              <div>
                <h4 className="font-bold text-stone-900">Top Listing Plan</h4>
                <p className="text-xs text-muted-foreground">Maximum visibility & ranking</p>
              </div>
              <span className="font-bold text-lg">₹149/mo</span>
            </div>
            <ul className="text-xs space-y-1.5 text-stone-600 mb-4">
              <li className="flex items-center gap-2"><Check className="w-3 h-3 text-amber-500" /> Top 5 search position</li>
              <li className="flex items-center gap-2"><Check className="w-3 h-3 text-amber-500" /> Area priority ranking</li>
              <li className="flex items-center gap-2"><Check className="w-3 h-3 text-amber-500" /> Priority support</li>
            </ul>
            {plan !== 'service_top' && (
              <Button onClick={() => onPay('service_top')} disabled={paying} className="w-full text-xs h-8 bg-amber-500 hover:bg-amber-600 text-white">
                Choose Top Listing
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (role === 'property_owner') {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-xl border-2 border-primary bg-primary/5">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h4 className="font-bold text-stone-900">Professional Owner Plan</h4>
              <p className="text-xs text-muted-foreground">Unlimited listings + Featured visibility</p>
            </div>
            <span className="font-bold text-lg">₹999/mo</span>
          </div>
          <ul className="text-sm space-y-2 text-stone-600 mb-6 mt-4">
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Post unlimited listings</li>
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Featured placement in search</li>
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Verified owner badge</li>
            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-500" /> Priority customer leads</li>
          </ul>
          
          <Button 
            onClick={() => onPay('unlimited')} 
            disabled={paying || subData.status === 'active'} 
            className="w-full btn-primary h-11"
          >
            {paying ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
            {subData.status === 'active' ? 'Plan Active' : (subData.status === 'trial' ? 'Activate Professional Plan (₹999)' : 'Pay Now (₹999)')}
          </Button>
          {subData.status === 'trial' && (
            <p className="text-[10px] text-center text-muted-foreground mt-2 italic">
              * Activating now will secure your featured placement immediately.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Default for others (Stay, Hotel, Event - if they are not in commission or hybrid)
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 bg-stone-50 rounded-xl border border-stone-200">
        <div>
          <p className="text-sm font-semibold text-stone-900 capitalize">{plan} Plan</p>
          <p className="text-xs text-muted-foreground">
            {isPro ? 'Unlimited listings + Featured placement' : 'Basic listing visibility'}
          </p>
        </div>
        <Badge variant={isPro ? 'default' : 'outline'} className={isPro ? 'bg-amber-100 text-amber-700 border-amber-200' : ''}>
          {isPro && <Crown className="w-3 h-3 mr-1" />}
          {isPro ? 'Pro' : 'Basic'}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="p-3 bg-white rounded-lg border">
          <p className="text-xs text-muted-foreground">Monthly Fee</p>
          <p className="font-semibold">{subData.price || (isPro ? '₹499' : '₹199')}/mo</p>
        </div>
        <div className="p-3 bg-white rounded-lg border">
          <p className="text-xs text-muted-foreground">Next Billing</p>
          <p className="font-semibold">
            {subData.next_billing_date ? new Date(subData.next_billing_date).toLocaleDateString('en-IN') : 'Due Now'}
          </p>
        </div>
      </div>

      {(subData.status !== 'active' && subData.status !== 'trial') && (
        <Button onClick={() => onPay(isPro ? 'pro' : 'basic')} disabled={paying} className="w-full btn-primary h-11">
          {paying ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
          Pay {subData.price || (isPro ? '₹499' : '₹199')}
        </Button>
      )}
    </div>
  );
};

export default function SubscriptionCard({ onPaymentSuccess }) {
  const { user } = useAuth();
  const { subData, loading, fetchStatus, updateSubData, isCommissionModel, isHybridModel, needsPayment, isBlocked, trialDaysLeft } = useSubscription();
  const [paying, setPaying] = useState(false);

  const handlePay = async (plan = 'monthly') => {
    if (!window.Razorpay) {
      toast.error('Payment gateway not loaded');
      return;
    }

    setPaying(true);
    try {
      const orderRes = await subscriptionAPI.createOrder(plan);
      const { order_id, amount, key_id } = orderRes.data;

      await new Promise((resolve, reject) => {
        const razorpay = new window.Razorpay({
          key: key_id,
          amount,
          currency: 'INR',
          name: 'GharSetu',
          description: `Monthly Subscription - ₹${amount / 100}`,
          order_id,
          handler: async (response) => {
            try {
              const verifyRes = await subscriptionAPI.verify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });

              // CRITICAL FIX: Force fetch fresh subscription status from server after payment
              // This ensures we get the actual 'active' status from the DB, not cached data
              await fetchStatus();

              // Get the updated subscription data from the fresh fetch
              const updatedSub = verifyRes?.data?.subscription;
              if (updatedSub && updatedSub.status === 'active') {
                updateSubData({
                  status: 'active',
                  has_subscription: true,
                  subscription_plan: updatedSub.subscription_plan || plan,
                  subscription_amount_paise: updatedSub.subscription_amount_paise,
                });
              } else {
                // Still mark as active to allow listing immediately
                updateSubData({
                  status: 'active',
                  has_subscription: true,
                  subscription_plan: plan,
                });
              }

              toast.success('🎉 Subscription activated! You can now list properties.');

              // Notify parent component to refresh subscription status
              if (onPaymentSuccess) {
                onPaymentSuccess();
              }

              resolve();
            } catch (error) {
              console.error('Payment verification error:', error);
              toast.error('Payment verification failed. Contact support if payment was deducted.');
              reject(error);
            }
          },
          prefill: { name: user?.name, email: user?.email, contact: user?.phone },
          theme: { color: '#10b981' },
          modal: { ondismiss: () => reject(new Error('dismissed')) },
        });

        razorpay.open();
      });
    } catch (error) {
      if (error?.message !== 'dismissed') {
        toast.error('Payment failed. Please try again.');
      }
    } finally {
      setPaying(false);
    }
  };

  const handleToggleAutoRenew = async () => {
    try {
      const response = await subscriptionAPI.toggleAutoRenew();
      toast.success(response.data.auto_renew ? 'Auto-renew on' : 'Auto-renew off');
      await fetchStatus();
    } catch (error) {
      toast.error('Failed to update auto-renew');
    }
  };

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 w-1/3 bg-stone-200 rounded" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-20 bg-stone-100 rounded-xl" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-12 bg-stone-100 rounded-lg" />
            <div className="h-12 bg-stone-100 rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!subData || (!subData.status && !subData.model && !subData.has_subscription)) {
    return (
      <Card className="border-dashed border-2">
        <CardContent className="py-10 text-center">
          <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">Subscription data unavailable</h3>
          <p className="text-muted-foreground mb-6">We couldn't load your subscription details. This might happen if your role doesn't require a subscription or if there's a connection issue.</p>
          <Button onClick={fetchStatus} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Retry Loading
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isCommissionModel || isHybridModel) {
    const pendingCommission = Number(subData.pending_commission_amount || 0);

    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              {isHybridModel ? 'Hybrid Model (Sub + Comm)' : 'Commission Model'}
            </div>
            <Badge className="bg-primary/10 text-primary border border-primary/20">
              {subData.commission_rate || '2%'} per deal
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-primary/15 bg-white/70 p-4">
            <p className="text-sm font-medium text-stone-900">
              {isHybridModel ? 'Monthly Subscription + Commission' : 'No monthly subscription'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              We deduct a {subData.commission_rate || '2%'} commission only when a deal is confirmed.
              {isHybridModel && ' You also pay a small monthly fee for featured placement.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-white p-3 border">
              <p className="text-xs text-muted-foreground">Commission rate</p>
              <p className="font-semibold">{subData.commission_rate || '2%'}</p>
            </div>
            <div className="rounded-xl bg-white p-3 border">
              <p className="text-xs text-muted-foreground">Pending commission</p>
              <p className="font-semibold">₹{pendingCommission.toLocaleString('en-IN')}</p>
            </div>
          </div>
          
          {isHybridModel && (
             <div className="pt-4 border-t">
               <PlanDetails subData={subData} onPay={handlePay} paying={paying} role={user?.role} />
             </div>
          )}

          {Array.isArray(subData.commission_history) && subData.commission_history.length > 0 && (
            <div className="text-xs text-muted-foreground">
              Last recorded commission: {subData.commission_history[0].commission_id}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const cfg = STATUS_CONFIG[subData.status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;

  const handleViewInvoices = async () => {
    try {
      const response = await subscriptionAPI.getInvoices();
      const invoices = response.data.invoices || [];
      toast.success(invoices.length ? `Loaded ${invoices.length} invoices` : 'No invoices yet');
    } catch (error) {
      toast.error('Failed to load invoices');
    }
  };

  return (
    <Card className={isBlocked ? 'border-red-300 ring-2 ring-red-200' : ''}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            Subscription
          </div>
          <Badge className={cfg.color}>
            <Icon className="w-3 h-3 mr-1" />
            {cfg.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {subData.status === 'trial' && trialDaysLeft !== null && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-900">
              {trialDaysLeft > 0 
                ? `You are on a 5-month free trial. Enjoy full access!` 
                : 'Your free trial has ended today.'}
            </p>
            <p className="text-xs text-blue-700 mt-1">
              {trialDaysLeft > 0 
                ? `Subscription payments will begin in ${trialDaysLeft} days.`
                : 'Please upgrade to continue using the platform.'}
            </p>
          </div>
        )}

        {isBlocked && (
          <div className="p-4 bg-red-50 rounded-xl border border-red-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800">Account Suspended</p>
                <p className="text-sm text-red-700 mt-1">
                  Your account is suspended due to unpaid subscription.
                  Pay now to restore all features immediately.
                </p>
                {subData.block_until && (
                  <p className="text-xs text-red-500 mt-1">
                    Auto-unblocks: {new Date(subData.block_until).toLocaleDateString('en-IN')}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Monthly Price</p>
            <p className="font-semibold">{subData.price || '₹999/month'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Next Billing</p>
            <p className="font-semibold">
              {subData.next_billing_date ? new Date(subData.next_billing_date).toLocaleDateString('en-IN') : 'N/A'}
            </p>
          </div>
        </div>

        {((needsPayment || subData.status === 'trial') && subData.status !== 'active') && (
          <PlanDetails subData={subData} onPay={handlePay} paying={paying} role={user?.role} />
        )}

        {subData.status === 'active' && (
          <div className="flex items-center justify-between text-sm">
            <button
              onClick={handleToggleAutoRenew}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Auto-renew: {subData.auto_renew ? 'On' : 'Off'}
            </button>
            <button
              onClick={handleViewInvoices}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <FileText className="w-3.5 h-3.5" />
              Invoices
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
