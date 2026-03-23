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

const BLOCKED_KEYWORDS = ['call me', 'number', 'whatsapp', 'phone', 'contact me', 'email me'];
const PHONE_PATTERN = /(?:\+?\d[\s-]*){10,}/;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

const getBlockedReason = (value) => {
  const text = String(value || '').trim();
  if (!text) return null;

  const lowered = text.toLowerCase();
  if (BLOCKED_KEYWORDS.some((keyword) => lowered.includes(keyword))) {
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

  const messageEndRef = useRef(null);
  const socketRef = useRef(null);
  const joinedConversationRef = useRef('');

  const scrollToBottom = useCallback(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    try {
      const response = await messagesAPI.getConversations();
      const next = response?.data?.conversations || [];
      setConversations(next);

      if (next.length > 0) {
        const preferred = listingId
          ? next.find((item) => String(item.listing_id || '') === String(listingId))
          : null;
        setActiveConversation((prev) => prev || preferred || next[0]);
      } else {
        setActiveConversation(null);
      }
    } catch {
      toast.error('Failed to load conversations');
    } finally {
      setLoadingConversations(false);
    }
  }, [listingId]);

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
    if (!activeConversation?.id) return;
    setHasMoreMessages(true);
    setMessagePage(1);
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
    scrollToBottom();
  }, [messages, scrollToBottom]);

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
      await loadMessages(activeConversation.id, 1, false);
      await loadConversations();
    } catch (error) {
      setMessages((prev) => prev.filter((msg) => msg.id !== optimistic.id));
      toast.error(error?.response?.data?.detail || 'Failed to send message');
      setMessageInput(text);
    } finally {
      setSending(false);
    }
  }, [activeConversation, loadConversations, loadMessages, messageInput, sending, user?.id]);

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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4" style={{ height: 'calc(100vh - 120px)' }}>
          <Card className="lg:col-span-4 overflow-hidden">
            <CardContent className="p-0 h-full">
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

          <Card className="lg:col-span-8 overflow-hidden">
            <CardContent className="p-0 h-full">
              {!activeConversation ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                  <MessageCircle className="w-10 h-10 mb-3" />
                  Select a conversation to start chatting.
                </div>
              ) : (
                <div className="chat-container h-full">
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

                  <div className="chat-messages bg-stone-100 px-3 py-4">
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
                    <div ref={messageEndRef} />
                  </div>

                  <form className="chat-input bg-white border-t p-3" onSubmit={handleSend}>
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
