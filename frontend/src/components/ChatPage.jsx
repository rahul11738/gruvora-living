import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Header } from './Layout';
import SeoHead from './SeoHead';
import api, { messagesAPI } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  MessageCircle, Send, Check, CheckCheck, Loader2, ChevronUp,
  Search, ArrowLeft, Circle, Building2, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

const normalizeSocketBaseUrl = (rawUrl) => {
  const base = String(rawUrl || '').trim();
  if (!base) return '';
  return base
    .replace(/\/api\/?$/i, '')
    .replace(/\/+$/, '')
    .replace('://localhost', '://127.0.0.1');
};

const resolveBackendUrl = () => {
  const clientBase = String(api?.defaults?.baseURL || '').trim();
  if (clientBase) {
    return clientBase.replace(/\/api\/?$/i, '');
  }
  if (process.env.REACT_APP_BACKEND_URL) return process.env.REACT_APP_BACKEND_URL;
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem('gharsetu_backend_url');
    if (stored) return stored;
  }
  return 'http://127.0.0.1:8000';
};

const API_URL = normalizeSocketBaseUrl(resolveBackendUrl());
const getSocketConnectionConfig = (apiUrl) => {
  const safeUrl = String(apiUrl || '').trim();
  if (safeUrl.startsWith('/')) {
    return {
      uri: safeUrl,
      path: '/socket.io',
    };
  }
  return {
    uri: safeUrl,
    path: '/socket.io',
  };
};
const MESSAGE_PAGE_LIMIT = 50;
const RECONNECT_DELAY_MS = [1000, 2000, 4000, 8000, 16000];
const CHAT_UNREAD_EVENT = 'gharsetu:chat-unread-updated';

const BLOCKED_WORDS = ['call me', 'whatsapp', 'phone', 'number', 'contact me', '@gmail', '@yahoo', '@outlook', '+91'];
const PHONE_RE = /(?:\+?\d[\s-]*){10,}/;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

const getBlockedReason = (text) => {
  const t = String(text || '').trim();
  if (!t) return null;
  if (BLOCKED_WORDS.some(w => t.toLowerCase().includes(w))) return 'Sharing contact details is not allowed on this platform.';
  if (PHONE_RE.test(t)) return 'Phone numbers are not allowed in chat.';
  if (EMAIL_RE.test(t)) return 'Email addresses are not allowed in chat.';
  return null;
};

