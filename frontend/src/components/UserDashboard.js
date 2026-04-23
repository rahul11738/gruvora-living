import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useInteractions } from '../context/InteractionContext';
import { wishlistAPI, bookingsAPI, videosAPI } from '../lib/api';
import { prefetchReelsRoute } from '../lib/routePrefetch';
import { markRouteNavigation } from '../lib/routeTelemetry';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import {
  Heart,
  Calendar,
  User,
  LogOut,
  MapPin,
  X,
  Loader2,
  Eye,
  Trash2,
  Bookmark,
  Play,
  Film,
  Search,
  Filter,
  Sparkles,
  MessageCircle,
} from 'lucide-react';
import { Header, Footer } from './Layout';
import SeoHead from './SeoHead';
import { normalizeMediaUrl } from '../lib/media';
import OptimizedImage from './OptimizedImage';

const PROPERTY_TRANSACTION_CATEGORIES = new Set(['home', 'business']);
const isPropertyTransactionCategory = (category) =>
  PROPERTY_TRANSACTION_CATEGORIES.has(String(category || '').trim().toLowerCase());

export const UserDashboard = () => {
  const { user, logout } = useAuth();
  const { refreshWishlist } = useInteractions();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('bookings');
  const [bookings, setBookings] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [savedReels, setSavedReels] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [bookingsRes, wishlistRes, savedReelsRes] = await Promise.all([
        bookingsAPI.getUserBookings(),
        wishlistAPI.get(),
        videosAPI.getSaved().catch(() => ({ data: { videos: [] } })),
      ]);
      setBookings(bookingsRes.data.bookings || []);
      setWishlist(wishlistRes.data.listings || []);
      setSavedReels(savedReelsRes.data.videos || []);
      refreshWishlist().catch(() => { });
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [refreshWishlist]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleRemoveFromWishlist = async (listingId) => {
    try {
      await wishlistAPI.remove(listingId);
      setWishlist(wishlist.filter((l) => l.id !== listingId));
      refreshWishlist().catch(() => { });
      toast.success('Removed from wishlist');
    } catch (error) {
      toast.error('Failed to remove from wishlist');
    }
  };

  const handleRemoveSavedReel = async (videoId) => {
    try {
      await videosAPI.unsave(videoId);
      setSavedReels(savedReels.filter((v) => v.id !== videoId));
      toast.success('Removed from saved');
    } catch (error) {
      toast.error('Failed to remove');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Header />
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50" data-testid="user-dashboard">
      <SeoHead robots="noindex, nofollow" title="User Dashboard – Gruvora" description="Private user dashboard. This page is not indexed." />
      <Header />

      <div className="container-main py-8 pb-24 lg:pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <Card>
              <CardContent className="pt-6">
                {/* User Info */}
                <div className="text-center mb-6">
                  <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                    <User className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="font-heading font-semibold text-lg">{user?.name}</h3>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  {!user?.is_verified && (
                    <Badge variant="outline" className="mt-2 text-yellow-600 border-yellow-300">
                      Email not verified
                    </Badge>
                  )}
                </div>

                {/* Navigation */}
                <nav className="space-y-2">
                  <button
                    onClick={() => setActiveTab('bookings')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'bookings' ? 'bg-primary text-white' : 'hover:bg-stone-100'
                      }`}
                  >
                    <Calendar className="w-5 h-5" />
                    My Bookings
                    {bookings.length > 0 && (
                      <Badge className="ml-auto">{bookings.length}</Badge>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('wishlist')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'wishlist' ? 'bg-primary text-white' : 'hover:bg-stone-100'
                      }`}
                  >
                    <Heart className="w-5 h-5" />
                    Wishlist
                    {wishlist.length > 0 && (
                      <Badge className="ml-auto">{wishlist.length}</Badge>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('saved-reels')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'saved-reels' ? 'bg-primary text-white' : 'hover:bg-stone-100'
                      }`}
                  >
                    <Bookmark className="w-5 h-5" />
                    Saved Reels
                    {savedReels.length > 0 && (
                      <Badge className="ml-auto">{savedReels.length}</Badge>
                    )}
                  </button>
                </nav>

                <div className="mt-6 pt-6 border-t">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                    Logout
                  </button>
                </div>
              </CardContent>
            </Card>
          </aside>

          {/* Main Content */}
          <main className="lg:col-span-3">
            {activeTab === 'bookings' && (
              <div className="space-y-6">
                <h2 className="font-heading text-2xl font-bold">My Bookings</h2>
                {bookings.length === 0 ? (
                  <Card>
                    <CardContent className="py-16 text-center">
                      <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                      <h3 className="font-heading text-xl font-semibold mb-2">No Bookings Yet</h3>
                      <p className="text-muted-foreground mb-6">
                        Start exploring properties and make your first booking
                      </p>
                      <Link to="/">
                        <Button className="btn-primary">Explore Properties</Button>
                      </Link>
                    </CardContent>
                  </Card>
                ) : (
                  bookings.map((booking) => (
                    <BookingCard key={booking.id} booking={booking} />
                  ))
                )}
              </div>
            )}

            {activeTab === 'wishlist' && (
              <div className="space-y-6">
                <h2 className="font-heading text-2xl font-bold">My Wishlist</h2>
                {wishlist.length === 0 ? (
                  <Card>
                    <CardContent className="py-16 text-center">
                      <Heart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                      <h3 className="font-heading text-xl font-semibold mb-2">Wishlist Empty</h3>
                      <p className="text-muted-foreground mb-6">
                        Save properties you like to compare them later
                      </p>
                      <Link to="/">
                        <Button className="btn-primary">Browse Properties</Button>
                      </Link>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {wishlist.map((listing) => (
                      <WishlistCard
                        key={listing.id}
                        listing={listing}
                        onRemove={handleRemoveFromWishlist}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'saved-reels' && (
              <div className="space-y-6">
                <h2 className="font-heading text-2xl font-bold">Saved Reels</h2>
                {savedReels.length === 0 ? (
                  <Card>
                    <CardContent className="py-16 text-center">
                      <Film className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                      <h3 className="font-heading text-xl font-semibold mb-2">No Saved Reels</h3>
                      <p className="text-muted-foreground mb-6">
                        Save reels you like to watch them later
                      </p>
                      <Button
                        className="btn-primary"
                        onMouseEnter={prefetchReelsRoute}
                        onFocus={prefetchReelsRoute}
                        onClick={() => {
                          markRouteNavigation('/reels', 'dashboard-saved-reels-cta');
                          navigate('/reels');
                        }}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Browse Reels
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {savedReels.map((video) => (
                      <SavedReelCard
                        key={video.id}
                        video={video}
                        onRemove={handleRemoveSavedReel}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

          </main>
        </div>
      </div>

      <Footer />
    </div>
  );
};

const BookingCard = ({ booking }) => {
  const getStatusBadge = (status) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-green-100 text-green-700">Confirmed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-700">Cancelled</Badge>;
      case 'completed':
        return <Badge className="bg-blue-100 text-blue-700">Completed</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card data-testid={`booking-card-${booking.id}`}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {getStatusBadge(booking.status)}
              <span className="text-sm text-muted-foreground capitalize">{booking.listing_category}</span>
            </div>
            <h3 className="font-heading font-semibold text-lg">{booking.listing_title}</h3>
            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {booking.booking_date}
              </span>
              <span className="flex items-center gap-1">
                <User className="w-4 h-4" />
                {booking.guests} guests
              </span>
            </div>
            {booking.notes && (
              <p className="text-sm text-muted-foreground mt-2">Notes: {booking.notes}</p>
            )}
          </div>
          <div className="text-right">
            <p className="font-bold text-primary">₹{booking.total_price?.toLocaleString('en-IN')}</p>
            <Link to={`/listing/${booking.listing_id}`}>
              <Button variant="outline" size="sm" className="mt-2">
                <Eye className="w-4 h-4 mr-1" />
                View
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const WishlistCard = ({ listing, onRemove }) => {
  const showTransactionType = isPropertyTransactionCategory(listing.category);

  const formatPrice = (price, type) => {
    if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
    if (price >= 100000) return `₹${(price / 100000).toFixed(2)} L`;
    const monthlySuffix = showTransactionType && type === 'rent' ? '/mo' : '';
    return `₹${price?.toLocaleString('en-IN')}${monthlySuffix}`;
  };

  const formatSavedTime = (value) => {
    if (!value) return 'Saved recently';
    const diff = Date.now() - new Date(value).getTime();
    if (diff < 60_000) return 'Saved just now';
    if (diff < 3_600_000) return `Saved ${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `Saved ${Math.floor(diff / 3_600_000)}h ago`;
    return `Saved ${Math.floor(diff / 86_400_000)}d ago`;
  };

  const ownerId = listing.owner_id || listing.owner?.id || '';
  const chatHref = ownerId ? `/chat?listing_id=${listing.id}&user=${ownerId}` : null;

  return (
    <Card className="overflow-hidden border-stone-200 shadow-sm hover:shadow-lg transition-all duration-200 group" data-testid={`wishlist-card-${listing.id}`}>
      <div className="aspect-[4/3] relative">
        <OptimizedImage
          publicId={listing.images?.[0] || 'gharshetu/placeholders/listing-default'}
          alt={listing.title}
          className="w-full h-full object-cover"
          width={640}
          sizes="(max-width: 1024px) 100vw, 50vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {showTransactionType && (
            <span className="px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-sm text-[11px] font-medium text-stone-700 shadow-sm">
              {listing.listing_type === 'rent' ? 'For rent' : 'For sale'}
            </span>
          )}
          {listing.category && (
            <span className="px-2.5 py-1 rounded-full bg-primary/90 text-white text-[11px] font-medium shadow-sm">
              {String(listing.category).replace(/_/g, ' ')}
            </span>
          )}
        </div>
        <button
          onClick={() => onRemove(listing.id)}
          className="absolute top-3 right-3 w-9 h-9 bg-white/95 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-red-50 shadow-sm transition-colors"
          aria-label="Remove from wishlist"
        >
          <X className="w-4 h-4 text-red-500" />
        </button>
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3 text-white">
          <div className="min-w-0">
            <p className="text-sm font-semibold line-clamp-1">{listing.title}</p>
            <p className="text-xs text-white/80 line-clamp-1">{listing.location || listing.city || 'Location not listed'}</p>
          </div>
          <p className="text-sm font-bold shrink-0">{formatPrice(listing.price, listing.listing_type)}</p>
        </div>
      </div>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold line-clamp-1 text-stone-900">{listing.title}</h3>
          <span className="text-xs text-stone-400 shrink-0">{formatSavedTime(listing.wishlisted_at || listing.created_at)}</span>
        </div>
        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
          <MapPin className="w-3 h-3" />
          <span className="line-clamp-1">{listing.location || listing.city || 'Location not listed'}</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {listing.city && <Badge variant="secondary" className="text-[11px]">{listing.city}</Badge>}
          {listing.price && <Badge variant="outline" className="text-[11px]">{formatPrice(listing.price, listing.listing_type)}</Badge>}
          {listing.is_available === false && <Badge className="text-[11px] bg-stone-200 text-stone-700">Unavailable</Badge>}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link to={`/listing/${listing.id}`}>
            <Button variant="outline" size="sm" className="w-full">
              <Eye className="w-4 h-4 mr-1" />
              View
            </Button>
          </Link>
          {chatHref ? (
            <Link to={chatHref}>
              <Button size="sm" className="w-full bg-primary">
                <MessageCircle className="w-4 h-4 mr-1" />
                Chat owner
              </Button>
            </Link>
          ) : (
            <Button size="sm" className="w-full" variant="secondary" disabled>
              <MessageCircle className="w-4 h-4 mr-1" />
              Chat owner
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const SavedReelCard = ({ video, onRemove }) => {
  const navigate = useNavigate();

  const handlePlay = () => {
    navigate(`/reels?video=${video.id}`);
  };

  return (
    <Card
      className="overflow-hidden group cursor-pointer"
      data-testid={`saved-reel-${video.id}`}
      onClick={handlePlay}
    >
      <div className="aspect-[9/16] relative bg-stone-900">
        {/* Video Thumbnail */}
        {video.thumbnail_url ? (
          <OptimizedImage
            publicId={normalizeMediaUrl(video.thumbnail_url)}
            alt={video.title}
            className="w-full h-full object-cover"
            width={360}
            sizes="(max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <video
            src={normalizeMediaUrl(video.url)}
            className="w-full h-full object-cover"
            muted
            preload="metadata"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        )}

        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

        {/* Play Button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-12 h-12 bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center">
            <Play className="w-6 h-6 text-white ml-1" />
          </div>
        </div>

        {/* Remove Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(video.id);
          }}
          className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center hover:bg-red-500 transition-colors opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="w-4 h-4 text-white" />
        </button>

        {/* Stats */}
        <div className="absolute bottom-2 left-2 right-2">
          <h3 className="text-white font-medium text-sm line-clamp-1 mb-1">{video.title}</h3>
          <div className="flex items-center gap-3 text-white/80 text-xs">
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {video.views?.toLocaleString() || 0}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="w-3 h-3" />
              {video.likes || 0}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export const WishlistPage = () => {
  const { isAuthenticated } = useAuth();
  const { refreshWishlist } = useInteractions();
  const navigate = useNavigate();
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const hasPropertyTransactionListings = useMemo(
    () => wishlist.some((listing) => isPropertyTransactionCategory(listing.category)),
    [wishlist]
  );

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login?redirect=/wishlist');
      return;
    }
    fetchWishlist();
  }, [isAuthenticated, navigate]);

  const fetchWishlist = async () => {
    setLoading(true);
    try {
      const response = await wishlistAPI.get();
      setWishlist(response.data.listings || []);
      refreshWishlist().catch(() => { });
    } catch (error) {
      console.error('Failed to fetch wishlist:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (listingId) => {
    try {
      await wishlistAPI.remove(listingId);
      setWishlist(wishlist.filter((l) => l.id !== listingId));
      refreshWishlist().catch(() => { });
      toast.success('Removed from wishlist');
    } catch (error) {
      toast.error('Failed to remove');
    }
  };

  const filteredWishlist = useMemo(() => {
    const search = query.trim().toLowerCase();
    return wishlist.filter((listing) => {
      const matchesSearch = !search || [listing.title, listing.location, listing.city, listing.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
      const matchesFilter =
        filter === 'all' ||
        (filter === 'available' && listing.is_available !== false) ||
        (filter === 'rent' &&
          hasPropertyTransactionListings &&
          isPropertyTransactionCategory(listing.category) &&
          String(listing.listing_type || '').toLowerCase() === 'rent') ||
        (filter === 'buy' &&
          hasPropertyTransactionListings &&
          isPropertyTransactionCategory(listing.category) &&
          String(listing.listing_type || '').toLowerCase() !== 'rent');
      return matchesSearch && matchesFilter;
    });
  }, [filter, hasPropertyTransactionListings, query, wishlist]);

  const stats = useMemo(() => ({
    total: wishlist.length,
    available: wishlist.filter((listing) => listing.is_available !== false).length,
    rent: wishlist.filter(
      (listing) =>
        isPropertyTransactionCategory(listing.category) &&
        String(listing.listing_type || '').toLowerCase() === 'rent'
    ).length,
  }), [wishlist]);

  useEffect(() => {
    if (!hasPropertyTransactionListings && (filter === 'rent' || filter === 'buy')) {
      setFilter('all');
    }
  }, [filter, hasPropertyTransactionListings]);

  return (
    <div className="min-h-screen bg-stone-50" data-testid="wishlist-page">
      <SeoHead robots="noindex, nofollow" title="My Wishlist – Gruvora (Private)" description="Your saved listings on Gruvora. Private page, not indexed." />
      <Header />

      <div className="container-main py-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              Curated saves workspace
            </div>
            <h1 className="font-heading text-3xl font-bold">My Wishlist</h1>
            <p className="text-sm text-stone-500 mt-1">Saved properties, direct owner chat, and a clean mobile-first review flow.</p>
          </div>
          <div className={`grid ${hasPropertyTransactionListings ? 'grid-cols-3' : 'grid-cols-2'} gap-3 w-full lg:w-auto`}>
            <div className="rounded-2xl bg-white border border-stone-200 px-4 py-3 shadow-sm min-w-[96px]">
              <p className="text-[11px] uppercase tracking-wide text-stone-400">Saved</p>
              <p className="text-xl font-bold text-stone-900">{stats.total}</p>
            </div>
            <div className="rounded-2xl bg-white border border-stone-200 px-4 py-3 shadow-sm min-w-[96px]">
              <p className="text-[11px] uppercase tracking-wide text-stone-400">Live</p>
              <p className="text-xl font-bold text-stone-900">{stats.available}</p>
            </div>
            {hasPropertyTransactionListings && (
              <div className="rounded-2xl bg-white border border-stone-200 px-4 py-3 shadow-sm min-w-[96px]">
                <p className="text-[11px] uppercase tracking-wide text-stone-400">Rent</p>
                <p className="text-xl font-bold text-stone-900">{stats.rent}</p>
              </div>
            )}
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, city, category..."
              className="w-full rounded-2xl border border-stone-200 bg-white pl-10 pr-4 py-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'All' },
              { id: 'available', label: 'Available' },
              ...(hasPropertyTransactionListings
                ? [
                  { id: 'rent', label: 'Rent' },
                  { id: 'buy', label: 'Buy' },
                ]
                : []),
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`px-3 py-2 rounded-full text-xs font-medium border transition-colors ${filter === item.id
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                  }`}
              >
                <Filter className="w-3.5 h-3.5 inline-block mr-1" />
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredWishlist.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Heart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-heading text-xl font-semibold mb-2">
                {wishlist.length === 0 ? 'Your Wishlist is Empty' : 'No properties match the current filters'}
              </h3>
              <p className="text-muted-foreground mb-6">
                {wishlist.length === 0
                  ? 'Start browsing and save your favorite properties'
                  : 'Clear filters or adjust the search to see more saved properties'}
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                {wishlist.length === 0 ? (
                  <Link to="/">
                    <Button className="btn-primary">Browse Properties</Button>
                  </Link>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => { setQuery(''); setFilter('all'); }}>
                      Reset filters
                    </Button>
                    <Link to="/">
                      <Button className="btn-primary">Browse More</Button>
                    </Link>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredWishlist.map((listing) => (
              <WishlistCard key={listing.id} listing={listing} onRemove={handleRemove} />
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default UserDashboard;
