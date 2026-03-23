import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from './Layout';
import { useNotifications } from './Notifications';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Bell, MessageCircle, Calendar, CreditCard, Heart, UserPlus, Home } from 'lucide-react';

const getIcon = (type) => {
  switch (type) {
    case 'booking':
      return Calendar;
    case 'payment':
      return CreditCard;
    case 'chat':
      return MessageCircle;
    case 'message':
      return MessageCircle;
    case 'like':
      return Heart;
    case 'follow':
      return UserPlus;
    case 'listing':
      return Home;
    default:
      return Bell;
  }
};

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
};

export const NotificationsPage = () => {
  const navigate = useNavigate();
  const { notifications, unreadCount, fetchNotifications, markAsRead, markAllAsRead } = useNotifications();
  const [unreadOnly, setUnreadOnly] = useState(false);

  useEffect(() => {
    fetchNotifications(true);
  }, [fetchNotifications]);

  const items = useMemo(() => {
    if (!unreadOnly) return notifications;
    return notifications.filter((item) => !item.read);
  }, [notifications, unreadOnly]);

  const openNotification = async (notif) => {
    if (!notif?.id) return;

    if (!notif.read) {
      await markAsRead(notif.id);
    }

    const listingId = notif.related_listing_id || notif.listing_id || notif?.data?.listing_id;
    const senderId = notif.sender_id || notif?.data?.sender_id;

    if (listingId) {
      const params = new URLSearchParams({ listing_id: String(listingId) });
      if (senderId) {
        params.set('user', String(senderId));
      }
      navigate(`/chat?${params.toString()}`);
      return;
    }

    if (notif.related_url) {
      navigate(notif.related_url);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50" data-testid="notifications-page">
      <Header />
      <div className="container-main py-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl">Notifications</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Real-time alerts for chat and activity</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{unreadCount} unread</Badge>
              <Button variant="outline" size="sm" onClick={() => setUnreadOnly((prev) => !prev)}>
                {unreadOnly ? 'Show all' : 'Unread only'}
              </Button>
              <Button size="sm" onClick={markAllAsRead} disabled={unreadCount === 0}>
                Mark all read
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Bell className="w-12 h-12 mx-auto mb-3 text-stone-300" />
                <p>No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y rounded-lg border bg-white">
                {items.map((notif) => {
                  const Icon = getIcon(notif.type);
                  return (
                    <button
                      type="button"
                      key={notif.id}
                      onClick={() => openNotification(notif)}
                      className={`w-full text-left p-4 hover:bg-stone-50 transition-colors ${notif.read ? '' : 'bg-primary/5'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
                          <Icon className="w-5 h-5 text-stone-700" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm ${notif.read ? '' : 'font-semibold'}`}>{notif.title || 'Notification'}</p>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{notif.message}</p>
                          <p className="text-xs text-muted-foreground mt-2">{formatTime(notif.created_at)}</p>
                        </div>
                        {!notif.read ? <div className="w-2 h-2 rounded-full bg-primary mt-2" /> : null}
                      </div>
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
