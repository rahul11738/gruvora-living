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
  CheckCircle,
  Clock,
  Crown,
  FileText,
  RefreshCw,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react';

const STATUS_CONFIG = {
  trial: { color: 'bg-blue-100 text-blue-700', icon: Zap, label: 'Free Trial' },
  active: { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Active' },
  expired: { color: 'bg-red-100 text-red-700', icon: AlertTriangle, label: 'Expired' },
  blocked: { color: 'bg-red-100 text-red-700', icon: AlertTriangle, label: 'Suspended' },
  pending: { color: 'bg-yellow-100 text-yellow-700', icon: Clock, label: 'Payment Pending' },
};

export default function SubscriptionCard() {
  const { user } = useAuth();
  const { subData, loading, fetchStatus, isCommissionModel, needsPayment, isBlocked, trialDaysLeft } = useSubscription();
  const [paying, setPaying] = useState(false);

  if (loading || !subData) return null;

  if (isCommissionModel) {
    const pendingCommission = Number(subData.pending_commission_amount || 0);

    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Commission Model
            </div>
            <Badge className="bg-primary/10 text-primary border border-primary/20">
              5% per deal
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-primary/15 bg-white/70 p-4">
            <p className="text-sm font-medium text-stone-900">No monthly subscription</p>
            <p className="text-sm text-muted-foreground mt-1">
              We deduct a 5% commission only when a deal is confirmed.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-white p-3 border">
              <p className="text-xs text-muted-foreground">Commission rate</p>
              <p className="font-semibold">{subData.commission_rate || '5%'}</p>
            </div>
            <div className="rounded-xl bg-white p-3 border">
              <p className="text-xs text-muted-foreground">Pending commission</p>
              <p className="font-semibold">₹{pendingCommission.toLocaleString('en-IN')}</p>
            </div>
          </div>

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

  const handlePay = async () => {
    if (!window.Razorpay) {
      toast.error('Payment gateway not loaded');
      return;
    }

    setPaying(true);
    try {
      const orderRes = await subscriptionAPI.createOrder('monthly');
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
              await subscriptionAPI.verify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              toast.success('Subscription activated!');
              await fetchStatus();
              resolve();
            } catch (error) {
              toast.error('Payment verification failed');
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
        toast.error('Payment failed');
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
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-700 font-medium">
              {trialDaysLeft > 0 ? `${trialDaysLeft} days left in your free trial` : 'Trial ends today!'}
            </p>
            {subData.coupon_used && (
              <p className="text-xs text-blue-600 mt-0.5">Coupon applied: {subData.coupon_used}</p>
            )}
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
            <p className="text-xs text-muted-foreground">Monthly fee</p>
            <p className="font-semibold">₹251/month</p>
          </div>
          {subData.next_billing_date && (
            <div>
              <p className="text-xs text-muted-foreground">Next billing</p>
              <p className="font-semibold">{new Date(subData.next_billing_date).toLocaleDateString('en-IN')}</p>
            </div>
          )}
          {subData.last_payment_date && (
            <div>
              <p className="text-xs text-muted-foreground">Last paid</p>
              <p className="font-semibold">{new Date(subData.last_payment_date).toLocaleDateString('en-IN')}</p>
            </div>
          )}
          {subData.last_invoice && (
            <div>
              <p className="text-xs text-muted-foreground">Last invoice</p>
              <p className="font-mono text-xs">{subData.last_invoice.invoice_number}</p>
            </div>
          )}
        </div>

        {needsPayment && (
          <Button onClick={handlePay} disabled={paying} className="w-full bg-primary hover:bg-primary/90 h-11">
            {paying ? (
              <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Processing...</>
            ) : (
              <><Crown className="w-4 h-4 mr-2" />Pay ₹251 - Activate Now</>
            )}
          </Button>
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
