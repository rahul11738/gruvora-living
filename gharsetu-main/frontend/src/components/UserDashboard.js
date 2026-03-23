import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { wishlistAPI, bookingsAPI, chatAPI, videosAPI } from '../lib/api';
import { prefetchReelsRoute } from '../lib/routePrefetch';
import { markRouteNavigation } from '../lib/routeTelemetry';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import {
  Heart,
  Calendar,
  MessageCircle,
  User,
  Settings,
  LogOut,
  Home,
  MapPin,
  Clock,
  X,
  Send,
  Bot,
  Loader2,
  Menu,
  Eye,
  Trash2,
  Bookmark,
  Play,
  Film,
} from 'lucide-react';
import { Header, Footer } from './Layout';
import { ScrollArea } from './ui/scroll-area';

export const UserDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('bookings');
  const [bookings, setBookings] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [savedReels, setSavedReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [bookingsRes, wishlistRes, savedReelsRes] = await Promise.all([
        bookingsAPI.getUserBookings(),
        wishlistAPI.get(),
        videosAPI.getSaved().catch(() => ({ data: { videos: [] } })),
      ]);
      setBookings(bookingsRes.data.bookings || []);
      setWishlist(wishlistRes.data.listings || []);
      setSavedReels(savedReelsRes.data.videos || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFromWishlist = async (listingId) => {
    try {
      await wishlistAPI.remove(listingId);
      setWishlist(wishlist.filter((l) => l.id !== listingId));
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
      <Header />

      <div className="container-main py-8">
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
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      activeTab === 'bookings' ? 'bg-primary text-white' : 'hover:bg-stone-100'
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
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      activeTab === 'wishlist' ? 'bg-primary text-white' : 'hover:bg-stone-100'
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
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      activeTab === 'saved-reels' ? 'bg-primary text-white' : 'hover:bg-stone-100'
                    }`}
                  >
                    <Bookmark className="w-5 h-5" />
                    Saved Reels
                    {savedReels.length > 0 && (
                      <Badge className="ml-auto">{savedReels.length}</Badge>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('chatbot')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      activeTab === 'chatbot' ? 'bg-primary text-white' : 'hover:bg-stone-100'
                    }`}
                  >
                    <MessageCircle className="w-5 h-5" />
                    Chat Assistant
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
                      <Link
                        to="/reels"
                        onMouseEnter={prefetchReelsRoute}
                        onFocus={prefetchReelsRoute}
                        onClick={() => markRouteNavigation('/reels', 'dashboard-saved-reels-cta')}
                      >
                        <Button className="btn-primary">
                          <Play className="w-4 h-4 mr-2" />
                          Browse Reels
                        </Button>
                      </Link>
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

            {activeTab === 'chatbot' && <ChatbotSection />}
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
  const formatPrice = (price, type) => {
    if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
    if (price >= 100000) return `₹${(price / 100000).toFixed(2)} L`;
    return `₹${price?.toLocaleString('en-IN')}${type === 'rent' ? '/mo' : ''}`;
  };

  return (
    <Card className="overflow-hidden" data-testid={`wishlist-card-${listing.id}`}>
      <div className="aspect-video relative">
        <img
          src={listing.images?.[0] || 'https://images.unsplash.com/photo-1744311971549-9c529b60b98a?w=400'}
          alt={listing.title}
          className="w-full h-full object-cover"
        />
        <button
          onClick={() => onRemove(listing.id)}
          className="absolute top-2 right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center hover:bg-red-50"
        >
          <X className="w-4 h-4 text-red-500" />
        </button>
      </div>
      <CardContent className="pt-4">
        <h3 className="font-medium line-clamp-1">{listing.title}</h3>
        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
          <MapPin className="w-3 h-3" />
          <span className="line-clamp-1">{listing.location}</span>
        </div>
        <div className="flex items-center justify-between mt-3">
          <p className="font-bold text-primary">
            {formatPrice(listing.price, listing.listing_type)}
          </p>
          <Link to={`/listing/${listing.id}`}>
            <Button variant="outline" size="sm">View</Button>
          </Link>
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
          <img
            src={video.thumbnail_url}
            alt={video.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <video
            src={video.url}
            className="w-full h-full object-cover"
            muted
            preload="metadata"
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

const ChatbotSection = () => {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'નમસ્તે! 👋 હું GharSetu Assistant છું. હું તમને properties, stays, events, અને services શોધવામાં મદદ કરી શકું છું. તમને શું જોઈએ છે?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await chatAPI.send(input);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: response.data.response },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'માફ કરશો, કંઈક ખોટું થયું. કૃપયા ફરીથી પ્રયાસ કરો.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="h-[600px] flex flex-col" data-testid="chatbot-section">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          GharSetu Assistant
        </CardTitle>
      </CardHeader>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-primary text-white rounded-br-sm'
                    : 'bg-stone-100 text-stone-900 rounded-bl-sm'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-stone-100 rounded-2xl rounded-bl-sm px-4 py-3">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="p-4 border-t">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={loading}
            data-testid="chat-input"
          />
          <Button type="submit" className="btn-primary px-4" disabled={loading} data-testid="chat-send-btn">
            <Send className="w-5 h-5" />
          </Button>
        </form>
      </div>
    </Card>
  );
};

export const WishlistPage = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login?redirect=/wishlist');
      return;
    }
    fetchWishlist();
  }, [isAuthenticated, navigate]);

  const fetchWishlist = async () => {
    try {
      const response = await wishlistAPI.get();
      setWishlist(response.data.listings);
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
      toast.success('Removed from wishlist');
    } catch (error) {
      toast.error('Failed to remove');
    }
  };

  return (
    <div className="min-h-screen bg-stone-50" data-testid="wishlist-page">
      <Header />

      <div className="container-main py-8">
        <h1 className="font-heading text-3xl font-bold mb-8">My Wishlist</h1>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : wishlist.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Heart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-heading text-xl font-semibold mb-2">Your Wishlist is Empty</h3>
              <p className="text-muted-foreground mb-6">
                Start browsing and save your favorite properties
              </p>
              <Link to="/">
                <Button className="btn-primary">Browse Properties</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {wishlist.map((listing) => (
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
