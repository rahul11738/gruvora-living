import React, { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { notificationsAPI, messagesAPI } from '../lib/api';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Bell, X, Check, CheckCheck, MessageCircle, Calendar,
  CreditCard, Heart, UserPlus, Home, AlertCircle, ShieldCheck,
  Building2,
} from 'lucide-react';

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

// ── Reconnect state ──────────────────────────────────────────────────────────
let _notifSocket = null;
let _reconnectAttempt = 0;
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];

// ── Helpers ──────────────────────────────────────────────────────────────────
const toSafeText = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    if (typeof value.message === 'string') return value.message;
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }
  return fallback;
};

const normalizeNotif = (n) => {
  if (!n || typeof n !== 'object') return null;
  const read = Boolean(n.read ?? n.is_read ?? false);
  return {
    ...n,
    title: toSafeText(n.title, 'Notification'),
    message: toSafeText(n.message, ''),
    listing_title: toSafeText(n.listing_title ?? n?.data?.listing_title, ''),
    read,
    is_read: read,
  };
};

const isSyntheticNotificationId = (id) => String(id || '').startsWith('fallback-chat-');

const toEpochMs = (value) => {
  const ts = new Date(value || 0).getTime();
  return Number.isFinite(ts) ? ts : 0;
};

const asArray = (value) => (Array.isArray(value) ? value : []);

const buildFallbackChatNotifications = (conversations = [], existing = []) => {
  const existingByConv = new Set(
    asArray(existing)
      .filter(Boolean)
      .filter(n => ['chat', 'message', 'booking_request', 'negotiation', 'negotiation_response', 'booking_update'].includes(n.type))
      .map(n => String(n.conversation_id || n?.data?.conversation_id || ''))
      .filter(Boolean)
  );

  return asArray(conversations)
    .filter(Boolean)
    .filter(c => String(c?.id || '').trim().length > 0)
    .filter(c => Number(c?.unread_count || 0) > 0)
    .filter(c => !existingByConv.has(String(c?.id || '')))
    .map(c => {
      const otherName = c?.other_user?.name || 'User';
      const lastMessage = String(c?.last_message || '').trim();
      return {
        id: `fallback-chat-${String(c.id || '')}`,
        type: 'chat',
        title: `New message from ${otherName}`,
        message: lastMessage || 'You have a new message',
        conversation_id: c?.id,
        listing_id: c?.listing_id,
        listing_title: c?.listing_title || '',
        sender_id: c?.other_user?.id,
        read: false,
        is_read: false,
        created_at: c?.last_message_at || new Date().toISOString(),
        data: {
          conversation_id: c?.id,
          listing_id: c?.listing_id,
          listing_title: c?.listing_title || '',
          sender_id: c?.other_user?.id,
        },
      };
    });
};

/**
 * Build the navigation target from a notification.
 * Priority: conversation_id → listing_id + sender → listing detail → related_url
 */
const getNotifNavTarget = (notif) => {
  if (!notif) return null;
  const convId = notif.conversation_id || notif?.data?.conversation_id;
  const listingId = notif.listing_id || notif.related_listing_id || notif?.data?.listing_id;
  const senderId = notif.sender_id || notif?.data?.sender_id;
  const CHAT_TYPES = ['chat', 'message', 'booking_request', 'negotiation', 'negotiation_response', 'booking_update'];

  if (CHAT_TYPES.includes(notif.type)) {
    if (convId) return `/chat?conversation_id=${convId}`;
    if (listingId && senderId) return `/chat?listing_id=${listingId}&user=${senderId}`;
    if (listingId) return `/chat?listing_id=${listingId}`;
    return '/chat';
  }

  if (notif.type === 'listing_status' && listingId) return `/listing/${listingId}`;

  if (notif.type === 'new_follower') {
    const followerId = notif?.data?.follower_id;
    if (followerId) return `/user/${followerId}`;
  }

  if (notif.type === 'new_comment') {
    const videoId = notif?.data?.video_id;
    if (videoId) return `/reels?video=${videoId}`;
  }

  if (notif.related_url) return notif.related_url;
  return null;
};

// ─── Context ─────────────────────────────────────────────────────────────────
const NotificationContext = createContext(null);

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
};