const generateClientMessageId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `cmsg-${crypto.randomUUID()}`;
  }
  return `cmsg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const mergeMessageByIdentity = (prev, incoming) => {
  const nextIncoming = {
    ...incoming,
    content: incoming?.content ?? incoming?.message ?? '',
    message_status: 'sent',
    optimistic: false,
  };

  const incomingId = String(nextIncoming?.id || '');
  const incomingClientId = String(nextIncoming?.client_message_id || '');

  const idxById = incomingId
    ? prev.findIndex((m) => String(m?.id || '') === incomingId)
    : -1;
  const idxByClientId = incomingClientId
    ? prev.findIndex((m) => String(m?.client_message_id || '') === incomingClientId)
    : -1;

  const replaceIndex = idxById >= 0 ? idxById : idxByClientId;
  if (replaceIndex >= 0) {
    const cloned = [...prev];
    cloned[replaceIndex] = { ...cloned[replaceIndex], ...nextIncoming };
    return cloned;
  }

  return [...prev, nextIncoming];
};

const dedupeMessages = (items) => {
  const list = Array.isArray(items) ? items : [];
  const map = new Map();
  list.forEach((m) => {
    const id = String(m?.id || '').trim();
    const clientId = String(m?.client_message_id || '').trim();
    const fallbackKey = `${String(m?.sender_id || '')}|${String(m?.receiver_id || '')}|${String(m?.content || m?.message || '')}|${String(m?.created_at || '')}`;
    const key = id ? `id:${id}` : clientId ? `cid:${clientId}` : `f:${fallbackKey}`;
    if (!map.has(key)) {
      map.set(key, m);
      return;
    }
    const prev = map.get(key);
    map.set(key, { ...prev, ...m });
  });
  return Array.from(map.values());
};

const formatTime = (val) => {
  if (!val) return '';
  const d = new Date(val);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (val) => {
  if (!val) return '';
  const d = new Date(val);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const groupMessagesByDate = (messages) => {
  const groups = [];
  let currentDate = null;
  messages.forEach(msg => {
    const msgDate = msg.created_at ? new Date(msg.created_at).toDateString() : null;
    if (msgDate && msgDate !== currentDate) {
      currentDate = msgDate;
      groups.push({ type: 'date', date: msg.created_at, id: `date-${msg.created_at}` });
    }
    groups.push({ type: 'message', ...msg });
  });
  return groups;
};

const getConversationMembers = (conv) => conv?.participants || conv?.users || [];

const normalizeMemberId = (member) => {
  if (!member) return '';
  if (typeof member === 'string' || typeof member === 'number') return String(member);
  return String(member.id || member.user_id || member._id || '');
};

const hasConversationMember = (conv, userId) => {
  const normalizedTarget = String(userId || '');
  if (!normalizedTarget) return false;
  return getConversationMembers(conv)
    .map(normalizeMemberId)
    .includes(normalizedTarget);
};

const getUnreadChatTotal = (conversations = []) =>
  (Array.isArray(conversations) ? conversations : []).reduce((sum, conv) => {
    const unread = Number(conv?.unread_count || 0);
    return sum + (Number.isFinite(unread) ? unread : 0);
  }, 0);

const publishUnreadChatTotal = (conversations = []) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CHAT_UNREAD_EVENT, {
    detail: { unread: getUnreadChatTotal(conversations) },
  }));
};

// ─── Socket Manager (singleton per session) ──────────────────────────────────
let _socketInstance = null;
let _reconnectAttempt = 0;
let _reconnectTimer = null;

const getSocket = (token, onConnect, onDisconnect) => {
  if (_socketInstance) return _socketInstance;

  const socketConfig = getSocketConnectionConfig(API_URL);

  const socket = io(socketConfig.uri, {
    transports: ['polling', 'websocket'],
    path: socketConfig.path,
    autoConnect: true,
    reconnection: false,
  });

  socket.on('connect', () => {
    _reconnectAttempt = 0;
    if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
    socket.emit('authenticate', { token });
    onConnect?.();
  });

  socket.on('disconnect', () => {
    onDisconnect?.();
    const delay = RECONNECT_DELAY_MS[Math.min(_reconnectAttempt, RECONNECT_DELAY_MS.length - 1)];
    _reconnectAttempt++;
    _reconnectTimer = setTimeout(() => {
      if (token) socket.connect();
    }, delay);
  });

  socket.on('connect_error', () => {
    // Keep visible diagnostics for transient local networking/environment issues.
    console.warn('[chat-socket] connect_error', { apiUrl: API_URL });
    onDisconnect?.();
    const delay = RECONNECT_DELAY_MS[Math.min(_reconnectAttempt, RECONNECT_DELAY_MS.length - 1)];
    _reconnectAttempt++;
    if (_reconnectTimer) clearTimeout(_reconnectTimer);
    _reconnectTimer = setTimeout(() => {
      if (token) socket.connect();
    }, delay);
  });

  _socketInstance = socket;
  return socket;
};

// ─── ConversationItem ─────────────────────────────────────────────────────────
const ConversationItem = memo(({ conv, isActive, onClick, currentUserId }) => {
  const otherName = conv.other_user?.name || 'Chat';
  const lastMsg = conv.last_message || '';
  const unread = conv.unread_count || 0;
  const timeStr = conv.last_message_at ? formatTime(conv.last_message_at) : '';
  const listingTitle = conv.listing_title || '';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors border-b border-stone-100 hover:bg-stone-50 active:bg-stone-100 ${isActive ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
    >
      <div className="relative flex-shrink-0">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/30 to-primary/60 flex items-center justify-center text-white font-semibold text-lg select-none">
          {otherName[0]?.toUpperCase()}
        </div>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-primary rounded-full text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-semibold text-sm text-stone-900 truncate">{otherName}</span>
          <span className="text-[11px] text-stone-400 flex-shrink-0">{timeStr}</span>
        </div>
        {listingTitle && (
          <p className="text-[11px] text-primary/70 truncate font-medium flex items-center gap-1 mt-0.5">
            <Building2 className="w-2.5 h-2.5 flex-shrink-0" />
            {listingTitle}
          </p>
        )}
        <p className={`text-xs truncate mt-0.5 ${unread > 0 ? 'text-stone-800 font-medium' : 'text-stone-400'}`}>
          {lastMsg || 'No messages yet'}
        </p>
      </div>
    </button>
  );
});

// ─── MessageBubble ────────────────────────────────────────────────────────────
const MessageBubble = memo(({ msg, isMine, showAvatar, senderInitial, onRetry }) => {
  const isTemp = Boolean(msg?.message_status === 'sending' || msg?.optimistic || msg.id?.startsWith('tmp-'));
  const isFailed = msg?.message_status === 'failed';

  return (
    <div className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
      {!isMine && (
        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0 mb-1">
          {showAvatar ? senderInitial : <span className="opacity-0">{senderInitial}</span>}
        </div>
      )}
      <div className={`relative max-w-[72%] group`}>
        <div className={`px-3.5 py-2 rounded-2xl shadow-sm ${isMine
          ? 'bg-primary text-white rounded-br-sm'
          : 'bg-white text-stone-800 rounded-bl-sm border border-stone-100'
          }`}>
          <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{msg.content}</p>
          <div className={`flex items-center justify-end gap-1 mt-1 ${isMine ? 'text-white/70' : 'text-stone-400'}`}>
            <span className="text-[10px]">{formatTime(msg.created_at)}</span>
            {isMine && (
              isTemp
                ? <Circle className="w-3 h-3 opacity-50" />
                : isFailed
                  ? <Circle className="w-3 h-3 text-red-300" />
                  : msg.read
                    ? <CheckCheck className="w-3.5 h-3.5 text-blue-300" />
                    : <Check className="w-3.5 h-3.5 opacity-70" />
            )}
          </div>
        </div>
        {isMine && isFailed && (
          <div className="mt-1 flex justify-end">
            <button
              type="button"
              onClick={() => onRetry?.(msg)}
              className="text-[11px] font-medium text-red-600 hover:text-red-700"
            >
              Retry
            </button>
          </div>
        )}
      </div>
      {isMine && <div className="w-7 flex-shrink-0" />}
    </div>
  );
});

// ─── Main ChatPage ────────────────────────────────────────────────────────────
export const ChatPage = () => {
  const { user, token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL params
  const paramConversationId = searchParams.get('conversation_id') || '';
  const paramListingId = searchParams.get('listing_id') || '';
  const paramReceiverId = searchParams.get('user') || searchParams.get('receiver_id') || '';

  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [msgPage, setMsgPage] = useState(1);
  const [sending, setSending] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileView, setMobileView] = useState('list'); // 'list' | 'chat'

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messageListRef = useRef(null);
  const shouldAutoScroll = useRef(true);
  const joinedConvRef = useRef('');
  const typingTimerRef = useRef(null);
  const inputRef = useRef(null);
  const sendLockRef = useRef(false);

  // ── Scroll helpers ──────────────────────────────────────────────────────
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const isNearBottom = useCallback(() => {
    const el = messageListRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  // ── Load conversations ──────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    if (!token) return;
    try {
      const res = await messagesAPI.getConversations();
      const convs = res?.data?.conversations || [];
      setConversations(convs);
      return convs;
    } catch {
      toast.error('Failed to load conversations');
      return [];
    } finally {
      setLoadingConvs(false);
    }
  }, [token]);

  // ── Select active conversation from URL params ──────────────────────────
  const selectActiveConversation = useCallback((convs) => {
    if (!convs?.length) {
      if (paramListingId && paramReceiverId) {
        setActiveConv({
          id: '',
          listing_id: paramListingId,
          other_user: { id: paramReceiverId, name: 'Owner' },
          unread_count: 0,
        });
        setMobileView('chat');
      }
      return;
    }

    // Priority 1: exact conversation_id match
    if (paramConversationId) {
      const exact = convs.find(c => c.id === paramConversationId);
      if (exact) { setActiveConv(exact); setMobileView('chat'); return; }
    }

    // Priority 2: listing_id + receiver match
    if (paramListingId && paramReceiverId) {
      const match = convs.find(c =>
        String(c.listing_id || '') === String(paramListingId) &&
        hasConversationMember(c, paramReceiverId)
      );
      if (match) { setActiveConv(match); setMobileView('chat'); return; }
      // Create placeholder for new conversation
      setActiveConv({
        id: '',
        listing_id: paramListingId,
        other_user: { id: paramReceiverId, name: 'Chat' },
        unread_count: 0,
      });
      setMobileView('chat');
      return;
    }

    // Priority 3: listing_id only
    if (paramListingId) {
      const match = convs.find(c => String(c.listing_id || '') === String(paramListingId));
      if (match) { setActiveConv(match); setMobileView('chat'); return; }
    }

    // Priority 4: receiver_id only
    if (paramReceiverId) {
      const match = convs.find(c => hasConversationMember(c, paramReceiverId));
      if (match) { setActiveConv(match); setMobileView('chat'); return; }
    }
  }, [paramConversationId, paramListingId, paramReceiverId]);

  // ── Load messages ───────────────────────────────────────────────────────
  const loadMessages = useCallback(async (convId, page = 1, append = false) => {
    if (!convId) { setMessages([]); return; }
    if (append) setLoadingOlder(true); else setLoadingMsgs(true);
    try {
      const res = await messagesAPI.getMessages(convId, page);
      const msgs = res?.data?.messages || [];
      if (append) {
        setMessages(prev => dedupeMessages([...msgs, ...prev]));
      } else {
        setMessages(dedupeMessages(msgs));
        setTimeout(() => scrollToBottom('instant'), 50);
      }
      setHasMore(msgs.length >= MESSAGE_PAGE_LIMIT);
      setMsgPage(page);
    } catch {
      toast.error('Failed to load messages');
    } finally {
      if (append) setLoadingOlder(false); else setLoadingMsgs(false);
    }
  }, [scrollToBottom]);

  // ── Boot ────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadConversations().then(convs => {
      if (paramConversationId || paramListingId || paramReceiverId) {
        selectActiveConversation(convs);
      } else if (convs?.length > 0) {
        setActiveConv(convs[0]);
      }
    });
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!paramConversationId && !paramListingId && !paramReceiverId) return;
    loadConversations().then(selectActiveConversation);
  }, [paramConversationId, paramListingId, paramReceiverId, loadConversations, selectActiveConversation]);

  // ── Sync Unread Total ───────────────────────────────────────────────────
  useEffect(() => {
    publishUnreadChatTotal(conversations);
  }, [conversations]);

  // ── Load messages when active conv changes ──────────────────────────────
  useEffect(() => {
    if (!activeConv?.id) { setMessages([]); return; }
    setHasMore(false);
    setMsgPage(1);
    shouldAutoScroll.current = true;
    loadMessages(activeConv.id, 1, false);
  }, [activeConv?.id]); // eslint-disable-line

  // ── Socket setup ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;

    const socket = getSocket(
      token,
      () => setSocketConnected(true),
      () => setSocketConnected(false)
    );
    socketRef.current = socket;

    const onNewMessage = (msg) => {
      if (!msg?.conversation_id) return;
      // Always refresh conversations for sidebar update
      loadConversations();
      if (msg.conversation_id !== activeConv?.id) return;
      setMessages(prev => dedupeMessages(mergeMessageByIdentity(prev, msg)));
      if (shouldAutoScroll.current) setTimeout(() => scrollToBottom(), 30);
    };

    const onTyping = (payload) => {
      if (payload?.conversation_id !== activeConv?.id) return;
      if (payload?.user_id === user?.id) return;
      const uid = payload.user_id;
      if (payload.is_typing) {
        setTypingUsers(prev => new Set([...prev, uid]));
      } else {
        setTypingUsers(prev => { const next = new Set(prev); next.delete(uid); return next; });
      }
    };

    const onMessagesSeen = (payload) => {
      if (payload?.conversation_id !== activeConv?.id) return;
      if (payload?.seen_by === user?.id) return;
      setMessages(prev => prev.map(m =>
        m.sender_id === user?.id ? { ...m, read: true } : m
      ));
    };

    socket.on('new_message', onNewMessage);
    socket.on('typing', onTyping);
    socket.on('messages_seen', onMessagesSeen);

    return () => {
      socket.off('new_message', onNewMessage);
      socket.off('typing', onTyping);
      socket.off('messages_seen', onMessagesSeen);
    };
  }, [token, activeConv?.id, user?.id]); // eslint-disable-line

  // ── Join/leave chat room ────────────────────────────────────────────────
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !activeConv?.id) return;
    const prevId = joinedConvRef.current;
    if (prevId && prevId !== activeConv.id) {
      socket.emit('leave_chat', { conversation_id: prevId });
    }
    socket.emit('join_chat', { conversation_id: activeConv.id });
    joinedConvRef.current = activeConv.id;
    return () => {
      socket.emit('leave_chat', { conversation_id: activeConv.id });
    };
  }, [activeConv?.id]);

  // ── Typing indicator ────────────────────────────────────────────────────
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !activeConv?.id || !user?.id) return;
    const isTyping = input.trim().length > 0;
    socket.emit('typing', { conversation_id: activeConv.id, user_id: user.id, is_typing: isTyping });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (isTyping) {
      typingTimerRef.current = setTimeout(() => {
        socket.emit('typing', { conversation_id: activeConv.id, user_id: user.id, is_typing: false });
      }, 1500);
    }
    return () => { if (typingTimerRef.current) clearTimeout(typingTimerRef.current); };
  }, [input, activeConv?.id, user?.id]);

  // ── Auto scroll ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (shouldAutoScroll.current && messages.length > 0) {
      scrollToBottom('smooth');
    }
  }, [messages]); // eslint-disable-line

  // ── Send message ────────────────────────────────────────────────────────
  const handleSend = useCallback(async (e) => {
    e?.preventDefault();
    if (!activeConv || sending || sendLockRef.current) return;
    const text = input.trim();
    if (!text) return;
    const blocked = getBlockedReason(text);
    if (blocked) { toast.error(blocked); return; }

    const receiverId = activeConv.other_user?.id || paramReceiverId;
    if (!receiverId) { toast.error('Cannot determine recipient'); return; }

    sendLockRef.current = true;

    const optimisticId = `tmp-${Date.now()}-${Math.random()}`;
    const clientMessageId = generateClientMessageId();
    const optimistic = {
      id: optimisticId,
      client_message_id: clientMessageId,
      sender_id: user?.id,
      receiver_id: receiverId,
      content: text,
      read: false,
      created_at: new Date().toISOString(),
      conversation_id: activeConv.id,
      message_status: 'sending',
      optimistic: true,
    };

    setSending(true);
    setInput('');
    shouldAutoScroll.current = true;
    setMessages(prev => dedupeMessages(mergeMessageByIdentity(prev, optimistic)));

    try {
      const sendRes = await messagesAPI.send({
        receiver_id: receiverId,
        listing_id: activeConv.listing_id || undefined,
        content: text,
        message: text,
        client_message_id: clientMessageId,
      });
      const serverMsg = sendRes?.data?.message_data;
      if (serverMsg) {
        setMessages(prev => dedupeMessages(mergeMessageByIdentity(prev, serverMsg)));
      }
      // Refresh to get real message + update conversation
      const convs = await loadConversations();
      // Update active conversation with real ID if it was placeholder
      if (!activeConv.id && convs?.length > 0) {
        const match = convs.find(c =>
          hasConversationMember(c, receiverId) &&
          String(c.listing_id || '') === String(activeConv.listing_id || '')
        ) || convs.find(c => hasConversationMember(c, receiverId));
        if (match) {
          setActiveConv(match);
          // Remove URL params now that we have a real conversation
          const next = new URLSearchParams();
          next.set('conversation_id', match.id);
          setSearchParams(next, { replace: true });
        }
      }
      // Keep local list in sync only when API does not return canonical message payload.
      if (activeConv.id && !serverMsg) {
        await loadMessages(activeConv.id, 1, false);
      }
    } catch (err) {
      // Some backend versions can persist successfully but return 500.
      // Reconcile with server state before treating it as a hard failure.
      let reconciled = false;
      try {
        const convs = await loadConversations();
        const targetConv =
          (activeConv?.id && convs?.find(c => c.id === activeConv.id)) ||
          convs?.find(c =>
            hasConversationMember(c, receiverId) &&
            String(c.listing_id || '') === String(activeConv?.listing_id || '')
          ) ||
          convs?.find(c => hasConversationMember(c, receiverId));

        if (targetConv?.id) {
          if (!activeConv?.id || activeConv.id !== targetConv.id) {
            setActiveConv(targetConv);
            const next = new URLSearchParams();
            next.set('conversation_id', targetConv.id);
            setSearchParams(next, { replace: true });
          }

          const res = await messagesAPI.getMessages(targetConv.id, 1);
          const latest = res?.data?.messages || [];
          setMessages(latest);

          const justNow = Date.now() - 2 * 60 * 1000;
          reconciled = latest.some((m) => {
            const createdTs = new Date(m.created_at || 0).getTime();
            return (
              m?.sender_id === user?.id &&
              String(m?.content || '').trim() === text &&
              createdTs >= justNow
            );
          });
        }
      } catch {
        reconciled = false;
      }

      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        'Unknown server error';
      console.error('[chat-send] failed', {
        detail,
        status: err?.response?.status,
        payload: {
          receiver_id: receiverId,
          listing_id: activeConv?.listing_id || null,
          content: text,
        },
      });
      if (!reconciled) {
        setMessages(prev => prev.map((m) => {
          if (m.id !== optimisticId && m.client_message_id !== clientMessageId) return m;
          return {
            ...m,
            message_status: 'failed',
            optimistic: false,
            error: detail,
          };
        }));
        setInput(text);
        toast.error(`Failed to send message: ${detail}`);
      }
    } finally {
      setSending(false);
      sendLockRef.current = false;
      inputRef.current?.focus();
    }
  }, [activeConv, input, sending, user?.id, loadConversations, loadMessages, setSearchParams, paramReceiverId]);

  const handleRetryMessage = useCallback(async (failedMsg) => {
    if (!failedMsg || sending || sendLockRef.current) return;
    const text = String(failedMsg?.content || failedMsg?.message || '').trim();
    if (!text) return;

    const receiverId = failedMsg?.receiver_id || activeConv?.other_user?.id || paramReceiverId;
    if (!receiverId) {
      toast.error('Cannot determine recipient');
      return;
    }

    const stableClientMessageId = String(failedMsg?.client_message_id || '').trim() || generateClientMessageId();

    setMessages((prev) => prev.map((m) => {
      const same = m?.id === failedMsg?.id || String(m?.client_message_id || '') === stableClientMessageId;
      if (!same) return m;
      return {
        ...m,
        message_status: 'sending',
        optimistic: true,
        error: null,
        client_message_id: stableClientMessageId,
      };
    }));

    sendLockRef.current = true;
    setSending(true);

    try {
      const sendRes = await messagesAPI.send({
        receiver_id: receiverId,
        listing_id: activeConv?.listing_id || failedMsg?.listing_id || undefined,
        content: text,
        message: text,
        client_message_id: stableClientMessageId,
      });
      const serverMsg = sendRes?.data?.message_data;
      if (serverMsg) {
        setMessages((prev) => dedupeMessages(mergeMessageByIdentity(prev, serverMsg)));
      }
      await loadConversations();
    } catch (err) {
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        'Unknown server error';
      setMessages((prev) => prev.map((m) => {
        const same = m?.id === failedMsg?.id || String(m?.client_message_id || '') === stableClientMessageId;
        if (!same) return m;
        return {
          ...m,
          message_status: 'failed',
          optimistic: false,
          error: detail,
          client_message_id: stableClientMessageId,
        };
      }));
      toast.error(`Retry failed: ${detail}`);
    } finally {
      setSending(false);
      sendLockRef.current = false;
    }
  }, [activeConv?.listing_id, activeConv?.other_user?.id, loadConversations, paramReceiverId, sending]);

  const handleSelectConv = useCallback((conv) => {
    if (conv?.id) {
      setConversations(prev => {
        const next = (Array.isArray(prev) ? prev : []).map(item =>
          item?.id === conv.id ? { ...item, unread_count: 0 } : item
        );
        return next;
      });
    }
    setActiveConv(conv);
    setMobileView('chat');
    shouldAutoScroll.current = true;
    // Update URL with conversation_id
    const next = new URLSearchParams();
    if (conv.id) next.set('conversation_id', conv.id);
    setSearchParams(next, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    if (!activeConv?.id) return;
    setConversations(prev => {
      const next = (Array.isArray(prev) ? prev : []).map(item =>
        item?.id === activeConv.id ? { ...item, unread_count: 0 } : item
      );
      return next;
    });
  }, [activeConv?.id]);

  const filteredConvs = conversations.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (c.other_user?.name || '').toLowerCase().includes(q) ||
      (c.last_message || '').toLowerCase().includes(q) ||
      (c.listing_title || c.listing_id || '').toLowerCase().includes(q);
  });

  const grouped = groupMessagesByDate(messages);

  return (
    <div className="h-screen flex flex-col bg-stone-50 overflow-hidden" data-testid="chat-page">
      <SeoHead robots="noindex, nofollow" title="Chat – Gruvora (Private)" description="Private chat between users and owners. This page is not indexed." />
      <Header />
      <div className="flex-1 flex overflow-hidden">

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <aside className={`
          ${mobileView === 'chat' ? 'hidden lg:flex' : 'flex'}
          w-full lg:w-80 xl:w-96 flex-col bg-white border-r border-stone-200
          flex-shrink-0 overflow-hidden
        `}>
          {/* Sidebar header */}
          <div className="px-4 py-3 border-b border-stone-100 bg-white">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-stone-900 text-lg">Messages</h2>
              <Badge variant="secondary" className="text-xs">{conversations.length}</Badge>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-9 pr-3 py-2 bg-stone-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-stone-400"
              />
            </div>
          </div>

          {/* Conversations list */}
          <div className="flex-1 overflow-y-auto">
            {loadingConvs ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : filteredConvs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-stone-400 gap-3">
                <MessageCircle className="w-10 h-10 opacity-40" />
                <p className="text-sm">{searchQuery ? 'No results found' : 'No conversations yet'}</p>
              </div>
            ) : (
              filteredConvs.map(conv => (
                <ConversationItem
                  key={conv.id || conv.listing_id}
                  conv={conv}
                  isActive={activeConv?.id === conv.id && conv.id}
                  onClick={() => handleSelectConv(conv)}
                  currentUserId={user?.id}
                />
              ))
            )}
          </div>
        </aside>

        {/* ── Chat pane ────────────────────────────────────────────────────── */}
        <main className={`
          ${mobileView === 'list' ? 'hidden lg:flex' : 'flex'}
          flex-1 flex-col bg-[#eae6df] overflow-hidden
        `}>
          {!activeConv ? (
            <div className="flex-1 flex flex-col items-center justify-center text-stone-400 gap-4 bg-stone-50">
              <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center">
                <MessageCircle className="w-10 h-10 opacity-40" />
              </div>
              <div className="text-center">
                <p className="font-medium text-stone-600">Select a conversation</p>
                <p className="text-sm text-stone-400 mt-1">Choose from your existing conversations</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="bg-white border-b border-stone-200 px-4 py-3 flex items-center gap-3 shadow-sm flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setMobileView('list')}
                  className="lg:hidden p-1.5 hover:bg-stone-100 rounded-lg"
                >
                  <ArrowLeft className="w-5 h-5 text-stone-600" />
                </button>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-primary/60 flex items-center justify-center text-white font-bold flex-shrink-0">
                  {(activeConv.other_user?.name || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-stone-900 truncate">
                    {activeConv.other_user?.name || 'Chat'}
                  </p>
                  <div className="flex items-center gap-2">
                    {socketConnected ? (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block animate-pulse" />
                        Online
                      </span>
                    ) : (
                      <span className="text-xs text-stone-400">Connecting...</span>
                    )}
                    {(activeConv.listing_title || activeConv.listing_id) && (
                      <>
                        <span className="text-stone-300">·</span>
                        {activeConv.listing_id ? (
                          <Link
                            to={`/listing/${activeConv.listing_id}`}
                            className="flex items-center gap-1 text-xs text-primary hover:underline truncate max-w-48"
                          >
                            <Building2 className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{activeConv.listing_title || activeConv.listing_id}</span>
                            <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                          </Link>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-stone-500 truncate max-w-48">
                            <Building2 className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{activeConv.listing_title}</span>
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Safety banner */}
              <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 flex-shrink-0">
                <p className="text-xs text-amber-700 text-center">
                  🔒 For your safety, all communications must stay within this platform
                </p>
              </div>

              {/* Messages area */}
              <div
                ref={messageListRef}
                className="flex-1 overflow-y-auto px-4 py-3 space-y-1"
                style={{ scrollBehavior: 'smooth' }}
                onScroll={() => {
                  shouldAutoScroll.current = isNearBottom();
                }}
              >
                {/* Load older button */}
                {hasMore && !loadingMsgs && (
                  <div className="flex justify-center py-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadMessages(activeConv.id, msgPage + 1, true)}
                      disabled={loadingOlder}
                      className="bg-white/90 backdrop-blur-sm shadow-sm text-xs"
                    >
                      {loadingOlder
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                        : <ChevronUp className="w-3.5 h-3.5 mr-1.5" />}
                      Load older messages
                    </Button>
                  </div>
                )}

                {loadingMsgs ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : grouped.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-3">
                    <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm">
                      <MessageCircle className="w-7 h-7 text-primary/50" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-stone-700">Start the conversation</p>
                      <p className="text-xs text-stone-400 mt-0.5">Send a message to begin</p>
                    </div>
                    {/* Quick replies */}
                    <div className="flex flex-wrap gap-2 justify-center mt-2">
                      {['Is this available?', 'What\'s the price?', 'Can I visit?', 'Tell me more'].map(q => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setInput(q)}
                          className="px-3 py-1.5 bg-white border border-stone-200 rounded-full text-xs text-stone-700 hover:bg-stone-50 shadow-sm"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  grouped.map((item, idx) => {
                    if (item.type === 'date') {
                      return (
                        <div key={item.id} className="flex items-center justify-center py-2">
                          <span className="bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full text-xs text-stone-500 shadow-sm border border-stone-200/50">
                            {formatDate(item.date)}
                          </span>
                        </div>
                      );
                    }
                    const isMine = item.sender_id === user?.id;
                    const prevMsg = grouped[idx - 1];
                    const showAvatar = !prevMsg || prevMsg.type === 'date' || prevMsg.sender_id !== item.sender_id;
                    return (
                      <MessageBubble
                        key={item.id}
                        msg={item}
                        isMine={isMine}
                        showAvatar={showAvatar}
                        senderInitial={(activeConv.other_user?.name || '?')[0].toUpperCase()}
                        onRetry={handleRetryMessage}
                      />
                    );
                  })
                )}

                {/* Typing indicator */}
                {typingUsers.size > 0 && (
                  <div className="flex items-end gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">
                      {(activeConv.other_user?.name || '?')[0].toUpperCase()}
                    </div>
                    <div className="bg-white border border-stone-100 px-4 py-2.5 rounded-2xl rounded-bl-sm shadow-sm">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input bar */}
              <div className="bg-white border-t border-stone-200 px-3 py-3 flex-shrink-0">
                <form onSubmit={handleSend} className="flex items-end gap-2">
                  <div className="flex-1 bg-stone-100 rounded-2xl px-4 py-2.5 flex items-end gap-2">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={e => {
                        setInput(e.target.value);
                        // Auto-resize
                        e.target.style.height = 'auto';
                        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Type a message..."
                      rows={1}
                      className="flex-1 bg-transparent text-sm text-stone-900 placeholder:text-stone-400 outline-none resize-none leading-relaxed max-h-32 overflow-y-auto"
                      style={{ height: '24px' }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!input.trim() || sending}
                    className="w-11 h-11 bg-primary rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-all active:scale-95 shadow-sm"
                  >
                    {sending
                      ? <Loader2 className="w-4.5 h-4.5 text-white animate-spin" />
                      : <Send className="w-4.5 h-4.5 text-white" />}
                  </button>
                </form>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default ChatPage;
