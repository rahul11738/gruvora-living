import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Header } from './Layout';
import { messagesAPI } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { MessageCircle, Send, Check, CheckCheck, Loader2, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const MESSAGE_PAGE_LIMIT = 50;

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
const PHONE_PATTERN = /(?:\+?\d[\s-]*){10,}/;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

const isBlockedMessage = (msg) => blockedWords.some((word) => String(msg || '').toLowerCase().includes(word));

const getBlockedReason = (value) => {
  const text = String(value || '').trim();
  if (!text) return null;

  const lowered = text.toLowerCase();
  if (isBlockedMessage(text)) {
    return 'Direct contact sharing is blocked. Keep chat on the platform.';
  }
  if (PHONE_PATTERN.test(text)) {
    return 'Phone numbers are not allowed in chat.';
  }
  if (EMAIL_PATTERN.test(text)) {
    return 'Email addresses are not allowed in chat.';
  }
  return null;
};

export const ChatPage = () => {
  const { user, token } = useAuth();
  const [searchParams] = useSearchParams();
  const listingId = searchParams.get('listing_id') || '';
  const receiverIdFromRoute = searchParams.get('user') || searchParams.get('receiver_id') || '';

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const [messagePage, setMessagePage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [sending, setSending] = useState(false);
  const [remoteTypingVisible, setRemoteTypingVisible] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  const messageEndRef = useRef(null);
  const messageListRef = useRef(null);
  const socketRef = useRef(null);
  const joinedConversationRef = useRef('');
  const shouldAutoScrollRef = useRef(true);

  const isNearBottom = useCallback((container, threshold = 100) => {
    if (!container) return true;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    return distanceFromBottom <= threshold;
  }, []);

  const scrollToBottom = useCallback(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleMessageListScroll = useCallback(() => {
    const container = messageListRef.current;
    if (!container) return;

    const nearBottom = isNearBottom(container);
    shouldAutoScrollRef.current = nearBottom;
    setShowJumpToLatest(!nearBottom);
  }, [isNearBottom]);

  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    try {
      const response = await messagesAPI.getConversations();
      const next = response?.data?.conversations || [];
      setConversations(next);

      if (next.length > 0) {
        const preferred = next.find((item) => {
          if (listingId && String(item.listing_id || '') !== String(listingId)) {
            return false;
          }
          if (receiverIdFromRoute && String(item.other_user?.id || '') !== String(receiverIdFromRoute)) {
            return false;
          }
          return true;
        });

        setActiveConversation((prev) => {
          if (prev?.id) {
            const refreshed = next.find((item) => item.id === prev.id);
            if (refreshed) return refreshed;
          }

          if (preferred) {
            return preferred;
          }

          if (listingId && receiverIdFromRoute) {
            return {
              id: '',
              listing_id: listingId,
              other_user: {
                id: receiverIdFromRoute,
                name: 'Chat',
              },
              unread_count: 0,
            };
          }

          return next[0];
        });
      } else {
        if (listingId && receiverIdFromRoute) {
          setActiveConversation({
            id: '',
            listing_id: listingId,
            other_user: {
              id: receiverIdFromRoute,
              name: 'Chat',
            },
            unread_count: 0,
          });
        } else {
          setActiveConversation(null);
        }
      }
    } catch {
      toast.error('Failed to load conversations');
    } finally {
      setLoadingConversations(false);
    }
  }, [listingId, receiverIdFromRoute]);

  const loadMessages = useCallback(async (conversationId, page = 1, appendOlder = false) => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    if (appendOlder) {
      setLoadingMoreMessages(true);
    } else {
      setLoadingMessages(true);
    }

    try {
      const response = await messagesAPI.getMessages(conversationId, page);
      const nextMessages = response?.data?.messages || [];

      if (appendOlder) {
        setMessages((prev) => [...nextMessages, ...prev]);
      } else {
        setMessages(nextMessages);
      }

      setHasMoreMessages(nextMessages.length >= MESSAGE_PAGE_LIMIT);
      setMessagePage(page);
    } catch {
      toast.error('Failed to load messages');
    } finally {
      if (appendOlder) {
        setLoadingMoreMessages(false);
      } else {
        setLoadingMessages(false);
      }
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!activeConversation?.id) {
      setMessages([]);
      setShowJumpToLatest(false);
      shouldAutoScrollRef.current = true;
      return;
    }
    setHasMoreMessages(true);
    setMessagePage(1);
    setShowJumpToLatest(false);
    shouldAutoScrollRef.current = true;
    loadMessages(activeConversation.id, 1, false);
  }, [activeConversation?.id, loadMessages]);

  useEffect(() => {
    if (!token || !API_URL) return;

    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('authenticate', { token });
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('new_message', (message) => {
      if (!message?.conversation_id) return;
      if (message.conversation_id !== activeConversation?.id) return;

      setMessages((prev) => {
        if (prev.some((item) => item.id === message.id)) return prev;
        return [...prev, message];
      });
    });

    socket.on('typing', (payload) => {
      if (!payload?.conversation_id || payload.conversation_id !== activeConversation?.id) return;
      if (payload.user_id === user?.id) return;
      setRemoteTypingVisible(Boolean(payload.is_typing));
    });

    socket.on('messages_seen', (payload) => {
      if (!payload?.conversation_id || payload.conversation_id !== activeConversation?.id) return;
      if (payload.seen_by === user?.id) return;

      setMessages((prev) => prev.map((msg) => {
        if (msg.sender_id === user?.id && !msg.read) {
          return { ...msg, read: true };
        }
        return msg;
      }));
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [activeConversation?.id, token, user?.id]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !activeConversation?.id) return;

    const previousId = joinedConversationRef.current;
    if (previousId && previousId !== activeConversation.id) {
      socket.emit('leave_chat', { conversation_id: previousId });
    }

    socket.emit('join_chat', { conversation_id: activeConversation.id });
    joinedConversationRef.current = activeConversation.id;

    return () => {
      socket.emit('leave_chat', { conversation_id: activeConversation.id });
    };
  }, [activeConversation?.id]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !activeConversation?.id || !user?.id) return;

    const hasUnreadIncoming = messages.some((msg) => msg.receiver_id === user.id && !msg.read);
    if (!hasUnreadIncoming) return;

    loadMessages(activeConversation.id, 1, false);
  }, [activeConversation?.id, loadMessages, messages, user?.id]);

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const updateKeyboardOffset = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardOffset(offset > 20 ? offset : 0);
    };

    updateKeyboardOffset();
    window.visualViewport.addEventListener('resize', updateKeyboardOffset);
    window.visualViewport.addEventListener('scroll', updateKeyboardOffset);

    return () => {
      window.visualViewport.removeEventListener('resize', updateKeyboardOffset);
      window.visualViewport.removeEventListener('scroll', updateKeyboardOffset);
    };
  }, []);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !activeConversation?.id || !user?.id) return;

    const isTyping = Boolean(messageInput.trim());
    socket.emit('typing', {
      conversation_id: activeConversation.id,
      user_id: user.id,
      is_typing: isTyping,
    });

    if (!isTyping) return;

    const timer = setTimeout(() => {
      socket.emit('typing', {
        conversation_id: activeConversation.id,
        user_id: user.id,
        is_typing: false,
      });
    }, 900);

    return () => clearTimeout(timer);
  }, [activeConversation?.id, messageInput, user?.id]);

  const handleSend = useCallback(async (e) => {
    e.preventDefault();
    if (!activeConversation) return;

    const text = messageInput.trim();
    if (!text || sending) return;

    if (isBlockedMessage(text)) {
      alert('Sharing contact details is not allowed');
      return;
    }

    const blockedReason = getBlockedReason(text);
    if (blockedReason) {
      toast.error(blockedReason);
      return;
    }

    const optimistic = {
      id: `tmp-${Date.now()}`,
      sender_id: user?.id,
      receiver_id: activeConversation.other_user?.id,
      content: text,
      read: false,
      created_at: new Date().toISOString(),
    };

    setSending(true);
    setMessageInput('');
    setMessages((prev) => [...prev, optimistic]);

    try {
      await messagesAPI.send({
        receiver_id: activeConversation.other_user?.id,
        listing_id: activeConversation.listing_id,
        content: text,
      });
      await loadConversations();
    } catch (error) {
      setMessages((prev) => prev.filter((msg) => msg.id !== optimistic.id));
      toast.error(error?.response?.data?.detail || 'Failed to send message');
      setMessageInput(text);
    } finally {
      setSending(false);
    }
  }, [activeConversation, loadConversations, messageInput, sending, user?.id]);

  const handleLoadOlder = useCallback(async () => {
    if (!activeConversation?.id || loadingMoreMessages || !hasMoreMessages) return;
    const nextPage = messagePage + 1;
    await loadMessages(activeConversation.id, nextPage, true);
  }, [activeConversation?.id, hasMoreMessages, loadMessages, loadingMoreMessages, messagePage]);

  const formatTime = (value) => {
    if (!value) return '';
    return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-stone-50" data-testid="chat-page">
      <Header />
      <div className="container-main py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[calc(100vh-120px)] lg:h-[calc(100vh-120px)]">
          <Card className="lg:col-span-4 overflow-hidden min-h-0">
            <CardContent className="p-0 h-full min-h-0">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <h2 className="font-semibold">Conversations</h2>
                <Badge>{conversations.length}</Badge>
              </div>

              <div className="overflow-y-auto h-[calc(100%-57px)]">
                {loadingConversations ? (
                  <div className="p-6 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    No conversations yet.
                  </div>
                ) : (
                  conversations.map((conversation) => {
                    const active = conversation.id === activeConversation?.id;
                    return (
                      <button
                        key={conversation.id}
                        type="button"
                        onClick={() => setActiveConversation(conversation)}
                        className={`w-full text-left p-4 border-b hover:bg-stone-50 ${active ? 'bg-primary/5' : ''}`}
                      >
                        <p className="font-medium text-sm text-stone-900 line-clamp-1">{conversation.other_user?.name || 'Conversation'}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{conversation.last_message || 'No message yet'}</p>
                        {conversation.unread_count > 0 ? (
                          <Badge className="mt-2">{conversation.unread_count} new</Badge>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-8 overflow-hidden min-h-0">
            <CardContent className="p-0 h-full min-h-0">
              {!activeConversation ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                  <MessageCircle className="w-10 h-10 mb-3" />
                  Select a conversation to start chatting.
                </div>
              ) : (
                <div className="chat-container h-full min-h-0">
                  <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-900">
                    For your safety, all communication must stay within GharSetu. Sharing contact details is restricted.
                  </div>
                  <div className="px-4 py-3 border-b bg-white flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-stone-900">{activeConversation.other_user?.name || 'Chat'}</p>
                      <p className="text-xs text-muted-foreground">Listing: {activeConversation.listing_id || 'General'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {socketConnected ? <Badge variant="outline">Live</Badge> : <Badge variant="secondary">Offline</Badge>}
                      {activeConversation.listing_id ? (
                        <Link to={`/listing/${activeConversation.listing_id}`} className="text-sm text-primary hover:underline">
                          View Listing
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  <div
                    ref={messageListRef}
                    onScroll={handleMessageListScroll}
                    className="chat-messages bg-stone-100 px-3 py-4 min-h-0"
                  >
                    {hasMoreMessages && !loadingMessages ? (
                      <div className="mb-3 flex justify-center">
                        <Button variant="outline" size="sm" onClick={handleLoadOlder} disabled={loadingMoreMessages}>
                          {loadingMoreMessages ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ChevronUp className="w-4 h-4 mr-2" />}
                          Load older messages
                        </Button>
                      </div>
                    ) : null}
                    {loadingMessages ? (
                      <div className="h-full flex items-center justify-center">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const mine = msg.sender_id === user?.id;
                        return (
                          <div key={msg.id} className={`mb-2 flex ${mine ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] px-3 py-2 rounded-xl ${mine ? 'bg-primary text-white rounded-br-sm' : 'bg-white text-stone-900 rounded-bl-sm'}`}>
                              <p className="text-sm break-words">{msg.content}</p>
                              <div className={`mt-1 text-[11px] flex items-center gap-1 ${mine ? 'justify-end text-white/80' : 'justify-end text-stone-500'}`}>
                                <span>{formatTime(msg.created_at)}</span>
                                {mine ? (msg.read ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    {remoteTypingVisible ? <p className="text-xs text-muted-foreground px-1">Typing...</p> : null}
                    {showJumpToLatest ? (
                      <div className="sticky bottom-2 z-10 flex justify-center">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            shouldAutoScrollRef.current = true;
                            setShowJumpToLatest(false);
                            scrollToBottom();
                          }}
                        >
                          Jump to latest
                        </Button>
                      </div>
                    ) : null}
                    <div ref={messageEndRef} />
                  </div>

                  <form
                    className="chat-input shrink-0 bg-white border-t p-3"
                    style={{ paddingBottom: `calc(0.75rem + ${keyboardOffset}px)` }}
                    onSubmit={handleSend}
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        placeholder="Type a message"
                        className="h-11"
                        data-testid="chat-page-input"
                      />
                      <Button type="submit" disabled={sending || !messageInput.trim()} className="h-11 px-4">
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </Button>
                    </div>
                  </form>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