// ─── Provider ────────────────────────────────────────────────────────────────
export const NotificationProvider = ({ children }) => {
  const { token, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const lastFetchRef = useRef(0);
  const fetchingRef = useRef(false);
  const socketRef = useRef(null);
  const lastUnreadRef = useRef(0);

  // ── Connect Socket.IO ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || !token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      return;
    }

    const connectSocket = () => {
      if (socketRef.current?.connected) return;
      if (socketRef.current) { socketRef.current.removeAllListeners(); socketRef.current.disconnect(); }

      const socket = io(API_URL, {
        transports: ['polling', 'websocket'],
        path: '/socket.io',
        autoConnect: true,
        reconnection: false,
      });

      socket.on('connect', () => {
        _reconnectAttempt = 0;
        setIsConnected(true);
        socket.emit('authenticate', { token });
      });

      socket.on('disconnect', () => {
        setIsConnected(false);
        const delay = RECONNECT_DELAYS[Math.min(_reconnectAttempt, RECONNECT_DELAYS.length - 1)];
        _reconnectAttempt++;
        setTimeout(connectSocket, delay);
      });

      socket.on('connect_error', () => {
        console.warn('[notif-socket] connect_error', { apiUrl: API_URL });
        setIsConnected(false);
        const delay = RECONNECT_DELAYS[Math.min(_reconnectAttempt, RECONNECT_DELAYS.length - 1)];
        _reconnectAttempt++;
        setTimeout(connectSocket, delay);
      });

      socket.on('authenticated', () => {
        // Avoid reconnect refetch from wiping locally synthesized unread items.
        setNotifications(prev => {
          if (asArray(prev).length === 0) {
            fetchNotifications(true);
          }
          return prev;
        });
      });

      const handleIncomingNotification = (notif) => {
        try {
          const n = normalizeNotif(notif);
          if (!n?.id) return;
          const target = getNotifNavTarget(n);
          let inserted = false;
          setNotifications(prev => {
            // Deduplicate by id
            const safePrev = asArray(prev);
            if (safePrev.some(p => p?.id === n.id)) return safePrev;
            inserted = true;
            return [n, ...safePrev];
          });
          if (inserted) {
            setUnreadCount(prev => {
              const next = prev + 1;
              lastUnreadRef.current = next;
              return next;
            });
          }
          // Browser notification
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
              const browserNotification = new Notification(n.title || 'New notification', {
                body: n.message,
                icon: '/favicon.ico',
                tag: n.id,
              });
              browserNotification.onclick = () => {
                try {
                  window.focus();
                  if (target) {
                    window.location.assign(target);
                  }
                } catch {}
              };
            } catch {}
          }
        } catch (err) {
          console.warn('[notifications] incoming handler failed', err);
        }
      };

      socket.on('notification', handleIncomingNotification);
      socket.on('new_notification', handleIncomingNotification);

      socket.on('unread_notifications', (data) => {
        try {
          const normalized = asArray(data?.notifications).map(normalizeNotif).filter(Boolean);
          setNotifications(prev => {
            // Merge: keep optimistic updates, add server ones
            const existingIds = new Set(asArray(prev).map(p => p?.id).filter(Boolean));
            const newOnes = normalized.filter(n => !existingIds.has(n.id));
            return [...asArray(prev), ...newOnes].sort((a, b) => toEpochMs(b?.created_at) - toEpochMs(a?.created_at));
          });
          const socketCount = typeof data?.count === 'number' ? data.count : normalized.filter(n => !n.read).length;
          if (socketCount > lastUnreadRef.current) {
            setUnreadCount(socketCount);
            lastUnreadRef.current = socketCount;
          }
        } catch (err) {
          console.warn('[notifications] unread_notifications handler failed', err);
        }
      });

      socketRef.current = socket;
    };

    connectSocket();

    // Request browser notification permission
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    return () => {
      socketRef.current?.removeAllListeners();
      socketRef.current?.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [isAuthenticated, token]); // eslint-disable-line

  // ── Fetch notifications (debounced) ────────────────────────────────────────
  const fetchNotifications = useCallback(async (force = false) => {
    if (!token || fetchingRef.current) return;
    const now = Date.now();
    if (!force && now - lastFetchRef.current < 15_000) return;
    try {
      fetchingRef.current = true;
      const [notifRes, convRes] = await Promise.all([
        notificationsAPI.getAll(1, 50),
        messagesAPI.getConversations().catch(() => ({ data: { conversations: [] } })),
      ]);

      const data = notifRes?.data || {};
      const normalized = asArray(data?.notifications).map(normalizeNotif).filter(Boolean);
      const conversations = asArray(convRes?.data?.conversations);
      const fallbackChat = buildFallbackChatNotifications(conversations, normalized);
      const merged = [...fallbackChat, ...normalized].sort((a, b) => toEpochMs(b.created_at) - toEpochMs(a.created_at));

      let nextNotifications = merged;
      setNotifications(prev => {
        const stickyUnreadSynthetic = asArray(prev).filter(n =>
          n &&
          isSyntheticNotificationId(n.id) &&
          !n.read &&
          !n.is_read &&
          !asArray(merged).some(m => m?.id === n.id)
        );
        nextNotifications = [...asArray(merged), ...stickyUnreadSynthetic].sort(
          (a, b) => toEpochMs(b?.created_at) - toEpochMs(a?.created_at)
        );
        return nextNotifications;
      });

      const serverUnread = typeof data.unread_count === 'number' ? data.unread_count : 0;
      const mergedUnread = asArray(nextNotifications).filter(n => n && !n.read).length;
      // Never auto-clear unread via background fetch; only user actions reduce it.
      const nextUnread = Math.max(lastUnreadRef.current, serverUnread, mergedUnread);
      setUnreadCount(nextUnread);
      lastUnreadRef.current = nextUnread;
      lastFetchRef.current = Date.now();
    } catch (error) {
      if (error?.response?.status === 429) {
        console.warn('Notifications rate-limited');
      }
    } finally {
      fetchingRef.current = false;
    }
  }, [token]);

  // Poll unread count as a fallback when websocket delivery is delayed or dropped.
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const intervalId = setInterval(async () => {
      try {
        const response = await notificationsAPI.getUnreadCount();
        const data = response?.data || {};
        const serverUnread = Number(data?.unread_count || 0);

        // Only sync up for new notifications; never auto-clear unread items.
        if (serverUnread > lastUnreadRef.current) {
          setUnreadCount(serverUnread);
          lastUnreadRef.current = serverUnread;
          await fetchNotifications(true);
        }
      } catch {}
    }, 5000);

    return () => clearInterval(intervalId);
  }, [isAuthenticated, token, fetchNotifications]);

  // ── Mark single read ────────────────────────────────────────────────────────
  const markAsRead = useCallback(async (id) => {
    if (!id) return;
    // Optimistic update
    setNotifications(prev => asArray(prev).map(n => n?.id === id ? { ...n, read: true, is_read: true } : n));
    setUnreadCount(prev => {
      const next = Math.max(0, prev - 1);
      lastUnreadRef.current = next;
      return next;
    });
    if (isSyntheticNotificationId(id)) return;
    try {
      await notificationsAPI.markRead(id);
    } catch {}
  }, [token]);

  // ── Mark all read ───────────────────────────────────────────────────────────
  const markAllAsRead = useCallback(async () => {
    setNotifications(prev => asArray(prev).map(n => ({ ...n, read: true, is_read: true })));
    setUnreadCount(0);
    lastUnreadRef.current = 0;
    try {
      await notificationsAPI.markAllRead();
    } catch {}
  }, [token]);

  return (
    <NotificationContext.Provider value={{
      socket: socketRef.current,
      notifications,
      unreadCount,
      isConnected,
      markAsRead,
      markAllAsRead,
      fetchNotifications,
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

// ─── Bell ─────────────────────────────────────────────────────────────────────
export const NotificationBell = () => {
  const { unreadCount, fetchNotifications } = useNotifications();
  const [open, setOpen] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const previousUnreadRef = useRef(unreadCount);

  useEffect(() => {
    if (open) fetchNotifications(true);
  }, [open, fetchNotifications]);

  useEffect(() => {
    if (unreadCount > previousUnreadRef.current) {
      setShakeKey(Date.now());
    }
    previousUnreadRef.current = unreadCount;
  }, [unreadCount]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="relative w-10 h-10 flex items-center justify-center rounded-full bg-stone-100 hover:bg-stone-200 transition-colors"
        data-testid="notification-bell"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      >
        <motion.div
          key={shakeKey}
          animate={unreadCount > 0 ? { rotate: [0, -10, 10, -6, 6, 0] } : {}}
          transition={{ duration: 0.45 }}
        >
          <Bell className="w-5 h-5 text-stone-600" />
        </motion.div>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && <NotificationDropdown onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </div>
  );
};

// ─── Icon helpers ─────────────────────────────────────────────────────────────
const ICON_MAP = {
  booking: { Icon: Calendar, cls: 'text-blue-600 bg-blue-50' },
  booking_request: { Icon: Calendar, cls: 'text-blue-600 bg-blue-50' },
  booking_update: { Icon: Calendar, cls: 'text-blue-600 bg-blue-50' },
  payment: { Icon: CreditCard, cls: 'text-green-600 bg-green-50' },
  commission: { Icon: CreditCard, cls: 'text-green-600 bg-green-50' },
  chat: { Icon: MessageCircle, cls: 'text-emerald-600 bg-emerald-50' },
  message: { Icon: MessageCircle, cls: 'text-emerald-600 bg-emerald-50' },
  like: { Icon: Heart, cls: 'text-red-500 bg-red-50' },
  new_follower: { Icon: UserPlus, cls: 'text-pink-600 bg-pink-50' },
  listing_status: { Icon: Home, cls: 'text-primary bg-primary/10' },
  negotiation: { Icon: MessageCircle, cls: 'text-orange-600 bg-orange-50' },
  negotiation_response: { Icon: MessageCircle, cls: 'text-orange-600 bg-orange-50' },
  admin_message: { Icon: ShieldCheck, cls: 'text-purple-600 bg-purple-50' },
  system: { Icon: AlertCircle, cls: 'text-stone-600 bg-stone-100' },
};

const getIconConfig = (type) => ICON_MAP[type] || { Icon: Bell, cls: 'text-stone-500 bg-stone-100' };

const formatRelTime = (dateStr) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

// ─── Dropdown ─────────────────────────────────────────────────────────────────
const NotificationDropdown = ({ onClose }) => {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const handleClick = async (notif) => {
    if (!notif?.id) return;
    if (!notif.read) await markAsRead(notif.id);
    const target = getNotifNavTarget(notif);
    if (target) { navigate(target); onClose(); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className="absolute right-0 top-12 w-80 md:w-96 bg-white rounded-xl shadow-2xl border border-stone-200 z-50 overflow-hidden"
      data-testid="notification-dropdown"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-stone-600" />
          <span className="font-semibold text-stone-900 text-sm">Notifications</span>
          {unreadCount > 0 && (
            <Badge className="bg-red-100 text-red-700 text-xs px-1.5">{unreadCount} new</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="text-xs text-primary hover:underline font-medium"
            >
              Mark all read
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-stone-100"
          >
            <X className="w-3.5 h-3.5 text-stone-500" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="max-h-[420px] overflow-y-auto overscroll-contain divide-y divide-stone-50">
        {asArray(notifications).length === 0 ? (
          <div className="py-12 text-center">
            <Bell className="w-10 h-10 text-stone-200 mx-auto mb-3" />
            <p className="text-sm text-stone-400">No notifications yet</p>
          </div>
        ) : (
          asArray(notifications).filter(Boolean).slice(0, 30).map(notif => {
            const { Icon, cls } = getIconConfig(notif.type);
            const target = getNotifNavTarget(notif);
            const listingTitle = notif.listing_title || notif?.data?.listing_title || '';
            const isChatType = ['chat', 'message', 'booking_request', 'negotiation', 'negotiation_response', 'booking_update'].includes(notif.type);
            return (
              <button
                key={notif.id}
                type="button"
                onClick={() => handleClick(notif)}
                disabled={!target}
                className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-stone-50 transition-colors ${!notif.read ? 'bg-primary/3' : ''} ${!target ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${cls}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className={`text-sm leading-snug ${!notif.read ? 'font-semibold text-stone-900' : 'font-medium text-stone-700'}`}>
                    {notif.title}
                  </p>
                  <p className="text-xs text-stone-500 mt-0.5 line-clamp-2 leading-relaxed">
                    {notif.message}
                  </p>
                  {isChatType && listingTitle && (
                    <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 text-[10px] font-medium max-w-full">
                      <Building2 className="w-2.5 h-2.5 flex-shrink-0" />
                      <span className="truncate">{listingTitle}</span>
                    </span>
                  )}
                  <p className="text-[11px] text-stone-400 mt-1">{formatRelTime(notif.created_at)}</p>
                  {target && (
                    <p className="text-[11px] text-primary font-medium mt-0.5">
                      {isChatType ? '→ Reply' : '→ View'}
                    </p>
                  )}
                </div>
                {!notif.read && (
                  <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1.5" />
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="border-t border-stone-100 px-4 py-2.5 text-center">
          <button
            type="button"
            className="text-xs text-primary hover:underline font-medium"
            onClick={() => { navigate('/notifications'); onClose(); }}
          >
            View all notifications →
          </button>
        </div>
      )}
    </motion.div>
  );
};

export default NotificationProvider;
