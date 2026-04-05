import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from './Layout';
import { useNotifications } from './Notifications.jsx';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import {
  Bell, MessageCircle, Calendar, CreditCard, Heart, UserPlus,
  Home, AlertCircle, ShieldCheck, Building2,
} from 'lucide-react';

const asArray = (value) => (Array.isArray(value) ? value : []);

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

const CHAT_TYPES = ['chat', 'message', 'booking_request', 'negotiation', 'negotiation_response', 'booking_update'];
const LISTING_TYPES = ['listing_status', 'booking_request', 'booking_update'];

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

const getNavTarget = (notif) => {
  if (!notif || typeof notif !== 'object') return null;
  const convId    = notif.conversation_id || notif?.data?.conversation_id;
  const listingId = notif.listing_id || notif.related_listing_id || notif?.data?.listing_id;
  const senderId  = notif.sender_id || notif?.data?.sender_id;

  if (CHAT_TYPES.includes(notif.type)) {
    if (convId) return `/chat?conversation_id=${convId}`;
    if (listingId && senderId) return `/chat?listing_id=${listingId}&user=${senderId}`;
    if (listingId) return `/chat?listing_id=${listingId}`;
    return '/chat';
  }
  if (notif.type === 'listing_status' && listingId) return `/listing/${listingId}`;
  if (notif.type === 'new_follower' && notif?.data?.follower_id) return `/user/${notif.data.follower_id}`;
  if (notif.type === 'new_comment' && notif?.data?.video_id) return `/reels?video=${notif.data.video_id}`;
  if (notif.related_url) return notif.related_url;
  return null;
};

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const ts = new Date(dateStr).getTime();
  if (!Number.isFinite(ts)) return '';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const NotificationsPage = () => {
  const navigate = useNavigate();
  const { notifications, unreadCount, fetchNotifications, markAsRead, markAllAsRead } = useNotifications();
  const [filter, setFilter] = useState('all'); // 'all' | 'unread' | 'chat' | 'listing'

  useEffect(() => { fetchNotifications(true); }, [fetchNotifications]);

  useEffect(() => {
    if (filter === 'unread' && unreadCount === 0) {
      setFilter('all');
    }
  }, [unreadCount, filter]);

  const items = useMemo(() => {
    return asArray(notifications).filter(n => {
      if (!n || typeof n !== 'object') return false;
      if (filter === 'unread') return !n.read;
      if (filter === 'chat') return CHAT_TYPES.includes(n.type);
      if (filter === 'listing') return LISTING_TYPES.includes(n.type);
      return true;
    });
  }, [notifications, filter]);

  const openNotif = async (notif) => {
    try {
      if (!notif?.id) return;
      if (!notif.read) await markAsRead(notif.id);
      const target = getNavTarget(notif);
      if (target) navigate(target);
    } catch (err) {
      console.warn('[notifications-page] open notification failed', err);
    }
  };

  const FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'unread', label: `Unread (${unreadCount})` },
    { id: 'chat', label: 'Messages' },
    { id: 'listing', label: 'Listings' },
  ];

  return (
    <div className="min-h-screen bg-stone-50" data-testid="notifications-page">
      <Header />
      <div className="container-main py-6 max-w-2xl">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Bell className="w-5 h-5 text-primary" />
                  Notifications
                </CardTitle>
                <p className="text-sm text-stone-500 mt-0.5">{unreadCount} unread</p>
              </div>
              <Button size="sm" onClick={markAllAsRead} disabled={unreadCount === 0}>
                Mark all read
              </Button>
            </div>

            {/* Filter pills - horizontal scroll without wrapping on small screens */}
            <div className="overflow-x-auto -mx-1 mt-3">
              <div className="flex gap-2 px-1 pb-1" style={{ width: 'max-content' }}>
                {FILTERS.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                      filter === f.id
                        ? 'bg-primary text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {items.length === 0 ? (
              <div className="py-16 text-center text-stone-400">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No notifications in this category</p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {items.map(notif => {
                  const { Icon, cls } = getIconConfig(notif.type);
                  const target = getNavTarget(notif);
                  const listingTitle = toSafeText(notif.listing_title || notif?.data?.listing_title, '');
                  const safeTitle = toSafeText(notif.title, 'Notification');
                  const safeMessage = toSafeText(notif.message, '');
                  const isChatType = CHAT_TYPES.includes(notif.type);
                  const isRead = Boolean(notif.read || notif.is_read);
                  return (
                    <button
                      key={notif.id}
                      type="button"
                      onClick={() => openNotif(notif)}
                      disabled={!target}
                      className={`w-full text-left flex items-start gap-3 px-4 py-4 hover:bg-stone-50 transition-colors ${
                        !isRead ? 'bg-primary/3' : ''
                      } ${!target ? 'cursor-default' : ''}`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${cls}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!isRead ? 'font-semibold text-stone-900' : 'font-medium text-stone-700'}`}>
                          {safeTitle}
                        </p>
                        <p className="text-sm text-stone-500 mt-0.5 line-clamp-2 leading-relaxed">
                          {safeMessage}
                        </p>
                        {isChatType && listingTitle && (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 text-[10px] font-medium max-w-full">
                            <Building2 className="w-2.5 h-2.5 flex-shrink-0" />
                            <span className="truncate">{listingTitle}</span>
                          </span>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          <p className="text-xs text-stone-400">{formatTime(notif.created_at)}</p>
                          {target && (
                            <span className="text-xs text-primary font-medium">
                              {isChatType ? '→ Reply' :
                               notif.type === 'listing_status' ? '→ View listing' :
                               notif.type === 'new_follower' ? '→ View profile' : '→ Open'}
                            </span>
                          )}
                        </div>
                      </div>
                      {!isRead && (
                        <span className="w-2.5 h-2.5 bg-primary rounded-full flex-shrink-0 mt-1" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NotificationsPage;
