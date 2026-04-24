import { useState, useEffect } from 'react';
import { useSubscription } from '../../context/SubscriptionContext';
import { useAuth } from '../../context/AuthContext';
import { subscriptionAPI } from '../../lib/api';
import { generateInvoicePDF } from '../../lib/generateInvoicePDF';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Check,
  Clock,
  Crown,
  Download,
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

const PlanDetails = ({ subData, onPay, paying, role: rawRole, paymentSuccess }) => {
  const role = rawRole?.toLowerCase()?.replace(/\s+/g, '_') || '';
  
  // Robust plan identification with legacy mapping
  const planMapping = {
    'unlimited': 'advanced',
    'free_trial': 'basic',
    // add other legacy mappings here if discovered
  };
  
  const rawPlan = (subData?.subscription_plan || 'basic').toLowerCase().trim();
  const currentPlan = planMapping[rawPlan] || rawPlan;
  const isActive = subData?.status === 'active' || subData?.status === 'trial';

  const ownerPlans = [
    {
      id: 'basic',
      name: 'Basic',
      price: '₹199',
      subtext: 'Ideal for individuals',
      features: [
        '1 Property Listing for 15 days',
        '1 Reel Upload / week',
        '2% Platform Fees',
        'Standard Visibility'
      ],
      color: 'primary'
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '₹999',
      subtext: 'Most Popular Choice',
      features: [
        '5 Property Listings for 15 days',
        '5 Reel Uploads / week',
        '2% Platform Fees',
        'Featured Placement',
        'Verified Badge'
      ],
      color: 'primary',
      recommended: true
    },
    {
      id: 'advanced',
      name: 'Advanced',
      price: '₹1999',
      subtext: 'For Power Users',
      features: [
        '10 Property Listings for 15 days',
        '10 Reel Uploads / week',
        '2% Platform Fees',
        'Maximum Visibility',
        'Priority Support',
        'Analytics Dashboard'
      ],
      color: 'primary'
    }
  ];

  const stayEventPlans = [
    {
      id: 'basic',
      name: 'Basic',
      price: '₹199',
      subtext: 'Entry Level',
      features: [
        '1 Property Listing (Stay or Event)',
        '1 Reel Upload / week',
        '2% Platform Fees'
      ],
      color: 'primary'
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '₹499',
      subtext: 'Growth Plan',
      features: [
        '5 Property Listings / week',
        '5 Reel Uploads / week',
        '2% Platform Fees',
        'Featured Placement'
      ],
      color: 'primary',
      recommended: true
    },
    {
      id: 'advanced',
      name: 'Advanced',
      price: '₹999',
      subtext: 'Unlimited Scaling',
      features: [
        'Unlimited Stay & Event Listings',
        '10 Reel Uploads / week',
        '2% Platform Fees',
        'Priority Support'
      ],
      color: 'primary'
    }
  ];

  const servicePlans = [
    {
      id: 'service_basic',
      name: 'Service Basic',
      price: '₹50',
      features: ['Visible Listing', '1 Reel / week', 'Basic Badge'],
    },
    {
      id: 'service_verified',
      name: 'Service Verified',
      price: '₹99',
      features: ['Verified Badge', '2 Reels / week', 'Higher Visibility'],
      recommended: true
    },
    {
      id: 'service_top',
      name: 'Service Top',
      price: '₹149',
      features: ['Top 5 Position', 'Priority Ranking', 'Priority Support'],
    }
  ];

  const plansToDisplay = (role === 'service_provider') 
    ? servicePlans 
    : (['stay_owner', 'hotel_owner', 'event_owner'].includes(role))
      ? stayEventPlans
      : ownerPlans;
  const isOwnerRole = ['property_owner', 'stay_owner', 'event_owner', 'hotel_owner'].includes(role);

  return (
    <div className="space-y-6">
      <div className={`grid grid-cols-1 ${isOwnerRole ? 'lg:grid-cols-3' : 'md:grid-cols-3'} gap-4`}>
        {plansToDisplay.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const isRecommended = plan.recommended;
          
          return (
            <div 
              key={plan.id}
              className={`relative flex flex-col p-5 rounded-2xl border-2 transition-all duration-300 ${
                isCurrent && isActive
                ? 'border-emerald-500 bg-emerald-50/30' 
                : isRecommended 
                  ? 'border-primary shadow-lg scale-[1.02] bg-white z-10' 
                  : 'border-stone-100 bg-stone-50/50 hover:border-stone-200'
              }`}
            >
              {isRecommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-white text-[10px] font-bold rounded-full uppercase tracking-wider">
                  Recommended
                </div>
              )}
              
              <div className="mb-4">
                <h4 className={`font-bold ${isRecommended ? 'text-primary' : 'text-stone-900'}`}>{plan.name}</h4>
                <p className="text-[10px] text-muted-foreground">{plan.subtext || 'Monthly billing'}</p>
              </div>

              <div className="mb-6">
                <span className="text-2xl font-black text-stone-900">{plan.price}</span>
                <span className="text-xs text-muted-foreground ml-1">/mo</span>
              </div>

              <ul className="flex-grow space-y-2.5 mb-6">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-stone-600">
                    <div className="mt-0.5 w-3.5 h-3.5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <Check className="w-2.5 h-2.5 text-emerald-600" />
                    </div>
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => onPay(plan.id)}
                disabled={paying || (isCurrent && isActive) || paymentSuccess}
                variant={(isCurrent && isActive) || paymentSuccess ? "outline" : isRecommended ? "default" : "outline"}
                className={`w-full h-10 text-xs font-semibold rounded-xl transition-all ${
                  (isCurrent && isActive) || paymentSuccess 
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50' 
                    : isRecommended && !isCurrent ? 'btn-primary shadow-md hover:shadow-lg' : ''
                }`}
              >
                {paying ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin mr-2" />
                ) : (isCurrent && isActive) || paymentSuccess ? (
                  <Check className="w-3.5 h-3.5 mr-2" />
                ) : null}
                
                {(isCurrent && isActive) || paymentSuccess 
                  ? 'Already Subscribed' 
                  : (isActive ? 'Upgrade' : `Select ${plan.name}`)}
              </Button>
            </div>
          );
        })}
      </div>
      
      <p className="text-[10px] text-center text-muted-foreground bg-stone-50 p-2 rounded-lg border border-stone-100">
        <Shield className="w-3 h-3 inline-block mr-1 text-emerald-500" />
        Secure payments via Razorpay. Upgrade or downgrade anytime. 100% secure.
      </p>
    </div>
  );
};

