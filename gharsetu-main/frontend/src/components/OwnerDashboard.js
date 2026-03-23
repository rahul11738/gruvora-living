import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ownerAPI, listingsAPI, bookingsAPI, categoriesAPI, subscriptionAPI, paymentsAPI, boostAPI } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import {
  Plus,
  Home,
  Building2,
  Hotel,
  PartyPopper,
  Wrench,
  Eye,
  Heart,
  MessageCircle,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  Image,
  Video,
  MapPin,
  IndianRupee,
  FileText,
  LayoutDashboard,
  Settings,
  LogOut,
  Menu,
  X,
  Crown,
  BarChart3,
  Users,
  Phone,
  Mail,
  Calendar,
  Star,
  Rocket,
  Zap,
  Shield,
  Loader2,
} from 'lucide-react';
import { Header } from './Layout';
import { ImageUploader } from './FileUpload';

const categoryIcons = {
  home: Home,
  business: Building2,
  stay: Hotel,
  event: PartyPopper,
  services: Wrench,
};

const roleAllowedCategoryIds = {
  property_owner: ['home', 'business'],
  stay_owner: ['stay'],
  hotel_owner: ['stay'],
  service_provider: ['services'],
  event_owner: ['event'],
  admin: ['home', 'business', 'stay', 'event', 'services'],
};

const getAllowedCategoryIdsByRole = (role) => {
  if (!role) {
    return ['home', 'business', 'stay', 'event', 'services'];
  }
  return roleAllowedCategoryIds[role] || [];
};

