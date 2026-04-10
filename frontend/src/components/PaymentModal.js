import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { paymentsAPI, listingsAPI, platformAPI } from '../lib/api';
import { Button } from './ui/button';
import { toast } from 'sonner';
import {
  CreditCard,
  Shield,
  X,
  Loader2,
  Calendar,
  Lock,
  CheckCircle,
} from 'lucide-react';

export const PaymentModal = ({
  isOpen,
  onClose,
  listing,
  bookingDetails,
  paymentType = 'booking', // booking, listing_fee, subscription
  subscriptionMonths = 1,
  onSuccess
}) => {
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [paymentStep, setPaymentStep] = useState('details'); // details, processing, success
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [revealedContact, setRevealedContact] = useState(null);
  const [successDetails, setSuccessDetails] = useState(null);
  const [fees, setFees] = useState({ 
    platform_fee: 50, 
    subscription_fee: 999, 
    listing_fee: 199 
  });

  useEffect(() => {
    const fetchFees = async () => {
      try {
        const res = await platformAPI.getFees();
        if (res.data) {
          const cat = listing?.category || 'home';
          const config = res.data.categories?.[cat] || res.data.global_config || {};
          setFees(config);
        }
      } catch (err) {
        console.error('Error fetching fees:', err);
      }
    };
    fetchFees();
  }, [listing]);

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

    // Fetch payment config
    fetchPaymentConfig();
  }, []);

  const fetchPaymentConfig = async () => {
    try {
      const response = await paymentsAPI.getConfig();
      setPaymentConfig(response?.data || null);
    } catch (error) {
      console.error('Failed to fetch payment config:', error);
    }
  };

  const formatPrice = (price) => {
    if (price >= 10000000) {
      return `₹${(price / 10000000).toFixed(2)} Cr`;
    } else if (price >= 100000) {
      return `₹${(price / 100000).toFixed(2)} L`;
    }
    return `₹${price?.toLocaleString('en-IN')}`;
  };

  // Calculate booking amount
  let baseAmount = 0;
  let platformFee = 0;
  let totalAmount = 0;

  if (paymentType === 'booking') {
    baseAmount = listing?.price || 0;
    platformFee = fees.platform_fee || 50;
    totalAmount = baseAmount + platformFee;
  } else if (paymentType === 'listing_fee') {
    baseAmount = fees.listing_fee || 199;
    platformFee = 0;
    totalAmount = baseAmount;
  } else if (paymentType === 'subscription') {
    // subscriptionMonths can be a number (1, 12 etc) OR a plan name ('basic', 'pro')
    if (subscriptionMonths === 'service_top') {
      baseAmount = fees.service_top_fee || 149;
    } else if (subscriptionMonths === 'service_verified') {
      baseAmount = fees.service_verified_fee || 99;
    } else if (subscriptionMonths === 'service_basic') {
      baseAmount = fees.service_basic_fee || 50;
    } else if (subscriptionMonths === 'pro') {
      baseAmount = fees.pro_subscription_fee || 499;
    } else if (subscriptionMonths === 'basic') {
      baseAmount = fees.basic_subscription_fee || 199;
    } else {
      // For property owners, they pay ₹999/month
      baseAmount = (fees.subscription_fee || 999) * (typeof subscriptionMonths === 'number' ? subscriptionMonths : 1);
    }
    platformFee = 0;
    totalAmount = baseAmount;
  } else if (paymentType === 'reel_boost') {
    const days = typeof subscriptionMonths === 'number' ? subscriptionMonths : 1;
    if (days === 1) baseAmount = fees.reel_boost_1d || 19;
    else if (days === 3) baseAmount = fees.reel_boost_3d || 49;
    else if (days === 7) baseAmount = fees.reel_boost_7d || 99;
    else baseAmount = 19 * days;
    platformFee = 0;
    totalAmount = baseAmount;
  }

  const handlePayment = async () => {
    if (!token) {
      toast.error('Please login to make payment');
      return;
    }

    if (!razorpayLoaded || !paymentConfig?.enabled) {
      toast.error('Payment gateway not available');
      return;
    }

    setLoading(true);
    setPaymentStep('processing');

    try {
      // Create order
      // Note: For 'booking', we send the base listing price. 
      // The backend adds the platform fee from its configuration and also handles listing locking.
      const orderResponse = await paymentsAPI.createOrder({
        amount: baseAmount * 100,
        listing_id: listing?.id,
        booking_type: paymentType === 'subscription' ? 'subscription' : (listing?.category || 'home'),
        payment_type: paymentType,
        subscription_months: typeof subscriptionMonths === 'number' ? subscriptionMonths : 1,
        plan: typeof subscriptionMonths === 'string' ? subscriptionMonths : 'basic',
        booking_date: bookingDetails?.date?.toISOString(),
        guests: bookingDetails?.guests || 1,
        notes: bookingDetails?.notes || '',
      });
      const orderData = orderResponse?.data || {};

      // Open Razorpay checkout
      const options = {
        key: paymentConfig.key_id,
        amount: orderData.amount, // Use the total amount (base + fees) returned from the backend
        currency: 'INR',
        name: 'GharSetu',
        description: paymentType === 'subscription' ? 'Subscription Payment' : 
                     paymentType === 'listing_fee' ? 'Listing Fee Payment' : 
                     paymentType === 'reel_boost' ? 'Reel Boost Payment' :
                     listing?.title || 'Booking Payment',
        order_id: orderData.order_id,
        handler: async function (response) {
          // Verify payment
          try {
            const verifyResponse = await paymentsAPI.verify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            const verifyData = verifyResponse?.data || {};

            if (verifyData.success) {
              if (listing?.id) {
                try {
                  const revealResponse = await listingsAPI.revealContact(listing.id);
                  setRevealedContact(revealResponse?.data || null);
                } catch {
                  setRevealedContact(null);
                }
              }
              setSuccessDetails({
                order_id: response.razorpay_order_id,
                payment_id: response.razorpay_payment_id,
                name: user?.name,
                phone: user?.phone,
                amount: totalAmount
              });
              setPaymentStep('success');
              toast.success('Payment successful!');
              // Keep the success screen visible for user to see details
            } else {
              throw new Error('Payment verification failed');
            }
          } catch (error) {
            console.error('Verification error:', error);
            toast.error('Payment verification failed');
            setPaymentStep('details');
          }
        },
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || ''
        },
        theme: {
          color: '#0E7450'
        },
        modal: {
          ondismiss: function () {
            setPaymentStep('details');
            setLoading(false);
          }
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();

    } catch (err) {
      console.error('Payment initialization error:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Payment failed. Please try again.';
      toast.error(errorMessage);
      setPaymentStep('details');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="w-full max-w-md bg-white rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          data-testid="payment-modal"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-primary to-emerald-600 p-4 md:p-6 text-white">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-heading text-lg md:text-xl font-bold">Secure Payment</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 text-emerald-100 text-xs md:text-sm">
              <Shield className="w-4 h-4" />
              <span>256-bit SSL • Powered by Razorpay</span>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 md:p-6">
            {paymentStep === 'details' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4 md:space-y-6"
              >
                {/* Summary */}
                <div className="bg-stone-50 rounded-xl p-3 md:p-4">
                  <h3 className="font-medium text-sm text-muted-foreground mb-2">
                    {paymentType === 'subscription' ? 'Plan' : paymentType === 'listing_fee' ? 'Listing' : 'Booking'}
                  </h3>
                  <p className="font-semibold text-stone-900 line-clamp-1">
                    {paymentType === 'subscription' ? (
                      subscriptionMonths === 'service_top' ? 'Top Listing Plan (Service)' :
                      subscriptionMonths === 'service_verified' ? 'Verified Plan (Service)' :
                      subscriptionMonths === 'service_basic' ? 'Basic Plan (Service)' :
                      `Unlimited Property Listings (${subscriptionMonths} Month${subscriptionMonths > 1 ? 's' : ''})`
                    ) : 
                     paymentType === 'listing_fee' ? (listing?.title || 'Property Listing Fee') : 
                     paymentType === 'reel_boost' ? `Reel Boost (${subscriptionMonths} Day${subscriptionMonths > 1 ? 's' : ''})` :
                     (listing?.title || 'Booking Payment')}
                  </p>
                  {paymentType === 'booking' && bookingDetails?.date && (
                    <p className="text-sm text-muted-foreground mt-1">
                      <Calendar className="w-3 h-3 inline mr-1" />
                      {bookingDetails.date.toLocaleDateString()}
                    </p>
                  )}
                </div>

                {/* Price Breakdown */}
                <div className="bg-stone-50 rounded-xl p-3 md:p-4">
                  <h3 className="font-medium text-sm text-muted-foreground mb-3">Price Details</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>
                        {paymentType === 'subscription' ? 'Plan Fee' : 
                         paymentType === 'listing_fee' ? 'Listing Fee' : 
                         paymentType === 'reel_boost' ? 'Boost Fee' :
                         'Base Amount'}
                      </span>
                      <span className="font-medium">{formatPrice(baseAmount)}</span>
                    </div>
                    {paymentType === 'booking' && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Platform Fee</span>
                        <span>{formatPrice(platformFee)}</span>
                      </div>
                    )}
                    <div className="border-t pt-2 mt-2 flex justify-between">
                      <span className="font-semibold">Total</span>
                      <span className="font-bold text-primary text-lg">{formatPrice(totalAmount)}</span>
                    </div>
                  </div>
                </div>

                {/* Pay Button */}
                <Button
                  onClick={handlePayment}
                  disabled={loading || !paymentConfig?.enabled}
                  className="w-full btn-primary text-base md:text-lg py-5 md:py-6"
                  data-testid="pay-now-btn"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Lock className="w-5 h-5 mr-2" />
                      Pay {formatPrice(totalAmount)}
                    </>
                  )}
                </Button>

                {!paymentConfig?.enabled && (
                  <p className="text-xs text-center text-amber-600">
                    Payment gateway is being configured
                  </p>
                )}
              </motion.div>
            )}

            {paymentStep === 'processing' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-8 md:py-12"
              >
                <div className="w-16 h-16 md:w-20 md:h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
                  <Loader2 className="w-8 h-8 md:w-10 md:h-10 text-primary animate-spin" />
                </div>
                <h3 className="font-heading text-lg md:text-xl font-bold mb-2">Processing Payment</h3>
                <p className="text-sm text-muted-foreground">Please complete payment in Razorpay window...</p>
              </motion.div>
            )}

            {paymentStep === 'success' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-6 md:py-8"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.2 }}
                  className="w-16 h-16 md:w-20 md:h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6"
                >
                  <CheckCircle className="w-8 h-8 md:w-10 md:h-10 text-green-600" />
                </motion.div>
                <h3 className="font-heading text-lg md:text-xl font-bold text-green-600 mb-2">Payment Successful!</h3>
                
                {successDetails && (
                  <div className="bg-stone-50 rounded-xl p-4 mb-6 text-left space-y-2 border border-stone-100">
                    <div className="flex justify-between text-xs">
                      <span className="text-stone-500">Order ID:</span>
                      <span className="font-mono text-stone-700">{successDetails.order_id}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-stone-500">Payment ID:</span>
                      <span className="font-mono text-stone-700">{successDetails.payment_id}</span>
                    </div>
                    <div className="flex justify-between text-xs border-t pt-2">
                      <span className="text-stone-500">Name:</span>
                      <span className="font-medium text-stone-900">{successDetails.name}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-stone-500">Phone:</span>
                      <span className="font-medium text-stone-900">{successDetails.phone}</span>
                    </div>
                    <div className="flex justify-between text-sm border-t pt-2 font-bold">
                      <span className="text-stone-900">Total Paid:</span>
                      <span className="text-primary">₹{successDetails.amount.toLocaleString()}</span>
                    </div>
                  </div>
                )}

                <p className="text-sm text-muted-foreground mb-6">Your booking has been confirmed. You can now contact the owner.</p>
                
                {revealedContact?.contact_phone && (
                  <div className="bg-emerald-50 text-emerald-700 p-3 rounded-lg mb-6 flex items-center justify-center gap-2">
                    <Shield className="w-4 h-4" />
                    <span className="text-sm font-bold">Owner Phone: {revealedContact.contact_phone}</span>
                  </div>
                )}

                <Button 
                  onClick={() => {
                    onSuccess?.();
                    onClose();
                  }}
                  className="w-full"
                >
                  Go to Dashboard
                </Button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Payment Button Component
export const PaymentButton = ({
  listing,
  bookingDetails,
  className = '',
  onSuccess,
  children
}) => {
  const { isAuthenticated } = useAuth();
  const [showPayment, setShowPayment] = useState(false);

  const handleClick = () => {
    if (!isAuthenticated) {
      toast.error('Please login to make payment');
      return;
    }
    setShowPayment(true);
  };

  return (
    <>
      <Button
        onClick={handleClick}
        className={`gap-2 ${className}`}
        data-testid="payment-btn"
      >
        {children || (
          <>
            <CreditCard className="w-5 h-5" />
            Pay & Book Now
          </>
        )}
      </Button>

      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        listing={listing}
        bookingDetails={bookingDetails}
        onSuccess={onSuccess}
      />
    </>
  );
};

export default PaymentModal;
