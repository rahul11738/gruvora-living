import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NotificationBell } from './Notifications';
import { Button } from './ui/button';
import { observeRoutePrefetch, prefetchMapRoute, prefetchReelsRoute } from '../lib/routePrefetch';
import { markRouteNavigation } from '../lib/routeTelemetry';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import {
  Home,
  Building2,
  Hotel,
  PartyPopper,
  Wrench,
  Menu,
  User,
  LogOut,
  Heart,
  Settings,
  LayoutDashboard,
  Play,
  MessageCircle,
  X,
  Map as MapIcon,
  Bell,
  Youtube,
  Instagram,
  Facebook,
  Mail,
  ArrowRight,
} from 'lucide-react';

const categories = [
  { id: 'home', name: 'Home', nameGu: 'ઘર', icon: Home, href: '/category/home' },
  { id: 'business', name: 'Business', nameGu: 'બિઝનેસ', icon: Building2, href: '/category/business' },
  { id: 'stay', name: 'Stay', nameGu: 'રહેવાનું', icon: Hotel, href: '/category/stay' },
  { id: 'event', name: 'Event', nameGu: 'ઇવેન્ટ', icon: PartyPopper, href: '/category/event' },
  { id: 'services', name: 'Services', nameGu: 'સેવાઓ', icon: Wrench, href: '/category/services' },
];