export const OwnerDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [stats, setStats] = useState(null);
  const [listings, setListings] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);

  const isServiceProvider = user?.role === 'service_provider';

  const fetchDashboardData = useCallback(async () => {
    try {
      const [statsRes, listingsRes, bookingsRes] = await Promise.all([
        ownerAPI.getStats(),
        ownerAPI.getListings({ user_id: user?.id }),
        bookingsAPI.getOwnerBookings(),
      ]);
      setStats(statsRes.data);
      const ownerListings = (listingsRes.data.listings || []).filter((item) => item.owner_id === user?.id);
      setListings(ownerListings);
      setBookings(bookingsRes.data.bookings);
      
      // Fetch subscription status for service providers
      if (user?.role === 'service_provider') {
        try {
          const subRes = await subscriptionAPI.getStatus();
          setSubscription(subRes.data);
        } catch (e) {
          console.log('Subscription fetch skipped');
        }
      }
      
      // Generate mock leads from bookings for demo
      const mockLeads = bookingsRes.data.bookings?.slice(0, 5).map((b, idx) => ({
        id: b.id || `lead-${idx}`,
        customer_name: b.customer_name || `Customer ${idx + 1}`,
        customer_phone: b.customer_phone || '98765XXXXX',
        customer_email: b.customer_email || 'hidden@email.com',
        listing_title: b.listing_title || 'Property Inquiry',
        message: b.message || 'Interested in this property',
        created_at: b.created_at || new Date().toISOString(),
        status: b.status || 'pending'
      })) || [];
      setLeads(mockLeads);
      
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    if (searchParams.get('openCreate') !== '1') return;
    setShowCreateDialog(true);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('openCreate');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleDeleteListing = useCallback(async (listingId) => {
    if (!window.confirm('Are you sure you want to delete this listing?')) return;
    
    try {
      await listingsAPI.delete(listingId);
      setListings(listings.filter((l) => l.id !== listingId));
      toast.success('Listing deleted successfully');
    } catch (error) {
      toast.error('Failed to delete listing');
    }
  }, [listings]);

  const handleBookingStatus = useCallback(async (bookingId, status) => {
    try {
      await bookingsAPI.updateStatus(bookingId, status);
      setBookings(bookings.map((b) => (b.id === bookingId ? { ...b, status } : b)));
      toast.success(`Booking ${status}`);
    } catch (error) {
      toast.error('Failed to update booking');
    }
  }, [bookings]);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/');
  }, [logout, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50" data-testid="owner-dashboard">
      {/* Mobile Header */}
      <div className="lg:hidden glass-header sticky top-0 z-40 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Home className="w-5 h-5 text-white" />
          </div>
          <span className="font-heading font-bold text-lg text-primary">GharSetu</span>
        </div>
        <button onClick={() => setSidebarOpen(true)} className="p-2">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-white border-r border-stone-200 z-50 transform transition-transform lg:transform-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          <div className="p-6">
            <Link to="/" className="flex items-center gap-2 mb-8">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <Home className="w-6 h-6 text-white" />
              </div>
              <span className="font-heading font-bold text-xl text-primary">GharSetu</span>
            </Link>

            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden absolute top-4 right-4 p-2"
            >
              <X className="w-5 h-5" />
            </button>

            <nav className="space-y-2">
              <button
                onClick={() => { setActiveTab('overview'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'overview' ? 'bg-primary text-white' : 'hover:bg-stone-100'
                }`}
              >
                <LayoutDashboard className="w-5 h-5" />
                Overview
              </button>
              <button
                onClick={() => { setActiveTab('analytics'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'analytics' ? 'bg-primary text-white' : 'hover:bg-stone-100'
                }`}
              >
                <BarChart3 className="w-5 h-5" />
                Analytics
              </button>
              <button
                onClick={() => { setActiveTab('listings'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'listings' ? 'bg-primary text-white' : 'hover:bg-stone-100'
                }`}
              >
                <FileText className="w-5 h-5" />
                My Listings
              </button>
              <button
                onClick={() => { setActiveTab('bookings'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'bookings' ? 'bg-primary text-white' : 'hover:bg-stone-100'
                }`}
              >
                <Clock className="w-5 h-5" />
                Bookings
                {stats?.pending_bookings > 0 && (
                  <Badge variant="destructive" className="ml-auto">{stats.pending_bookings}</Badge>
                )}
              </button>
              <button
                onClick={() => { setActiveTab('leads'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'leads' ? 'bg-primary text-white' : 'hover:bg-stone-100'
                }`}
              >
                <Users className="w-5 h-5" />
                Leads
                {leads.length > 0 && (
                  <Badge className="ml-auto bg-blue-500">{leads.length}</Badge>
                )}
              </button>
              {isServiceProvider && (
                <button
                  onClick={() => { setActiveTab('subscription'); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeTab === 'subscription' ? 'bg-primary text-white' : 'hover:bg-stone-100'
                  }`}
                >
                  <Crown className="w-5 h-5" />
                  Subscription
                  {subscription?.has_subscription && (
                    <Badge className="ml-auto bg-green-500">Active</Badge>
                  )}
                </button>
              )}
            </nav>

            <div className="absolute bottom-6 left-6 right-6">
              <div className="p-4 bg-stone-50 rounded-xl mb-4">
                <p className="font-medium">{user?.name}</p>
                <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-heading text-2xl lg:text-3xl font-bold text-stone-900">
                {activeTab === 'overview' && 'Dashboard Overview'}
                {activeTab === 'analytics' && 'Analytics & Insights'}
                {activeTab === 'listings' && 'My Listings'}
                {activeTab === 'bookings' && 'Booking Requests'}
                {activeTab === 'leads' && 'Customer Leads'}
                {activeTab === 'subscription' && 'Subscription Plan'}
              </h1>
              <p className="text-muted-foreground">Welcome back, {user?.name?.split(' ')[0]}</p>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="btn-primary" data-testid="add-listing-btn">
                  <Plus className="w-5 h-5 mr-2" />
                  Add Listing
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Listing</DialogTitle>
                  <DialogDescription>
                    Add a new property or service listing
                  </DialogDescription>
                </DialogHeader>
                <CreateListingForm onSuccess={() => { setShowCreateDialog(false); fetchDashboardData(); }} />
              </DialogContent>
            </Dialog>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Listings</p>
                        <p className="text-3xl font-bold">{stats?.total_listings || 0}</p>
                      </div>
                      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                        <FileText className="w-6 h-6 text-primary" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Views</p>
                        <p className="text-3xl font-bold">{stats?.total_views || 0}</p>
                      </div>
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Eye className="w-6 h-6 text-blue-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Inquiries</p>
                        <p className="text-3xl font-bold">{stats?.total_inquiries || 0}</p>
                      </div>
                      <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                        <MessageCircle className="w-6 h-6 text-green-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Pending Bookings</p>
                        <p className="text-3xl font-bold">{stats?.pending_bookings || 0}</p>
                      </div>
                      <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                        <Clock className="w-6 h-6 text-orange-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Listings */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Listings</CardTitle>
                </CardHeader>
                <CardContent>
                  {listings.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No listings yet</p>
                      <Button onClick={() => setShowCreateDialog(true)} className="mt-4" variant="outline">
                        Create your first listing
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {listings.slice(0, 5).map((listing) => (
                        <ListingRow key={listing.id} listing={listing} onDelete={handleDeleteListing} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Bookings */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Booking Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  {bookings.length === 0 ? (
                    <div className="text-center py-8">
                      <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No bookings yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {bookings.slice(0, 5).map((booking) => (
                        <BookingRow key={booking.id} booking={booking} onStatusChange={handleBookingStatus} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Listings Tab */}
          {activeTab === 'listings' && (
            <div className="space-y-4">
              {listings.length === 0 ? (
                <Card>
                  <CardContent className="py-16 text-center">
                    <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-heading text-xl font-semibold mb-2">No Listings Yet</h3>
                    <p className="text-muted-foreground mb-6">Start by creating your first property listing</p>
                    <Button onClick={() => setShowCreateDialog(true)} className="btn-primary">
                      <Plus className="w-5 h-5 mr-2" />
                      Create Listing
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                listings.map((listing) => (
                  <ListingRow key={listing.id} listing={listing} onDelete={handleDeleteListing} showActions />
                ))
              )}
            </div>
          )}

          {/* Bookings Tab */}
          {activeTab === 'bookings' && (
            <div className="space-y-4">
              {bookings.length === 0 ? (
                <Card>
                  <CardContent className="py-16 text-center">
                    <Clock className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-heading text-xl font-semibold mb-2">No Bookings Yet</h3>
                    <p className="text-muted-foreground">Booking requests will appear here</p>
                  </CardContent>
                </Card>
              ) : (
                bookings.map((booking) => (
                  <BookingRow key={booking.id} booking={booking} onStatusChange={handleBookingStatus} showDetails />
                ))
              )}
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <AnalyticsSection stats={stats} listings={listings} />
          )}

          {/* Leads Tab */}
          {activeTab === 'leads' && (
            <LeadsSection leads={leads} subscription={subscription} />
          )}

          {/* Subscription Tab */}
          {activeTab === 'subscription' && isServiceProvider && (
            <SubscriptionSection 
              subscription={subscription} 
              onSubscribe={async () => {
                setSubscriptionLoading(true);
                try {
                  const orderRes = await subscriptionAPI.createOrder('monthly');
                  const { order_id, amount, key_id } = orderRes.data;
                  
                  // Open Razorpay checkout
                  const options = {
                    key: key_id,
                    amount: amount,
                    currency: 'INR',
                    name: 'GharSetu',
                    description: 'Monthly Subscription - ₹251',
                    order_id: order_id,
                    handler: async (response) => {
                      try {
                        await subscriptionAPI.verify({
                          razorpay_order_id: response.razorpay_order_id,
                          razorpay_payment_id: response.razorpay_payment_id,
                          razorpay_signature: response.razorpay_signature
                        });
                        toast.success('Subscription activated! 🎉');
                        fetchDashboardData();
                      } catch (e) {
                        toast.error('Payment verification failed');
                      }
                    },
                    prefill: {
                      name: user?.name,
                      email: user?.email,
                      contact: user?.phone
                    },
                    theme: {
                      color: '#10b981'
                    }
                  };
                  
                  const razorpay = new window.Razorpay(options);
                  razorpay.open();
                } catch (error) {
                  toast.error('Failed to create subscription order');
                } finally {
                  setSubscriptionLoading(false);
                }
              }}
              loading={subscriptionLoading}
            />
          )}
        </main>
      </div>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

const ListingRow = memo(({ listing, onDelete, showActions }) => {
  const Icon = categoryIcons[listing.category] || Home;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-700">Approved</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-700">Rejected</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-stone-50 rounded-xl" data-testid={`listing-row-${listing.id}`}>
      <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
        <img
          src={listing.images?.[0] || 'https://images.unsplash.com/photo-1744311971549-9c529b60b98a?w=200'}
          alt={listing.title}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground capitalize">{listing.category}</span>
          {getStatusBadge(listing.status)}
        </div>
        <h4 className="font-medium truncate">{listing.title}</h4>
        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
          <span className="flex items-center gap-1">
            <Eye className="w-4 h-4" />
            {listing.views}
          </span>
          <span className="flex items-center gap-1">
            <Heart className="w-4 h-4" />
            {listing.likes}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="w-4 h-4" />
            {listing.inquiries}
          </span>
        </div>
      </div>
      <div className="text-right">
        <p className="font-bold text-primary">₹{listing.price?.toLocaleString('en-IN')}</p>
        <p className="text-sm text-muted-foreground capitalize">{listing.listing_type}</p>
      </div>
      {showActions && (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/listing/${listing.id}`)}>
            <Eye className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(listing.id)}>
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      )}
    </div>
  );
});

const BookingRow = memo(({ booking, onStatusChange, showDetails }) => {
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
    <Card data-testid={`booking-row-${booking.id}`}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              {getStatusBadge(booking.status)}
              <span className="text-sm text-muted-foreground">{booking.booking_date}</span>
            </div>
            <h4 className="font-medium">{booking.listing_title}</h4>
            {showDetails && (
              <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                <p>Customer: {booking.user_name}</p>
                <p>Phone: {booking.user_phone}</p>
                <p>Email: {booking.user_email}</p>
                <p>Guests: {booking.guests}</p>
                {booking.notes && <p>Notes: {booking.notes}</p>}
              </div>
            )}
          </div>
          {booking.status === 'pending' && (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => onStatusChange(booking.id, 'confirmed')}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onStatusChange(booking.id, 'cancelled')}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <XCircle className="w-4 h-4 mr-1" />
                Decline
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

const CreateListingForm = ({ onSuccess }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    sub_category: '',
    listing_type: 'rent',
    price: '',
    location: '',
    city: '',
    state: 'Gujarat',
    contact_phone: '',
    contact_email: '',
    amenities: '',
  });

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await categoriesAPI.getAll();
        setCategories(response.data.categories);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      }
    };
    fetchCategories();
  }, []);

  const allowedCategoryIds = useMemo(() => getAllowedCategoryIdsByRole(user?.role), [user?.role]);

  const filteredCategories = useMemo(
    () => categories.filter((c) => allowedCategoryIds.includes(c.id)),
    [allowedCategoryIds, categories],
  );

  useEffect(() => {
    if (!formData.category && filteredCategories.length > 0) {
      setFormData((prev) => ({ ...prev, category: filteredCategories[0].id, sub_category: '' }));
      return;
    }
    if (formData.category && !allowedCategoryIds.includes(formData.category)) {
      setFormData((prev) => ({
        ...prev,
        category: filteredCategories[0]?.id || '',
        sub_category: '',
      }));
    }
  }, [allowedCategoryIds, filteredCategories, formData.category]);

  const selectedCategory = useMemo(
    () => filteredCategories.find((c) => c.id === formData.category),
    [filteredCategories, formData.category],
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        price: parseFloat(formData.price),
        amenities: formData.amenities.split(',').map((a) => a.trim()).filter(Boolean),
        images: uploadedImages.map(img => img.url),
        videos: [],
        specifications: {},
      };

      await listingsAPI.create(payload);
      toast.success('Listing created successfully!');
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create listing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="create-listing-form">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Title</Label>
          <Input
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g., 3 BHK Luxury Apartment"
            required
            className="mt-1"
          />
        </div>

        <div>
          <Label>Category</Label>
          <Select
            value={formData.category}
            onValueChange={(value) => setFormData({ ...formData, category: value, sub_category: '' })}
            disabled={filteredCategories.length === 0}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder={filteredCategories.length === 0 ? 'No category allowed' : 'Select category'} />
            </SelectTrigger>
            <SelectContent>
              {filteredCategories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filteredCategories.length === 0 && (
            <p className="mt-1 text-xs text-red-600">Your role does not have listing category access.</p>
          )}
        </div>

        <div>
          <Label>Sub Category</Label>
          <Select
            value={formData.sub_category}
            onValueChange={(value) => setFormData({ ...formData, sub_category: value })}
            disabled={!selectedCategory}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select sub category" />
            </SelectTrigger>
            <SelectContent>
              {selectedCategory?.sub_categories?.map((sub) => (
                <SelectItem key={sub.id} value={sub.id}>
                  {sub.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Listing Type</Label>
          <Select
            value={formData.listing_type}
            onValueChange={(value) => setFormData({ ...formData, listing_type: value })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rent">For Rent</SelectItem>
              <SelectItem value="sell">For Sale</SelectItem>
              <SelectItem value="both">Both</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Price (₹)</Label>
          <Input
            type="number"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            placeholder="e.g., 25000"
            required
            className="mt-1"
          />
        </div>

        <div className="col-span-2">
          <Label>Description</Label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe your property..."
            required
            className="mt-1"
            rows={4}
          />
        </div>

        <div>
          <Label>Location/Address</Label>
          <Input
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            placeholder="e.g., Vesu Main Road"
            required
            className="mt-1"
          />
        </div>

        <div>
          <Label>City</Label>
          <Input
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            placeholder="e.g., Surat"
            required
            className="mt-1"
          />
        </div>

        <div>
          <Label>Contact Phone</Label>
          <Input
            value={formData.contact_phone}
            onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
            placeholder="Your phone number"
            required
            className="mt-1"
          />
        </div>

        <div>
          <Label>Contact Email</Label>
          <Input
            type="email"
            value={formData.contact_email}
            onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
            placeholder="Your email"
            required
            className="mt-1"
          />
        </div>

        <div className="col-span-2">
          <Label>Amenities (comma separated)</Label>
          <Input
            value={formData.amenities}
            onChange={(e) => setFormData({ ...formData, amenities: e.target.value })}
            placeholder="e.g., Parking, Security, Garden, Gym"
            className="mt-1"
          />
        </div>

        <div className="col-span-2">
          <Label className="mb-2 block">Property Images</Label>
          <ImageUploader
            images={uploadedImages}
            onImagesChange={setUploadedImages}
            maxImages={10}
            folder="listings"
          />
        </div>
      </div>

      <Button type="submit" className="w-full btn-primary" disabled={loading}>
        {loading ? 'Creating...' : 'Create Listing'}
      </Button>
    </form>
  );
};

// Analytics Section Component
const AnalyticsSection = ({ stats, listings }) => {
  const totalViews = stats?.total_views || 0;
  const totalInquiries = stats?.total_inquiries || 0;
  const totalRevenue = stats?.total_revenue || 0;

  // Mock data for charts
  const weeklyData = [
    { day: 'Mon', views: 45, inquiries: 3 },
    { day: 'Tue', views: 52, inquiries: 5 },
    { day: 'Wed', views: 38, inquiries: 2 },
    { day: 'Thu', views: 65, inquiries: 7 },
    { day: 'Fri', views: 48, inquiries: 4 },
    { day: 'Sat', views: 72, inquiries: 8 },
    { day: 'Sun', views: 56, inquiries: 6 },
  ];

  const maxViews = Math.max(...weeklyData.map(d => d.views));

  return (
    <div className="space-y-6" data-testid="analytics-section">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                <Eye className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Views</p>
                <p className="text-3xl font-bold">{totalViews.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Inquiries</p>
                <p className="text-3xl font-bold">{totalInquiries}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
                <IndianRupee className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-3xl font-bold">₹{totalRevenue.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Likes</p>
                <p className="text-3xl font-bold">{stats?.total_likes || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Views Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Weekly Performance
          </CardTitle>
          <CardDescription>Views and inquiries over the last 7 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-end gap-2">
            {weeklyData.map((data, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex flex-col items-center gap-1">
                  <div 
                    className="w-full bg-primary/20 rounded-t-lg transition-all hover:bg-primary/30"
                    style={{ height: `${(data.views / maxViews) * 200}px` }}
                  >
                    <div 
                      className="w-full bg-primary rounded-t-lg"
                      style={{ height: `${(data.inquiries / data.views) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{data.day}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-primary/20 rounded" />
              <span className="text-sm text-muted-foreground">Views</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-primary rounded" />
              <span className="text-sm text-muted-foreground">Inquiries</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Performing Listings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Top Performing Listings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {listings.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No listings to analyze</p>
          ) : (
            <div className="space-y-4">
              {listings.slice(0, 5).map((listing, idx) => (
                <div key={listing.id} className="flex items-center gap-4 p-3 rounded-lg bg-stone-50">
                  <span className="text-2xl font-bold text-muted-foreground">#{idx + 1}</span>
                  <img 
                    src={listing.images?.[0] || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=100'}
                    alt={listing.title}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{listing.title}</h4>
                    <p className="text-sm text-muted-foreground">{listing.location}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{listing.views || 0} views</p>
                    <p className="text-sm text-muted-foreground">{listing.likes || 0} likes</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Leads Section Component
const LeadsSection = ({ leads, subscription }) => {
  const hasSubscription = subscription?.has_subscription;

  return (
    <div className="space-y-6" data-testid="leads-section">
      {!hasSubscription && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Crown className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <h3 className="font-semibold text-yellow-800">Upgrade to Premium</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Subscribe to see full contact details of leads. Phone numbers are partially hidden.
                </p>
                <Link to="/owner/dashboard" onClick={() => {}} className="text-sm text-yellow-700 underline mt-2 inline-block">
                  View subscription plans →
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Customer Inquiries
          </CardTitle>
          <CardDescription>
            {leads.length} leads received
          </CardDescription>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-heading text-xl font-semibold mb-2">No Leads Yet</h3>
              <p className="text-muted-foreground">
                Customer inquiries will appear here when they contact you
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {leads.map((lead) => (
                <div key={lead.id} className="p-4 rounded-xl border border-stone-200 hover:border-primary/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium">{lead.customer_name}</h4>
                        <p className="text-sm text-muted-foreground">
                          Interested in: {lead.listing_title}
                        </p>
                      </div>
                    </div>
                    <Badge className={lead.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}>
                      {lead.status}
                    </Badge>
                  </div>
                  
                  <div className="mt-4 p-3 bg-stone-50 rounded-lg">
                    <p className="text-sm text-stone-600">"{lead.message}"</p>
                  </div>
                  
                  <div className="mt-4 flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span className={hasSubscription ? '' : 'blur-sm select-none'}>
                        {hasSubscription ? lead.customer_phone : '98XXXXXXXX'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span className={hasSubscription ? '' : 'blur-sm select-none'}>
                        {hasSubscription ? lead.customer_email : 'xxx@email.com'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground ml-auto">
                      <Calendar className="w-4 h-4" />
                      {new Date(lead.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <div className="mt-4 flex gap-2">
                    <Button 
                      size="sm" 
                      className="btn-primary"
                      disabled={!hasSubscription}
                    >
                      <Phone className="w-4 h-4 mr-2" />
                      Call
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      disabled={!hasSubscription}
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Email
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Chat
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Subscription Section Component
const SubscriptionSection = ({ subscription, onSubscribe, loading }) => {
  const hasSubscription = subscription?.has_subscription;
  const expiresAt = subscription?.subscription?.expires_at;

  const features = [
    { icon: Star, text: 'Priority in search results' },
    { icon: Shield, text: 'Verified badge on profile' },
    { icon: Users, text: 'See full customer contact details' },
    { icon: BarChart3, text: 'Advanced analytics dashboard' },
    { icon: Zap, text: 'Boost your listings' },
    { icon: MessageCircle, text: 'Direct customer inquiries' },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6" data-testid="subscription-section">
      {hasSubscription ? (
        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Crown className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="font-heading text-2xl font-bold text-green-800">Premium Active</h2>
              <p className="text-green-600 mt-2">
                Your subscription is active until{' '}
                <span className="font-semibold">
                  {expiresAt ? new Date(expiresAt).toLocaleDateString() : 'N/A'}
                </span>
              </p>
              
              <div className="mt-6 p-4 bg-white rounded-xl">
                <h3 className="font-semibold text-stone-700 mb-3">Your Premium Benefits:</h3>
                <div className="grid grid-cols-2 gap-3">
                  {features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm text-stone-600">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      {feature.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Crown className="w-8 h-8 text-primary" />
              </div>
              <Badge className="bg-primary text-white mb-4">Service Provider Plan</Badge>
              <h2 className="font-heading text-3xl font-bold">₹251<span className="text-lg font-normal text-muted-foreground">/month</span></h2>
              <p className="text-muted-foreground mt-2">
                Grow your business with premium features
              </p>
              
              <div className="mt-8 space-y-3 text-left">
                {features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-white rounded-lg">
                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                      <feature.icon className="w-4 h-4 text-primary" />
                    </div>
                    <span className="font-medium">{feature.text}</span>
                  </div>
                ))}
              </div>
              
              <Button 
                onClick={onSubscribe} 
                disabled={loading}
                className="w-full btn-primary mt-8 h-12 text-lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Crown className="w-5 h-5 mr-2" />
                    Subscribe Now - ₹251/month
                  </>
                )}
              </Button>
              
              <p className="text-xs text-muted-foreground mt-4">
                Secure payment via Razorpay. Cancel anytime.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Boost Listing Modal Component
export const BoostListingModal = ({ listing, isOpen, onClose, user }) => {
  const [selectedDuration, setSelectedDuration] = useState('7_days');
  const [loading, setLoading] = useState(false);

  const boostOptions = [
    { id: '7_days', days: 7, price: '₹99', highlight: false },
    { id: '15_days', days: 15, price: '₹179', highlight: true, badge: 'Popular' },
    { id: '30_days', days: 30, price: '₹299', highlight: false },
  ];

  const handleBoost = async () => {
    setLoading(true);
    try {
      const orderRes = await boostAPI.createOrder(listing.id, selectedDuration);
      const { order_id, amount, key_id } = orderRes.data;

      const options = {
        key: key_id,
        amount: amount,
        currency: 'INR',
        name: 'GharSetu',
        description: `Boost Listing - ${selectedDuration.replace('_', ' ')}`,
        order_id: order_id,
        handler: async (response) => {
          try {
            await boostAPI.verify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });
            toast.success('Listing boosted successfully! 🚀');
            onClose();
          } catch (e) {
            toast.error('Payment verification failed');
          }
        },
        prefill: {
          name: user?.name,
          email: user?.email,
          contact: user?.phone
        },
        theme: {
          color: '#10b981'
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error) {
      toast.error('Failed to create boost order');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-primary" />
            Boost Your Listing
          </DialogTitle>
          <DialogDescription>
            Get more visibility and attract more customers
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Listing Preview */}
          <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-lg">
            <img
              src={listing?.images?.[0] || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=100'}
              alt={listing?.title}
              className="w-16 h-16 rounded-lg object-cover"
            />
            <div>
              <h4 className="font-medium line-clamp-1">{listing?.title}</h4>
              <p className="text-sm text-muted-foreground">{listing?.location}</p>
            </div>
          </div>

          {/* Duration Options */}
          <div className="space-y-2">
            {boostOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setSelectedDuration(option.id)}
                className={`w-full p-4 rounded-xl border-2 transition-all flex items-center justify-between ${
                  selectedDuration === option.id
                    ? 'border-primary bg-primary/5'
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedDuration === option.id
                      ? 'border-primary bg-primary'
                      : 'border-stone-300'
                  }`}>
                    {selectedDuration === option.id && (
                      <CheckCircle className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{option.days} Days</span>
                      {option.badge && (
                        <Badge className="bg-orange-100 text-orange-600 text-xs">
                          {option.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {option.days}x more visibility
                    </p>
                  </div>
                </div>
                <span className="font-bold text-lg text-primary">{option.price}</span>
              </button>
            ))}
          </div>

          {/* Benefits */}
          <div className="p-3 bg-primary/5 rounded-lg">
            <h4 className="font-medium text-sm mb-2">Boost Benefits:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Priority placement in search results
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Featured badge on listing
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                10x more customer inquiries
              </li>
            </ul>
          </div>

          {/* Action Button */}
          <Button
            onClick={handleBoost}
            disabled={loading}
            className="w-full btn-primary h-12"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Rocket className="w-5 h-5 mr-2" />
                Boost Now - {boostOptions.find(o => o.id === selectedDuration)?.price}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OwnerDashboard;
