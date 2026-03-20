import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { adminAPI } from '../lib/api';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';
import {
  Users,
  FileText,
  Calendar,
  TrendingUp,
  Home,
  Building2,
  Hotel,
  PartyPopper,
  Wrench,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  LogOut,
  Loader2,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const categoryIcons = {
  home: Home,
  business: Building2,
  stay: Hotel,
  event: PartyPopper,
  services: Wrench,
};

export const AdminDashboard = () => {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [listings, setListings] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!isAdmin) {
      toast.error('Admin access required');
      navigate('/');
      return;
    }
    fetchDashboardData();
  }, [isAdmin, navigate]);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, usersRes, listingsRes, bookingsRes] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.getUsers({ limit: 50 }),
        adminAPI.getListings({ limit: 50 }),
        adminAPI.getBookings({ limit: 50 }),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data.users);
      setListings(listingsRes.data.listings);
      setBookings(bookingsRes.data.bookings);
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
      toast.error('Failed to load admin dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleListingStatus = async (listingId, status) => {
    try {
      await adminAPI.updateListingStatus(listingId, status);
      setListings(listings.map((l) => (l.id === listingId ? { ...l, status } : l)));
      toast.success(`Listing ${status}`);
    } catch (error) {
      toast.error('Failed to update listing status');
    }
  };

  const handleAadharVerify = async (userId, verified) => {
    try {
      await adminAPI.verifyAadhar(userId, verified);
      setUsers(users.map((u) => (u.id === userId ? { ...u, aadhar_status: verified ? 'verified' : 'rejected' } : u)));
      toast.success(verified ? 'Aadhar verified!' : 'Verification rejected');
    } catch (error) {
      toast.error('Failed to update verification status');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100" data-testid="admin-dashboard">
      {/* Header */}
      <header className="bg-stone-900 text-white">
        <div className="container-main py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <Home className="w-6 h-6" />
              </div>
              <span className="font-heading font-bold text-xl">GharSetu</span>
            </Link>
            <Badge className="bg-red-600">Admin</Badge>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-stone-400">{user?.email}</span>
            <button onClick={handleLogout} className="text-stone-400 hover:text-white">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="container-main py-8">
        <h1 className="font-heading text-3xl font-bold mb-8">Admin Dashboard</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="text-2xl font-bold">{stats?.total_users || 0}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Shield className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="text-2xl font-bold">{stats?.total_owners || 0}</p>
                <p className="text-sm text-muted-foreground">Owners</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <FileText className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <p className="text-2xl font-bold">{stats?.total_listings || 0}</p>
                <p className="text-sm text-muted-foreground">Listings</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Clock className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                <p className="text-2xl font-bold">{stats?.pending_listings || 0}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Calendar className="w-8 h-8 text-pink-600 mx-auto mb-2" />
                <p className="text-2xl font-bold">{stats?.total_bookings || 0}</p>
                <p className="text-sm text-muted-foreground">Bookings</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <TrendingUp className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                <p className="text-2xl font-bold">{stats?.total_videos || 0}</p>
                <p className="text-sm text-muted-foreground">Videos</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Category Stats */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Listings by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.entries(stats?.category_stats || {}).map(([cat, count]) => {
                const Icon = categoryIcons[cat] || FileText;
                return (
                  <div key={cat} className="flex items-center gap-3 p-4 bg-stone-50 rounded-lg">
                    <Icon className="w-6 h-6 text-primary" />
                    <div>
                      <p className="font-bold">{count}</p>
                      <p className="text-sm text-muted-foreground capitalize">{cat}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users ({users.length})</TabsTrigger>
            <TabsTrigger value="listings">Listings ({listings.length})</TabsTrigger>
            <TabsTrigger value="bookings">Bookings ({bookings.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Users */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {users.slice(0, 5).map((u) => (
                      <div key={u.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                        <div>
                          <p className="font-medium">{u.name}</p>
                          <p className="text-sm text-muted-foreground">{u.email}</p>
                        </div>
                        <Badge className={u.role === 'owner' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}>
                          {u.role}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Pending Listings */}
              <Card>
                <CardHeader>
                  <CardTitle>Pending Approvals</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {listings
                      .filter((l) => l.status === 'pending')
                      .slice(0, 5)
                      .map((listing) => (
                        <div key={listing.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                          <div className="flex-1 min-w-0 mr-4">
                            <p className="font-medium truncate">{listing.title}</p>
                            <p className="text-sm text-muted-foreground capitalize">{listing.category}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleListingStatus(listing.id, 'approved')}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleListingStatus(listing.id, 'rejected')}
                              className="text-red-600"
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    {listings.filter((l) => l.status === 'pending').length === 0 && (
                      <p className="text-center text-muted-foreground py-4">No pending approvals</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardContent className="pt-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Name</th>
                        <th className="text-left py-3 px-4">Email</th>
                        <th className="text-left py-3 px-4">Phone</th>
                        <th className="text-left py-3 px-4">Role</th>
                        <th className="text-left py-3 px-4">Verified</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-b hover:bg-stone-50">
                          <td className="py-3 px-4">{u.name}</td>
                          <td className="py-3 px-4">{u.email}</td>
                          <td className="py-3 px-4">{u.phone}</td>
                          <td className="py-3 px-4">
                            <Badge className={
                              u.role === 'admin' ? 'bg-red-100 text-red-700' :
                              u.role?.includes('owner') || u.role === 'service_provider' ? 'bg-green-100 text-green-700' :
                              'bg-blue-100 text-blue-700'
                            }>
                              {u.role}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            {u.aadhar_status === 'verified' ? (
                              <Badge className="bg-green-100 text-green-700">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Verified
                              </Badge>
                            ) : u.aadhar_number ? (
                              <div className="flex items-center gap-2">
                                <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="h-7 text-xs"
                                  onClick={() => handleAadharVerify(u.id, true)}
                                >
                                  Verify
                                </Button>
                              </div>
                            ) : (
                              <Badge className="bg-stone-100 text-stone-600">No Aadhar</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="listings">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {listings.map((listing) => {
                    const Icon = categoryIcons[listing.category] || FileText;
                    return (
                      <div key={listing.id} className="flex items-center gap-4 p-4 bg-stone-50 rounded-lg">
                        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                          <img
                            src={listing.images?.[0] || 'https://images.unsplash.com/photo-1744311971549-9c529b60b98a?w=200'}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Icon className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground capitalize">{listing.category}</span>
                            <Badge className={
                              listing.status === 'approved' ? 'bg-green-100 text-green-700' :
                              listing.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }>
                              {listing.status}
                            </Badge>
                          </div>
                          <h4 className="font-medium truncate">{listing.title}</h4>
                          <p className="text-sm text-muted-foreground">by {listing.owner_name}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary">₹{listing.price?.toLocaleString('en-IN')}</p>
                          <p className="text-sm text-muted-foreground capitalize">{listing.listing_type}</p>
                        </div>
                        {listing.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleListingStatus(listing.id, 'approved')}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleListingStatus(listing.id, 'rejected')}
                              className="text-red-600"
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                        <Link to={`/listing/${listing.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bookings">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {bookings.map((booking) => (
                    <div key={booking.id} className="flex items-center gap-4 p-4 bg-stone-50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={
                            booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                            booking.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            booking.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                            'bg-blue-100 text-blue-700'
                          }>
                            {booking.status}
                          </Badge>
                        </div>
                        <h4 className="font-medium">{booking.listing_title}</h4>
                        <p className="text-sm text-muted-foreground">
                          Booked by: {booking.user_name} | Date: {booking.booking_date}
                        </p>
                      </div>
                      <p className="font-bold text-primary">₹{booking.total_price?.toLocaleString('en-IN')}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
