import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { messagesAPI, listingsAPI } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from 'sonner';
import {
  MessageCircle,
  X,
  Send,
  ChevronLeft,
  User,
  CheckCheck,
  Check,
  Image,
  Paperclip,
  Loader2,
} from 'lucide-react';

const blockedWords = [
  'call me',
  'whatsapp',
  'phone',
  'number',
  'contact me',
  '@gmail',
  '@yahoo',
  '@outlook',
  '+91',
];

const isBlockedMessage = (msg) => blockedWords.some((word) => String(msg || '').toLowerCase().includes(word));

export const DirectChat = ({ 
  isOpen, 
  onClose, 
  receiverId, 
  receiverName, 
  listingId,
  listingTitle 
}) => {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const response = await messagesAPI.getConversations();
      const conversations = response.data.conversations || [];
      
      const conversation = conversations.find(
        (c) => c.participants?.includes(receiverId)
      );
      
      if (conversation) {
        const msgResponse = await messagesAPI.getMessages(conversation.id);
        setMessages(msgResponse.data.messages || []);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  }, [receiverId]);

  useEffect(() => {
    if (isOpen && receiverId) {
      fetchMessages();
    }
  }, [fetchMessages, isOpen, receiverId]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;

    if (isBlockedMessage(input)) {
      alert('Sharing contact details is not allowed');
      return;
    }

    const messageText = input.trim();
    setInput('');
    setSending(true);

    // Optimistic update
    const tempMessage = {
      id: `temp-${Date.now()}`,
      sender_id: user?.id,
      content: messageText,
      created_at: new Date().toISOString(),
      read: false,
    };
    setMessages((prev) => [...prev, tempMessage]);

    try {
      await messagesAPI.send({
        receiver_id: receiverId,
        content: messageText,
        listing_id: listingId,
      });
      fetchMessages();
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Message send failed');
      setMessages((prev) => prev.filter((m) => m.id !== tempMessage.id));
      setInput(messageText);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25 }}
          className="w-full md:w-[420px] h-[85vh] md:h-[600px] bg-white md:rounded-2xl overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
          data-testid="direct-chat-modal"
        >
          {/* Header - WhatsApp Style */}
          <div className="bg-primary p-3 flex items-center gap-3">
            <button
              onClick={onClose}
              className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white text-sm truncate">{receiverName || 'Owner'}</h3>
              <p className="text-emerald-100 text-xs truncate">{listingTitle || 'Property Inquiry'}</p>
            </div>
          </div>

          <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 text-[11px] text-amber-900">
            For your safety, all communication must stay within GharSetu. Sharing contact details is restricted.
          </div>

          {/* Chat Background */}
          <div 
            className="flex-1 overflow-y-auto p-3 space-y-2"
            style={{ 
              backgroundColor: '#e5ddd5',
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
            }}
          >
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-3">
                  <MessageCircle className="w-8 h-8 text-primary" />
                </div>
                <h4 className="font-semibold text-stone-800 mb-1">Start Conversation</h4>
                <p className="text-sm text-stone-500 max-w-[200px]">
                  Send a message to inquire about this property
                </p>
              </div>
            ) : (
              messages.map((message, index) => {
                const isMine = message.sender_id === user?.id;
                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] px-3 py-2 rounded-lg shadow-sm ${
                        isMine
                          ? 'bg-[#dcf8c6] rounded-br-none'
                          : 'bg-white rounded-bl-none'
                      }`}
                    >
                      <p className="text-sm text-stone-800">{message.content}</p>
                      <div className={`flex items-center justify-end gap-1 mt-0.5`}>
                        <span className="text-[10px] text-stone-500">{formatTime(message.created_at)}</span>
                        {isMine && (
                          message.read 
                            ? <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                            : <Check className="w-3.5 h-3.5 text-stone-400" />
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Replies */}
          {messages.length === 0 && (
            <div className="px-3 py-2 bg-stone-100 border-t border-stone-200">
              <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                {[
                  'Is this available?',
                  'Price negotiable?',
                  'Can I visit?',
                  'More details please'
                ].map((text) => (
                  <button
                    key={text}
                    onClick={() => setInput(text)}
                    className="flex-shrink-0 px-3 py-1.5 bg-white border border-stone-200 rounded-full text-xs font-medium text-stone-700 hover:bg-stone-50"
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input - WhatsApp Style */}
          <div className="p-3 bg-stone-100 border-t border-stone-200">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-3"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message"
                className="flex-1 rounded-full bg-white border-0 h-11 text-sm px-4"
                disabled={sending}
                data-testid="chat-input"
              />
              
              <button
                type="submit"
                disabled={!input.trim() || sending}
                className="w-11 h-11 bg-primary rounded-full flex items-center justify-center disabled:opacity-50 flex-shrink-0"
                data-testid="chat-send"
              >
                {sending ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <Send className="w-5 h-5 text-white" />
                )}
              </button>
            </form>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Chat Button Component for Listings
export const ChatWithOwnerButton = ({ 
  ownerId, 
  ownerName, 
  listingId, 
  listingTitle,
  className = '' 
}) => {
  const { isAuthenticated } = useAuth();
  const [chatOpen, setChatOpen] = useState(false);
  const [locking, setLocking] = useState(false);

  const handleClick = async () => {
    if (!isAuthenticated) {
      toast.error('Login karva padse chat karva mate');
      return;
    }
    if (!listingId) {
      setChatOpen(true);
      return;
    }

    setLocking(true);
    try {
      await listingsAPI.lock(listingId);
      setChatOpen(true);
    } catch (error) {
      const detail = error?.response?.data?.detail || '';
      if (error?.response?.status === 409 || detail.toLowerCase().includes('already in process')) {
        toast.error('Already in process');
      } else {
        toast.error('Unable to start secure chat right now');
      }
    } finally {
      setLocking(false);
    }
  };

  return (
    <>
      <Button
        onClick={handleClick}
        variant="outline"
        disabled={locking}
        className={`gap-2 ${className}`}
        data-testid="chat-with-owner-btn"
      >
        {locking ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageCircle className="w-5 h-5" />}
        Chat to connect securely
      </Button>

      <DirectChat
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        receiverId={ownerId}
        receiverName={ownerName}
        listingId={listingId}
        listingTitle={listingTitle}
      />
    </>
  );
};

export default DirectChat;
