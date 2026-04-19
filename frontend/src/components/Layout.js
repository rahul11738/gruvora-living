import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NotificationBell } from './Notifications';
import { Button } from './ui/button';
import { observeRoutePrefetch, prefetchDiscoverRoute, prefetchReelsRoute } from '../lib/routePrefetch';
import { markRouteNavigation } from '../lib/routeTelemetry';
import { messagesAPI } from '../lib/api';
import BrandedLogo from './BrandedLogo';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Home,
  Building2,
  Hotel,
  PartyPopper,
  Wrench,
  User,
  LogOut,
  Heart,
  Settings,
  LayoutDashboard,
  Play,
  MessageCircle,
  Compass as DiscoverIcon,
  Youtube,
  Instagram,
  Facebook,
  Mail,
} from 'lucide-react';

const categories = [
  { id: 'home', name: 'Home', nameGu: 'ઘર', icon: Home, href: '/category/home' },
  { id: 'business', name: 'Business', nameGu: 'બિઝનેસ', icon: Building2, href: '/category/business' },
  { id: 'stay', name: 'Stay', nameGu: 'રહેવાનું', icon: Hotel, href: '/category/stay' },
  { id: 'event', name: 'Event', nameGu: 'ઇવેન્ટ', icon: PartyPopper, href: '/category/event' },
  { id: 'services', name: 'Services', nameGu: 'સેવાઓ', icon: Wrench, href: '/category/services' },
];

const categoryNavTheme = {
  active: 'bg-white text-stone-950 border border-stone-200 shadow-[0_14px_30px_rgba(15,23,42,0.14)]',
  inactive: 'bg-transparent text-stone-600 border border-transparent hover:bg-white/75 hover:border-stone-200/80',
};

const CHAT_UNREAD_EVENT = 'gharsetu:chat-unread-updated';
const headerActionBtnClass = 'relative h-10 w-10 md:h-11 md:w-11 inline-flex items-center justify-center rounded-2xl border border-stone-200/80 bg-gradient-to-b from-white to-stone-50 text-stone-600 shadow-[0_10px_22px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(15,23,42,0.12)] hover:text-stone-800';

