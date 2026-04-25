import React from 'react';
import { Button } from './ui/button';
import { Loader2, CreditCard } from 'lucide-react';
import usePaytm from '../hooks/usePaytm';

const PayButton = ({ amount, listingId, paymentType = 'booking', plan, months, bookingDate, guests, notes, className, children }) => {
    const { processPayment, loading, error } = usePaytm();

    const handlePay = () => {
        processPayment({
            amount,
            listing_id: listingId,
            payment_type: paymentType,
            plan,
            subscription_months: months,
            booking_date: bookingDate,
            guests,
            notes
        });
    };

    return (
        <div className="flex flex-col gap-2">
            <Button 
                onClick={handlePay} 
                disabled={loading} 
                className={`w-full flex items-center justify-center gap-2 ${className}`}
            >
                {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <CreditCard className="h-4 w-4" />
                )}
                {children || (loading ? 'Processing...' : `Pay ₹${amount}`)}
            </Button>
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
    );
};

export default PayButton;
