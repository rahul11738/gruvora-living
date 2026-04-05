import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { paymentsAPI, listingsAPI } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';
import {
  CreditCard,
  Check,
  Shield,
  X,
  Loader2,
  IndianRupee,
  Calendar,
  User,
  Lock,
  CheckCircle,
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export const PaymentModal = ({ 
  isOpen, 
  onClose, 
  listing, 
  bookingDetails,
  onSuccess 
}) => {
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [paymentStep, setPaymentStep] = useState('details'); // details, processing, success
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [revealedContact, setRevealedContact] = useState(null);

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
  const baseAmount = listing?.price || 5000;
  const platformFee = Math.round(baseAmount * 0.05); // 5% platform fee
  const totalAmount = baseAmount + platformFee;
  const amountInPaise = totalAmount * 100;

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
      if (listing?.id) {
        await listingsAPI.lock(listing.id);
      }

      // Create order
      const orderResponse = await paymentsAPI.createOrder({
        amount: amountInPaise,
        listing_id: listing?.id || 'test',
        booking_type: listing?.category || 'stay',
        booking_date: bookingDetails?.date?.toISOString(),
        guests: bookingDetails?.guests || 1,
        notes: bookingDetails?.notes || '',
      });
      const orderData = orderResponse?.data || {};

      // Open Razorpay checkout
      const options = {
        key: paymentConfig.key_id,
        amount: amountInPaise,
        currency: 'INR',
        name: 'GharSetu',
        description: listing?.title || 'Booking Payment',
        order_id: orderData.order_id,
        handler: async function(response) {
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
              setPaymentStep('success');
              toast.success('Payment successful!');
              setTimeout(() => {
                onSuccess?.();
                onClose();
              }, 2000);
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
          ondismiss: function() {
            setPaymentStep('details');
            setLoading(false);
          }
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();

    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Payment failed. Please try again.');
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
                {/* Booking Summary */}
                {listing && (
                  <div className="bg-stone-50 rounded-xl p-3 md:p-4">
                    <h3 className="font-medium text-sm text-muted-foreground mb-2">Booking</h3>
                    <p className="font-semibold text-stone-900 line-clamp-1">{listing.title}</p>
                    {bookingDetails?.date && (
                      <p className="text-sm text-muted-foreground mt-1">
                        <Calendar className="w-3 h-3 inline mr-1" />
                        {bookingDetails.date.toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}

                {/* Price Breakdown */}
                <div className="bg-stone-50 rounded-xl p-3 md:p-4">
                  <h3 className="font-medium text-sm text-muted-foreground mb-3">Price Details</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Base Amount</span>
                      <span className="font-medium">{formatPrice(baseAmount)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Platform Fee (5%)</span>
                      <span>{formatPrice(platformFee)}</span>
                    </div>
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
                className="text-center py-8 md:py-12"
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
                <p className="text-sm text-muted-foreground mb-4">Your booking has been confirmed</p>
                <p className="text-xs text-muted-foreground">
                  Confirmation will be sent to your email
                </p>
                {revealedContact?.contact_phone ? (
                  <p className="text-xs text-emerald-700 mt-3">
                    Owner phone unlocked: {revealedContact.contact_phone}
                  </p>
                ) : null}
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
