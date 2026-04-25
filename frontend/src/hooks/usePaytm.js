import { useState, useCallback } from 'react';
import api from '../lib/api';

/**
 * usePaytm — Paytm payment integration hook
 *
 * Uses the FORM-REDIRECT approach (Paytm's most reliable integration method).
 * This bypasses CheckoutJS which has known staging bugs (SESSION_EXPIRED / 4002)
 * even when the token is valid.
 *
 * Flow:
 *  1. Call backend /api/paytm/initiate → get orderId + txnToken + mid
 *  2. Submit a hidden HTML form to Paytm's hosted payment page
 *  3. User pays on Paytm's page
 *  4. Paytm POSTs back to /api/paytm/callback
 *  5. Backend verifies and redirects to /payment/success or /payment/failure
 */
const usePaytm = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const processPayment = useCallback(async (paymentData) => {
        setLoading(true);
        setError(null);

        try {
            // Step 1 — Get orderId + txnToken from backend
            const response = await api.post('/paytm/initiate', paymentData);
            const { orderId, txnToken, mid } = response.data;

            if (!txnToken || !orderId || !mid) {
                throw new Error(
                    'Incomplete response from payment server (missing orderId, txnToken or mid).'
                );
            }

            // Step 2 — Create a hidden form and submit it to Paytm's hosted payment page.
            // Using processTransaction which is often more stable for direct redirects than showPaymentPage.
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = `https://securegw-stage.paytm.in/theia/processTransaction?mid=${mid}&orderId=${orderId}`;
            form.style.display = 'none';

            const addField = (name, value) => {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = name;
                input.value = value;
                form.appendChild(input);
            };

            addField('mid', mid);
            addField('orderId', orderId);
            addField('txnToken', txnToken);

            form.target = '_self';
            document.body.appendChild(form);
            
            console.log('[Paytm] Redirecting to Paytm payment page for orderId:', orderId);
            
            // Critical fix for "postMessage" crash in some browsers/Paytm versions:
            // Explicitly clear the opener reference so Paytm doesn't think it's a popup.
            window.opener = null;
            form.submit();

            // Note: after form.submit() the browser navigates away.
            // Code after this point will not execute.

        } catch (err) {
            const msg =
                err?.response?.data?.detail ||
                err?.response?.data?.error ||
                err?.message ||
                'Payment initiation failed. Please try again.';
            console.error('[Paytm] processPayment error:', msg, err);
            setError(msg);
            setLoading(false);
            throw err;
        }
        // Note: setLoading(false) is intentionally NOT called in finally here —
        // because form.submit() navigates away, leaving loading=true is the correct
        // visual state while the browser redirects to Paytm.
    }, []);

    return { processPayment, loading, error };
};

export default usePaytm;
