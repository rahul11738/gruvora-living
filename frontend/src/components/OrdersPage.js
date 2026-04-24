import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { bookingsAPI } from '../lib/api';
import { generateBookingInvoicePDF } from '../lib/generateBookingInvoicePDF';
import { Button } from './ui/button';
import { 
  ClipboardList, 
  Search, 
  Download, 
  ExternalLink, 
  Calendar, 
  MapPin, 
  ArrowLeft,
  Package,
  Clock,
  CheckCircle2,
  AlertCircle,
  User
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

/**
 * OrdersList component that can be embedded in other pages (like UserDashboard)
 */
export const OrdersList = ({ isEmbedded = false }) => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const res = await bookingsAPI.getUserBookings();
      setBookings(Array.isArray(res?.data?.bookings) ? res.data.bookings : []);
    } catch (err) {
      console.error('Error fetching bookings:', err);
      toast.error('Failed to load order history');
    } finally {
      setLoading(false);
    }
  };

  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = 
      booking.listing_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.owner_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || booking.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'confirmed': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'completed': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'cancelled': return 'bg-rose-100 text-rose-700 border-rose-200';
      default: return 'bg-stone-100 text-stone-700 border-stone-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'confirmed': return <CheckCircle2 className="w-3.5 h-3.5" />;
      case 'pending': return <Clock className="w-3.5 h-3.5" />;
      case 'completed': return <CheckCircle2 className="w-3.5 h-3.5" />;
      case 'cancelled': return <AlertCircle className="w-3.5 h-3.5" />;
      default: return <Package className="w-3.5 h-3.5" />;
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center min-h-[40vh]">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
        <p className="text-stone-500 font-medium">Fetching orders...</p>
      </div>
    );
  }

  return (
    <div className={isEmbedded ? '' : 'container-main pt-8 md:pt-12'}>
      {/* Filters & Search */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-8">
        <div className="lg:col-span-8 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          <input 
            type="text"
            placeholder="Search by property, host, or booking ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-stone-200 bg-white shadow-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
          />
        </div>
        <div className="lg:col-span-4">
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border border-stone-200 bg-white shadow-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Orders List */}
      {filteredBookings.length === 0 ? (
        <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Package className="w-8 h-8 text-stone-400" />
          </div>
          <h3 className="text-xl font-semibold text-stone-900 mb-2">No orders found</h3>
          <p className="text-stone-500 mb-8 max-w-md mx-auto">
            {searchQuery || filterStatus !== 'all' 
              ? "We couldn't find any bookings matching your current filters." 
              : "You haven't made any bookings yet."}
          </p>
          {(searchQuery || filterStatus !== 'all') && (
            <Button 
              onClick={() => { setSearchQuery(''); setFilterStatus('all'); }}
              variant="ghost" 
              className="text-primary font-semibold"
            >
              Clear all filters
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredBookings.map((booking, index) => (
              <motion.div
                key={booking.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group bg-white rounded-3xl border border-stone-200 p-5 md:p-6 shadow-sm hover:shadow-xl hover:border-primary/20 transition-all duration-300 overflow-hidden relative"
              >
                <div className="flex flex-col md:flex-row gap-6 relative z-10">
                  {/* Image Placeholder/Thumbnail */}
                  <div className="w-full md:w-48 h-32 md:h-32 rounded-2xl overflow-hidden bg-stone-100 flex-shrink-0">
                    {booking.listing_image ? (
                      <img 
                        src={booking.listing_image} 
                        alt={booking.listing_title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-stone-400">
                        <MapPin className="w-8 h-8" />
                      </div>
                    )}
                  </div>

                  {/* Content Section */}
                  <div className="flex-grow">
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${getStatusColor(booking.status)}`}>
                            {getStatusIcon(booking.status)}
                            {booking.status}
                          </span>
                          <span className="text-[11px] font-bold text-stone-400 uppercase tracking-widest bg-stone-50 px-2 py-0.5 rounded-md">
                            {booking.listing_category || 'Stay'}
                          </span>
                        </div>
                        <h3 className="text-xl font-bold text-stone-900 group-hover:text-primary transition-colors">
                          {booking.listing_title || 'Unknown Property'}
                        </h3>
                        <div className="flex items-center gap-4 mt-2 text-sm text-stone-500">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4" />
                            {formatDate(booking.booking_date)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <User className="w-4 h-4" />
                            {booking.guests || 1} Guests
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-2xl font-bold text-stone-900">
                          ₹{(booking.total_price || booking.amount_paid || 0).toLocaleString('en-IN')}
                        </div>
                        <p className="text-xs text-stone-400 font-medium">Incl. all taxes</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-stone-100">
                      <div className="flex items-center gap-4">
                        <div className="text-xs">
                          <span className="text-stone-400 block mb-0.5">Booking ID</span>
                          <span className="font-mono font-medium text-stone-600">{booking.id?.slice(0, 12).toUpperCase()}</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-stone-400 block mb-0.5">Host</span>
                          <span className="font-medium text-stone-800">{booking.owner_name || 'Gruvora Host'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link to={`/listing/${booking.listing_id}`}>
                          <Button variant="ghost" size="sm" className="rounded-lg text-stone-600 gap-1.5">
                            View Property
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                        <Button 
                          onClick={() => generateBookingInvoicePDF(booking, user)}
                          variant="outline" 
                          size="sm" 
                          className="rounded-lg border-stone-200 text-stone-700 shadow-sm gap-1.5 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Invoice
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export const OrdersPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-stone-50/50 pb-20">
      <div className="container-main pt-8 md:pt-12">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <button 
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-800 transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-stone-900 flex items-center gap-3">
              <ClipboardList className="w-8 h-8 text-primary" />
              Order History
            </h1>
            <p className="text-stone-500 mt-2">Manage your bookings, invoices, and stay history.</p>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/discover">
              <Button variant="outline" className="rounded-xl border-stone-200 bg-white shadow-sm hover:bg-stone-50">
                Book New Stay
              </Button>
            </Link>
          </div>
        </div>

        <OrdersList />

        {/* Support Section */}
        <div className="mt-16 bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-[2.5rem] p-8 md:p-12 text-white relative overflow-hidden shadow-2xl">
          <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
          
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
            <div>
              <h2 className="text-2xl md:text-3xl font-heading font-bold mb-4">Need help with a booking?</h2>
              <p className="text-emerald-50/80 max-w-lg leading-relaxed">
                If you encounter any issues with your payment or booking details, our 24/7 support team is here to assist you.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <a href="mailto:support@gruvora.com">
                <Button className="bg-white text-emerald-800 hover:bg-emerald-50 rounded-2xl px-8 py-6 h-auto font-bold text-lg shadow-xl border-none">
                  Contact Support
                </Button>
              </a>
              <Link to="/chat">
                <Button variant="ghost" className="text-white hover:bg-white/10 rounded-2xl px-6 py-6 h-auto font-semibold">
                  Live Chat
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