export const Header = () => {
  const { user, isAuthenticated, isOwner, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const discoverLinkRef = useRef(null);
  const reelsLinkRef = useRef(null);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  useEffect(() => {
    const cleanupDiscover = observeRoutePrefetch(discoverLinkRef.current, prefetchDiscoverRoute, '240px');
    const cleanupReels = observeRoutePrefetch(reelsLinkRef.current, prefetchReelsRoute, '240px');

    return () => {
      cleanupDiscover();
      cleanupReels();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadUnreadChatCount = async () => {
      if (!isAuthenticated) {
        if (mounted) setUnreadChatCount(0);
        return;
      }
      try {
        const res = await messagesAPI.getConversations();
        const conversations = Array.isArray(res?.data?.conversations) ? res.data.conversations : [];
        const unreadTotal = conversations.reduce((sum, conv) => {
          const unread = Number(conv?.unread_count || 0);
          return sum + (Number.isFinite(unread) ? unread : 0);
        }, 0);
        if (mounted) setUnreadChatCount(unreadTotal);
      } catch {
        if (mounted) setUnreadChatCount(0);
      }
    };

    loadUnreadChatCount();
    const intervalId = setInterval(loadUnreadChatCount, 8000);

    const handleChatUnreadUpdated = (event) => {
      const nextUnread = Number(event?.detail?.unread);
      if (!mounted || !Number.isFinite(nextUnread)) return;
      setUnreadChatCount(Math.max(0, nextUnread));
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(CHAT_UNREAD_EVENT, handleChatUnreadUpdated);
    }

    return () => {
      mounted = false;
      clearInterval(intervalId);
      if (typeof window !== 'undefined') {
        window.removeEventListener(CHAT_UNREAD_EVENT, handleChatUnreadUpdated);
      }
    };
  }, [isAuthenticated, user?.id, location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleOpenChat = () => {
    if (isAuthenticated) {
      markRouteNavigation('/chat', 'header-chat-btn');
      navigate('/chat');
      return;
    }
    navigate('/login?next=%2Fchat');
  };

  const getDashboardLink = () => {
    if (isAdmin) return '/admin';
    if (isOwner) return '/owner/dashboard';
    return '/dashboard';
  };

  return (
    <>
      <header className="glass-header fixed top-0 left-0 right-0 z-50 standalone-safe-top" data-testid="header">
        <div className="container-main py-2 md:py-2.5">
          <div className="flex h-16 items-center justify-between gap-3 rounded-2xl border border-stone-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(248,250,252,0.9))] px-2.5 shadow-[0_14px_34px_rgba(15,23,42,0.08)] backdrop-blur-xl md:h-20 md:gap-4 md:px-4">
            {/* Branded Logo */}
            <Link to="/" className="flex shrink-0 items-center" data-testid="logo">
              <BrandedLogo variant="compact" />
            </Link>

            {/* Desktop Navigation */}
            <nav className="relative hidden xl:flex items-center gap-1.5 rounded-full p-1.5 bg-gradient-to-b from-white to-stone-50 border border-stone-200/80 shadow-[0_16px_36px_rgba(15,23,42,0.08)] backdrop-blur-md">
              {categories.map((cat) => {
                const isActive = location.pathname === cat.href;
                const Icon = cat.icon;
                return (
                  <Link
                    key={cat.id}
                    to={cat.href}
                    className={`group relative flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-semibold tracking-wide transition-all duration-200 ${isActive
                      ? categoryNavTheme.active
                      : categoryNavTheme.inactive
                      }`}
                    data-testid={`nav-${cat.id}`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${isActive ? 'bg-stone-100 text-stone-700' : 'bg-stone-100/80 text-stone-500 group-hover:text-stone-700'}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span>{cat.name}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Right Actions */}
            <div className="flex shrink-0 items-center gap-2 md:gap-3">
              {/* Discover Button - Hidden on mobile (in bottom nav) */}
              <Link
                to="/discover"
                ref={discoverLinkRef}
                onMouseEnter={prefetchDiscoverRoute}
                onFocus={prefetchDiscoverRoute}
                onClick={() => markRouteNavigation('/discover', 'header-discover-btn')}
                className="hidden md:flex items-center gap-2 px-4 py-2.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 shadow-[0_6px_18px_rgba(37,99,235,0.10)] hover:bg-blue-100 transition-colors"
                data-testid="discover-btn"
              >
                <DiscoverIcon className="w-4 h-4" />
                <span className="text-sm font-medium">Discover</span>
              </Link>

              {/* Reels Button - Hidden on mobile (in bottom nav) */}
              <Link
                to="/reels"
                ref={reelsLinkRef}
                onMouseEnter={prefetchReelsRoute}
                onFocus={prefetchReelsRoute}
                onClick={() => markRouteNavigation('/reels', 'header-reels-btn')}
                className="hidden md:flex items-center gap-2 px-4 py-2.5 rounded-full bg-secondary/10 text-secondary border border-orange-100 shadow-[0_6px_18px_rgba(249,115,22,0.14)] hover:bg-secondary/15 transition-colors"
                data-testid="reels-btn"
              >
                <Play className="w-4 h-4" />
                <span className="text-sm font-medium">Reels</span>
              </Link>

              {/* Chat - Available on mobile and desktop */}
              <button
                type="button"
                onClick={handleOpenChat}
                className={headerActionBtnClass}
                data-testid="chat-btn"
                aria-label="Open Chat"
                title="Open Chat"
              >
                <MessageCircle className="w-5 h-5 text-stone-600" />
                {isAuthenticated && unreadChatCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-emerald-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                    {unreadChatCount > 99 ? '99+' : unreadChatCount}
                  </span>
                )}
              </button>

              {isAuthenticated ? (
                <>
                  {/* Notifications */}
                  <div className="[&_button]:!rounded-2xl [&_button]:!border [&_button]:!border-stone-200/80 [&_button]:!bg-gradient-to-b [&_button]:!from-white [&_button]:!to-stone-50 [&_button]:!shadow-[0_10px_22px_rgba(15,23,42,0.08)] [&_button]:hover:!bg-stone-100">
                    <NotificationBell />
                  </div>

                  {/* User Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="flex min-w-0 max-w-[120px] items-center gap-1.5 rounded-2xl border border-emerald-200/70 bg-gradient-to-b from-emerald-50 to-white px-2 py-1.5 shadow-[0_10px_24px_rgba(5,150,105,0.14)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(5,150,105,0.18)] md:max-w-[132px] md:gap-2 md:px-2.5 md:py-2 2xl:max-w-[170px]"
                        data-testid="user-menu-btn"
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary md:h-8 md:w-8">
                          <User className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
                        </div>
                        <span className="hidden max-w-[92px] truncate text-sm font-semibold text-primary 2xl:block">
                          {user?.name?.split(' ')[0]}
                        </span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-60 rounded-2xl border border-stone-200 shadow-2xl p-2">
                      <div className="px-3 py-2">
                        <p className="font-semibold text-stone-900 truncate">{user?.name}</p>
                        <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                      </div>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to={getDashboardLink()} className="flex items-center gap-2 rounded-lg px-2 py-2">
                          <LayoutDashboard className="w-4 h-4" />
                          Dashboard
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/wishlist" className="flex items-center gap-2 rounded-lg px-2 py-2">
                          <Heart className="w-4 h-4" />
                          Wishlist
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/settings" className="flex items-center gap-2 rounded-lg px-2 py-2">
                          <Settings className="w-4 h-4" />
                          Settings
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout} className="text-destructive rounded-lg px-2 py-2">
                        <LogOut className="w-4 h-4 mr-2" />
                        Logout
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <div className="flex items-center gap-1.5 md:gap-2">
                  <Link to="/login">
                    <Button variant="ghost" className="rounded-xl px-3 text-sm font-semibold text-stone-700 hover:bg-stone-100 md:px-4" data-testid="login-btn">Login</Button>
                  </Link>
                  <Link to="/register" className="hidden md:block">
                    <Button className="btn-primary rounded-xl px-5 shadow-[0_10px_22px_rgba(5,150,105,0.2)]" data-testid="register-btn">Register</Button>
                  </Link>
                </div>
              )}

            </div>
          </div>
        </div>
      </header>
      {/* Spacer keeps content below the fixed header across all routes. */}
      <div className="h-[80px] md:h-[100px]" aria-hidden="true" />
    </>
  );
};

export const Footer = () => {
  const policyLinks = [
    { label: 'Terms & Conditions', href: '/terms-conditions' },
    { label: 'Privacy Policy', href: '/privacy-policy' },
    { label: 'Refund & Cancellation', href: '/refund-cancellation-policy' },
    { label: 'Disclaimer', href: '/disclaimer' },
    { label: 'About Us', href: '/about-us' },
    { label: 'User Verification Policy', href: '/user-verification-policy' },
    { label: 'Community Guidelines', href: '/community-guidelines' },
  ];

  const socialLinks = [
    {
      label: 'YouTube',
      href: 'https://youtube.com/@gruvora-channel?si=6s_wuVXVRfYp9K-M',
      icon: Youtube,
    },
    {
      label: 'Instagram',
      href: 'https://www.instagram.com/gruvora.com_?igsh=MTl5aHVxMTFscTgwZA==',
      icon: Instagram,
    },
    {
      label: 'Facebook',
      href: 'https://www.facebook.com/share/1BMsgoo66V/',
      icon: Facebook,
    },
    {
      label: 'Email',
      href: 'mailto:gruvora@gmail.com',
      icon: Mail,
    },
  ];

  return (
    <footer className="relative overflow-hidden bg-stone-950 text-white" data-testid="footer">
      <div className="absolute inset-0 opacity-30 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/30 via-transparent to-transparent" />

      <div className="container-main relative py-8 md:py-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 md:gap-7">
          <div className="col-span-2 lg:col-span-1">
            <Link to="/" className="mb-4 inline-flex items-center">
              <BrandedLogo variant="normal" hideIcon={true} className="text-white" />
            </Link>
            <p className="text-stone-300 text-sm leading-relaxed">
              Smart digital platform to connect users with homes, businesses, stay options, event spaces, and local services.
            </p>
            <div className="mt-5 flex items-center gap-2">
              {socialLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.label}
                    href={item.href}
                    target={item.href.startsWith('mailto:') ? undefined : '_blank'}
                    rel={item.href.startsWith('mailto:') ? undefined : 'noreferrer'}
                    onClick={(e) => {
                      if (item.href.startsWith('mailto:')) {
                        e.preventDefault();
                        window.location.href = item.href;
                      }
                    }}
                    aria-label={item.label}
                    className="w-9 h-9 rounded-full border border-white/20 bg-white/5 hover:bg-white/15 transition-colors flex items-center justify-center"
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="font-heading font-semibold text-lg mb-4">Explore</h3>
            <ul className="space-y-2.5">
              {categories.map((cat) => (
                <li key={cat.id}>
                  <Link to={cat.href} className="text-stone-300 hover:text-white transition-colors text-sm">
                    {cat.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  to="/reels"
                  onMouseEnter={prefetchReelsRoute}
                  onFocus={prefetchReelsRoute}
                  onClick={() => markRouteNavigation('/reels', 'footer-reels-link')}
                  className="text-stone-300 hover:text-white transition-colors text-sm"
                >
                  Gruvora Reels
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-heading font-semibold text-lg mb-4">Policies</h3>
            <ul className="space-y-2.5">
              {policyLinks.map((item) => (
                <li key={item.href}>
                  <Link to={item.href} className="text-stone-300 hover:text-white transition-colors text-sm">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-heading font-semibold text-lg mb-4">Contact</h3>
            <ul className="space-y-2 text-stone-300 text-sm">
              <li>Surat, Gujarat, India</li>
              <li>
                <a href="mailto:gruvora@gmail.com" className="hover:text-white transition-colors">
                  gruvora@gmail.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-6 pt-4">
          <p className="text-stone-400 text-xs md:text-sm">2026 All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

// Mobile Bottom Navigation
export const MobileBottomNav = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const discoverLinkRef = useRef(null);
  const reelsLinkRef = useRef(null);

  useEffect(() => {
    const stopDiscoverObserver = observeRoutePrefetch(discoverLinkRef.current, prefetchDiscoverRoute);
    const stopReelsObserver = observeRoutePrefetch(reelsLinkRef.current, prefetchReelsRoute);

    return () => {
      stopDiscoverObserver();
      stopReelsObserver();
    };
  }, []);

  // Don't show on reels page (full screen) or login/register pages
  const hideOnPaths = ['/reels', '/login', '/register'];
  if (hideOnPaths.some(path => location.pathname.startsWith(path))) {
    return null;
  }

  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: DiscoverIcon, label: 'Discover', path: '/discover', prefetch: prefetchDiscoverRoute, ref: discoverLinkRef, markSource: 'mobile-bottom-discover' },
    { icon: Play, label: 'Reels', path: '/reels', prefetch: prefetchReelsRoute, ref: reelsLinkRef, markSource: 'mobile-bottom-reels' },
    { icon: Heart, label: 'Wishlist', path: '/wishlist', auth: true },
    { icon: User, label: 'Profile', path: isAuthenticated ? '/dashboard' : '/login' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 z-50 safe-area-bottom" data-testid="mobile-bottom-nav">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          if (item.auth && !isAuthenticated) return null;
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              ref={item.ref}
              onMouseEnter={item.prefetch}
              onFocus={item.prefetch}
              onTouchStart={item.prefetch}
              onClick={() => {
                if (item.markSource) {
                  markRouteNavigation(item.path, item.markSource);
                }
              }}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${isActive
                ? 'text-primary'
                : 'text-stone-500'
                }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'fill-primary/20' : ''}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};