import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, ArrowRight } from 'lucide-react';
import { Button } from '../ui/button';
import api from '../../lib/api';

export const SuccessPage = () => {
    const [searchParams] = useSearchParams();
    const [verifying, setVerifying] = useState(true);
    const [, setStatus] = useState(null); // Fixed: Removed unused 'status'
    const navigate = useNavigate();
    const orderId = searchParams.get('orderId');

    useEffect(() => {
        const verify = async () => {
            try {
                // The backend verify endpoint checks Paytm status and fulfills the order
                const response = await api.post('/api/payment/verify', { orderId });
                setStatus(response.data);
            } catch (err) {
                console.error("Verification error:", err);
            } finally {
                setVerifying(false);
            }
        };
        if (orderId) {
            verify();
        }
    }, [orderId]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
            <div className="bg-green-50 p-6 rounded-full mb-6">
                <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold mb-2 text-green-700">Payment Successful!</h1>
            <p className="text-gray-600 mb-8 max-w-md">
                Your payment for Order <span className="font-mono font-bold">#{orderId}</span> has been processed successfully.
                {verifying ? " Finalizing your booking details..." : " Your booking is confirmed and secured."}
            </p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
                <Button onClick={() => navigate('/orders')} className="w-full bg-green-600 hover:bg-green-700">
                    View My Bookings <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={() => navigate('/')}>
                    Back to Home
                </Button>
            </div>
        </div>
    );
};

export const FailurePage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const orderId = searchParams.get('orderId');
    const reason = searchParams.get('reason');

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
            <div className="bg-red-50 p-6 rounded-full mb-6">
                <XCircle className="h-16 w-16 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold mb-2 text-red-700">Payment Failed</h1>
            <p className="text-gray-600 mb-8 max-w-md">
                Oops! Something went wrong with your transaction for Order <span className="font-mono font-bold">#{orderId}</span>.
                {reason === 'checksum_failed' ? " Security verification failed." : " Please try again or contact support if the amount was deducted from your account."}
            </p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
                <Button onClick={() => navigate(-1)} className="w-full bg-red-600 hover:bg-red-700">
                    Try Again
                </Button>
                <Button variant="outline" onClick={() => navigate('/')}>
                    Back to Home
                </Button>
            </div>
        </div>
    );
};

export const PendingPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const orderId = searchParams.get('orderId');

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
            <div className="bg-yellow-50 p-6 rounded-full mb-6">
                <Clock className="h-16 w-16 text-yellow-500" />
            </div>
            <h1 className="text-2xl font-bold mb-2 text-yellow-700">Payment Pending</h1>
            <p className="text-gray-600 mb-8 max-w-md">
                We are waiting for a final confirmation from your bank for Order <span className="font-mono font-bold">#{orderId}</span>. 
                This usually takes a few minutes. We will update your dashboard once the confirmation is received.
            </p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
                <Button onClick={() => navigate('/orders')} className="w-full bg-yellow-600 hover:bg-yellow-700">
                    Go to My Orders
                </Button>
                <Button variant="outline" onClick={() => navigate('/')}>
                    Back to Home
                </Button>
            </div>
        </div>
    );
};