export const Header = () => {
  const { user, isAuthenticated, isOwner, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getDashboardLink = () => {
    if (isAdmin) return '/admin';
    if (isOwner) return '/owner/dashboard';
    return '/dashboard';
  };

  return (
    <header className="glass-header sticky top-0 z-50" data-testid="header">
      <div className="container-main">
        <div className="flex items-center justify-between h-14 md:h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2" data-testid="logo">
            <img
              src="/GruvoraLogo.jpeg"
              alt="Gruvora"
              className="w-10 h-10 rounded-xl object-cover shadow-sm"
            />
            <span className="font-heading font-bold text-xl md:text-2xl text-primary">Gruvora</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-2">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = location.pathname === cat.href;
              return (
                <Link
                  key={cat.id}
                  to={cat.href}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                    isActive
                      ? 'bg-primary/10 text-primary shadow-[0_8px_20px_rgba(5,150,105,0.12)] border border-primary/25'
                      : 'text-stone-600'
                  }`}
                  data-testid={`nav-${cat.id}`}
                >
                  <Icon className="w-4 h-4" />
                  {cat.name}
                </Link>
              );
            })}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-3 md:gap-4">
            {/* Map Button - Hidden on mobile (in bottom nav) */}
            <Link
              to="/map"
              onMouseEnter={prefetchMapRoute}
              onFocus={prefetchMapRoute}
              onClick={() => markRouteNavigation('/map', 'header-map-btn')}
              className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-blue-600 shadow-[0_6px_18px_rgba(37,99,235,0.12)]"
              data-testid="map-btn"
            >
              <MapIcon className="w-4 h-4" />
              <span className="text-sm font-medium">Map</span>
            </Link>

            {/* Reels Button - Hidden on mobile (in bottom nav) */}
            <Link
              to="/reels"
              onMouseEnter={prefetchReelsRoute}
              onFocus={prefetchReelsRoute}
              onClick={() => markRouteNavigation('/reels', 'header-reels-btn')}
              className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/10 text-secondary shadow-[0_6px_18px_rgba(249,115,22,0.16)]"
              data-testid="reels-btn"
            >
              <Play className="w-4 h-4" />
              <span className="text-sm font-medium">Reels</span>
            </Link>

            {isAuthenticated ? (
              <>
                {/* Wishlist - Hidden on mobile, shown in bottom nav */}
                <Link
                  to="/wishlist"
                  className="hidden md:flex w-10 h-10 items-center justify-center rounded-full bg-stone-100 shadow-sm"
                  data-testid="wishlist-btn"
                >
                  <Heart className="w-5 h-5 text-stone-600" />
                </Link>

                {/* Notifications */}
                <NotificationBell />

                {/* User Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 rounded-full bg-primary/10"
                      data-testid="user-menu-btn"
                    >
                      <div className="w-7 h-7 md:w-8 md:h-8 bg-primary rounded-full flex items-center justify-center">
                        <User className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
                      </div>
                      <span className="hidden md:block text-sm font-medium text-primary">
                        {user?.name?.split(' ')[0]}
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-3 py-2">
                      <p className="font-medium">{user?.name}</p>
                      <p className="text-sm text-muted-foreground">{user?.email}</p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to={getDashboardLink()} className="flex items-center gap-2">
                        <LayoutDashboard className="w-4 h-4" />
                        Dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/wishlist" className="flex items-center gap-2">
                        <Heart className="w-4 h-4" />
                        Wishlist
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/settings" className="flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login">
                  <Button variant="ghost" data-testid="login-btn">Login</Button>
                </Link>
                <Link to="/register" className="hidden md:block">
                  <Button className="btn-primary" data-testid="register-btn">Register</Button>
                </Link>
              </div>
            )}

            {/* Mobile Menu */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button className="lg:hidden w-10 h-10 flex items-center justify-center rounded-full bg-stone-100">
                  <Menu className="w-5 h-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between mb-8">
                    <span className="font-heading font-bold text-xl text-primary">Menu</span>
                  </div>

                  <nav className="flex flex-col gap-2">
                    {categories.map((cat) => {
                      const Icon = cat.icon;
                      return (
                        <Link
                          key={cat.id}
                          to={cat.href}
                          onClick={() => setMobileOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl"
                        >
                          <Icon className="w-5 h-5 text-primary" />
                          <div>
                            <p className="font-medium">{cat.name}</p>
                            <p className="text-sm text-muted-foreground">{cat.nameGu}</p>
                          </div>
                        </Link>
                      );
                    })}
                  </nav>

                  <div className="mt-6 pt-6 border-t">
                    <Link
                      to="/reels"
                      onMouseEnter={prefetchReelsRoute}
                      onFocus={prefetchReelsRoute}
                      onClick={() => {
                        markRouteNavigation('/reels', 'menu-reels-link');
                        setMobileOpen(false);
                      }}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary/10 text-secondary"
                    >
                      <Play className="w-5 h-5" />
                      <span className="font-medium">GharSetu Reels</span>
                    </Link>
                  </div>

                  <div className="mt-auto pt-6">
                    {!isAuthenticated && (
                      <div className="flex flex-col gap-2">
                        <Link to="/login" onClick={() => setMobileOpen(false)}>
                          <Button variant="outline" className="w-full">Login</Button>
                        </Link>
                        <Link to="/register" onClick={() => setMobileOpen(false)}>
                          <Button className="w-full btn-primary">Register</Button>
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
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

      <div className="container-main relative py-12 md:py-16">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-5 md:p-7 mb-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-emerald-300">GRUVORA LIVING</p>
            <h3 className="font-heading text-xl md:text-2xl font-semibold mt-1">Your Home Bridge for Properties, Stays, Events and Services</h3>
            <p className="text-stone-300 mt-2 text-sm">Trusted marketplace to list and discover in one platform.</p>
          </div>
          <Link to="/owner/register" className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-stone-950 hover:bg-emerald-400 transition-colors">
            Start Listing
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img src="/GruvoraLogo.jpeg" alt="Gruvora" className="w-10 h-10 rounded-xl object-cover" />
              <span className="font-heading font-bold text-xl">GRUVORA LIVING</span>
            </div>
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
              <li>+91 9875231321</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-10 pt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <p className="text-stone-400 text-xs md:text-sm">2026 GRUVORA LIVING. All rights reserved.</p>
          <p className="text-stone-500 text-xs">GRUVORA LIVING is a digital marketplace and does not guarantee transactions between users.</p>
        </div>
      </div>
    </footer>
  );
};

// Mobile Bottom Navigation
export const MobileBottomNav = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const mapLinkRef = useRef(null);
  const reelsLinkRef = useRef(null);

  useEffect(() => {
    const stopMapObserver = observeRoutePrefetch(mapLinkRef.current, prefetchMapRoute);
    const stopReelsObserver = observeRoutePrefetch(reelsLinkRef.current, prefetchReelsRoute);

    return () => {
      stopMapObserver();
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
    { icon: MapIcon, label: 'Map', path: '/map', prefetch: prefetchMapRoute, ref: mapLinkRef, markSource: 'mobile-bottom-map' },
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
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
                isActive 
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