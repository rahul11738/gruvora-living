import { useState, useCallback, useEffect } from 'react';
import api from '../lib/api';
import { toast } from 'sonner';

/**
 * usePaytm — Paytm payment integration hook
 *
 * This version uses the CheckoutJS flow as recommended for modern Paytm integrations.
 * It pre-loads the Paytm script to avoid "not initialized" errors.
 */
const usePaytm = () => {
    const [paying, setPaying] = useState(false);
    const [error, setError] = useState(null);
    const [scriptLoaded, setScriptLoaded] = useState(false);

    // Pre-load Paytm script on mount (Staging MID is usually static for the app)
    useEffect(() => {
        const MID = "Resell00448805757124"; // Staging MID from .env
        const scriptId = 'paytm-checkout-js';

        if (document.getElementById(scriptId)) {
            setScriptLoaded(true);
            return;
        }

        const script = document.createElement('script');
        script.id = scriptId;
        script.type = 'application/javascript';
        script.src = `https://securegw-stage.paytm.in/merchantpgpui/checkoutjs/merchants/${MID}.js`;
        script.async = true;
        
        script.onload = () => {
            console.log('[Paytm] Script loaded successfully');
            setScriptLoaded(true);
        };
        
        script.onerror = () => {
            console.error('[Paytm] Script failed to load. This is often caused by Brave Shields or Adblockers.');
            setError('Paytm SDK blocked by browser. Please disable Brave Shields/Adblocker.');
        };

        document.body.appendChild(script);

        return () => {
            // Optional: clean up if needed, but usually we keep it
        };
    }, []);

    const processPayment = useCallback(async (paymentData) => {
        if (!scriptLoaded && !window.Paytm) {
            toast.error("Paytm SDK not loaded. Please disable Brave Shields or Adblockers and refresh.");
            return;
        }

        setPaying(true);
        setError(null);
        try {
            console.log('[Paytm] Initiating payment...', paymentData);
            const response = await api.post('/paytm/initiate', paymentData);
            
            const { orderId, txnToken, amount } = response.data;

            if (!orderId || !txnToken) {
                throw new Error('Incomplete response from server (missing orderId or txnToken).');
            }

            if (!window.Paytm || !window.Paytm.CheckoutJS) {
                throw new Error('Paytm Checkout Library not available in window. Check for Adblockers.');
            }

            const config = {
                root: "",
                flow: "DEFAULT",
                data: {
                    orderId: orderId,
                    token: txnToken,
                    tokenType: "TXN_TOKEN",
                    amount: amount ? amount.toString() : (paymentData.amount || "0.00")
                },
                handler: {
                    notifyMerchant: (eventName, data) => {
                        console.log("[Paytm] Event:", eventName, data);
                        if (eventName === 'SESSION_EXPIRED') {
                            toast.error("Payment session expired. Please try again.");
                        }
                    }
                }
            };

            console.log('[Paytm] Invoking CheckoutJS...', orderId);
            
            await window.Paytm.CheckoutJS.init(config);
            window.Paytm.CheckoutJS.invoke();

        } catch (err) {
            console.error('[Paytm] Initialization error:', err);
            const errorMsg = err.response?.data?.error || err.message || 'Payment initiation failed';
            toast.error(errorMsg);
            setError(errorMsg);
        } finally {
            setPaying(false);
        }
    }, [scriptLoaded]);

    return { processPayment, paying, error };
};

export default usePaytm;
