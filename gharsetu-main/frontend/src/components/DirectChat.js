import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { MessageCircle } from 'lucide-react';

// Backward-compat placeholder: route-based /chat flow is the canonical UX.
export const DirectChat = () => null;

// Chat Button Component for Listings
export const ChatWithOwnerButton = ({ 
  ownerId, 
  ownerName,
  listingId, 
  listingTitle,
  className = '' 
}) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleClick = async () => {
    if (!isAuthenticated) {
      toast.error('Login karva padse chat karva mate');
      return;
    }
    if (!ownerId) {
      toast.error('Owner not available');
      return;
    }
    const params = new URLSearchParams();
    if (listingId) params.set('listing_id', String(listingId));
    params.set('user', String(ownerId));
    navigate(`/chat?${params.toString()}`);
  };

  return (
    <Button
      onClick={handleClick}
      variant="outline"
      className={`gap-2 ${className}`}
      data-testid="chat-with-owner-btn"
    >
      <MessageCircle className="w-5 h-5" />
      Chat to connect securely
    </Button>
  );
};

export default DirectChat;