export default function SubscriptionCard({ onPaymentSuccess }) {
  const { user, refreshUser } = useAuth();
  const { subData, loading, fetchStatus, updateSubData, isCommissionModel, isHybridModel, isBlocked, trialDaysLeft } = useSubscription();
  const [paying, setPaying] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [invoices, setInvoices] = useState(null);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [showInvoices, setShowInvoices] = useState(false);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);

  useEffect(() => {
    // Load Razorpay script
    if (!window.Razorpay) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => setRazorpayLoaded(true);
      document.body.appendChild(script);
    } else {
      setRazorpayLoaded(true);
    }
  }, []);

  const handlePay = async (plan = 'monthly') => {
    if (!window.Razorpay && !razorpayLoaded) {
      toast.error('Payment gateway is loading, please try again in a moment');
      return;
    }

    setPaying(true);
    try {
      const orderRes = await subscriptionAPI.createOrder(plan);
      const { order_id, amount, key_id } = orderRes.data;
      console.log('Razorpay Order Details:', { order_id, amount, key_id });

      await new Promise((resolve, reject) => {
        const razorpay = new window.Razorpay({
          key: key_id,
          amount,
          currency: 'INR',
          name: 'Gruvora Living',
          description: `Subscription - ₹${amount / 100}`,
          order_id,
          handler: async (response) => {
            try {
              // Verify payment with backend
              const verifyRes = await subscriptionAPI.verify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });

              // Mark payment as successful immediately (optimistic update)
              setPaymentSuccess(true);

              // Force-set active status immediately so UI unblocks right away
              const activeSub = verifyRes.data?.subscription?.status === 'active'
                ? verifyRes.data.subscription
                : { status: 'active', has_subscription: true, subscription_plan: plan };
              updateSubData(activeSub);

              toast.success('🎉 Subscription activated! You can now list properties.');

              // Notify parent component to refresh subscription status
              if (onPaymentSuccess) {
                onPaymentSuccess();
              }

              // Fetch fresh status after a short delay to let DB propagate,
              // but only if the server confirms active - don't downgrade optimistic state
              setTimeout(async () => {
                try {
                  await fetchStatus();
                  if (refreshUser) await refreshUser();
                } catch (_) { /* silent - optimistic state already set */ }
              }, 1500);

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

  const handleViewInvoices = async () => {
    if (showInvoices) { setShowInvoices(false); return; }
    setLoadingInvoices(true);
    try {
      const response = await subscriptionAPI.getInvoices();
      setInvoices(response.data.invoices || []);
      setShowInvoices(true);
    } catch {
      toast.error('Failed to load invoices');
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleDownloadInvoice = (invoice) => {
    try {
      generateInvoicePDF(invoice, user);
      toast.success('Invoice downloaded!');
    } catch {
      toast.error('Failed to generate PDF');
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
              <PlanDetails subData={subData} onPay={handlePay} paying={paying} role={user?.role} paymentSuccess={paymentSuccess} />
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

  return (
    <div className="space-y-6">
      {subData.status === 'trial' && (
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-200/50 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
          <div className="absolute -right-10 -top-10 opacity-10">
            <Crown className="w-40 h-40" />
          </div>
          
          <div className="flex items-center gap-5 relative z-10">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30">
              <Zap className="w-8 h-8 fill-current" />
            </div>
            <div>
              <h3 className="text-xl font-bold">5-Month Complimentary Trial</h3>
              <p className="text-emerald-50/90 text-sm mt-1 max-w-md">
                You are currently on a <span className="font-bold underline">Basic Plan</span> at no cost for 5 months. 
                Enjoy full owner benefits until {new Date(subData.next_billing_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}.
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 relative z-10">
            <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl border border-white/30 text-center min-w-[120px]">
              <span className="block text-[10px] uppercase font-bold tracking-widest opacity-80">Remaining</span>
              <span className="block text-2xl font-black">{trialDaysLeft} Days</span>
            </div>
          </div>
        </div>
      )}

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
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-medium text-emerald-900">
              {trialDaysLeft > 0
                ? `You are subscribed to the Basic Plan (Complimentary for 5 months).`
                : 'Your complimentary trial has ended.'}
            </p>
            <p className="text-xs text-emerald-700 mt-1">
              {trialDaysLeft > 0
                ? `Full access expires in ${trialDaysLeft} days. You can upgrade to Pro or Advanced anytime.`
                : 'Please upgrade to a paid plan to continue using all features.'}
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
            <p className="font-semibold">
              {subData.status === 'trial' ? '₹0 (Complimentary)' : (subData.price || '₹199/month')}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {subData.status === 'trial' ? 'Trial Ends' : 'Next Billing'}
            </p>
            <p className="font-semibold">
              {subData.next_billing_date ? new Date(subData.next_billing_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
            </p>
          </div>
        </div>

        <div className="pt-2">
          <PlanDetails subData={subData} onPay={handlePay} paying={paying} role={user?.role} paymentSuccess={paymentSuccess} />
        </div>

        {subData.status === 'active' && (
          <div className="space-y-3">
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
                disabled={loadingInvoices}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                {loadingInvoices
                  ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  : <FileText className="w-3.5 h-3.5" />}
                {showInvoices ? 'Hide Invoices' : 'Invoices'}
              </button>
            </div>

            {showInvoices && (
              <div className="rounded-xl border border-stone-200 overflow-hidden">
                <div className="bg-stone-50 px-4 py-2 border-b border-stone-200">
                  <p className="text-xs font-semibold text-stone-600 uppercase tracking-wide">Payment History</p>
                </div>
                {invoices && invoices.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">No invoices yet.</p>
                )}
                {invoices && invoices.map((inv) => {
                  const paidAt = inv.activated_at || inv.paid_at || inv.created_at;
                  const amount = inv.amount ? `₹${(inv.amount / 100).toLocaleString('en-IN')}` : '—';
                  const dateStr = paidAt ? new Date(paidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                  const invNum = inv.invoice_number || inv.id?.slice(0, 8).toUpperCase();
                  return (
                    <div key={inv.id} className="flex items-center justify-between px-4 py-3 border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-stone-900">#{invNum}</p>
                          <p className="text-xs text-muted-foreground">{dateStr} · {amount}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDownloadInvoice(inv)}
                        className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        PDF
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
      </Card>
    </div>
  );
}
