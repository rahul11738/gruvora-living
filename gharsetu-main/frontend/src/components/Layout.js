import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NotificationBell } from './Notifications';
import { Button } from './ui/button';
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
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Home className="w-6 h-6 text-white" />
            </div>
            <span className="font-heading font-bold text-xl md:text-2xl text-primary">
              GharSetu
            </span>
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
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-stone-600 hover:bg-stone-100'
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
              className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
              data-testid="map-btn"
            >
              <MapIcon className="w-4 h-4" />
              <span className="text-sm font-medium">Map</span>
            </Link>

            {/* Reels Button - Hidden on mobile (in bottom nav) */}
            <Link
              to="/reels"
              className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors"
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
                  className="hidden md:flex w-10 h-10 items-center justify-center rounded-full bg-stone-100 hover:bg-stone-200 transition-colors"
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
                      className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
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
                          className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-stone-100 transition-colors"
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
                      onClick={() => setMobileOpen(false)}
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
  return (
    <footer className="bg-stone-900 text-white" data-testid="footer">
      <div className="container-main py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <Home className="w-6 h-6 text-white" />
              </div>
              <span className="font-heading font-bold text-2xl">GharSetu</span>
            </div>
            <p className="text-stone-400 mb-4">
              Connecting you to your perfect space. Find homes, businesses, stays, event venues, and services all in one place.
            </p>
            <p className="text-stone-400 text-sm">
              તમારી સંપૂર્ણ જગ્યા સાથે જોડાણ
            </p>
          </div>

          {/* Categories */}
          <div>
            <h3 className="font-heading font-semibold text-lg mb-4">Categories</h3>
            <ul className="space-y-2">
              {categories.map((cat) => (
                <li key={cat.id}>
                  <Link
                    to={cat.href}
                    className="text-stone-400 hover:text-white transition-colors"
                  >
                    {cat.name} - {cat.nameGu}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-heading font-semibold text-lg mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/about" className="text-stone-400 hover:text-white transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-stone-400 hover:text-white transition-colors">
                  Contact
                </Link>
              </li>
              <li>
                <Link to="/owner/register" className="text-stone-400 hover:text-white transition-colors">
                  List Your Property
                </Link>
              </li>
              <li>
                <Link to="/reels" className="text-stone-400 hover:text-white transition-colors">
                  GharSetu Reels
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-heading font-semibold text-lg mb-4">Contact</h3>
            <ul className="space-y-2 text-stone-400">
              <li>Surat, Gujarat, India</li>
              <li>info@gharsetu.com</li>
              <li>+91 9876543210</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-stone-800 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-stone-400 text-sm">
            © 2024 GharSetu. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link to="/privacy" className="text-stone-400 hover:text-white text-sm transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="text-stone-400 hover:text-white text-sm transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

// Mobile Bottom Navigation
export const MobileBottomNav = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  
  // Don't show on reels page (full screen) or login/register pages
  const hideOnPaths = ['/reels', '/login', '/register'];
  if (hideOnPaths.some(path => location.pathname.startsWith(path))) {
    return null;
  }

  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: MapIcon, label: 'Map', path: '/map' },
    { icon: Play, label: 'Reels', path: '/reels' },
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
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
                isActive 
                  ? 'text-primary' 
                  : 'text-stone-500 hover:text-stone-900'
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