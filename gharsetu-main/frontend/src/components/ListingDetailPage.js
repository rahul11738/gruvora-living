import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { listingsAPI, bookingsAPI, wishlistAPI } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  MapPin,
  Heart,
  Share2,
  Phone,
  Mail,
  Eye,
  Calendar as CalendarIcon,
  User,
  Shield,
  ChevronLeft,
  ChevronRight,
  Home,
  Building2,
  Hotel,
  PartyPopper,
  Wrench,
  Check,
  Star,
  MessageCircle,
  Video,
  Play,
  CreditCard,
} from 'lucide-react';
import { Header, Footer } from './Layout';
import { ChatWithOwnerButton } from './DirectChat';
import { PaymentButton } from './PaymentModal';

const categoryIcons = {
  home: Home,
  business: Building2,
  stay: Hotel,
  event: PartyPopper,
  services: Wrench,
};

const categoryColors = {
  home: 'bg-emerald-500',
  business: 'bg-blue-500',
  stay: 'bg-purple-500',
  event: 'bg-pink-500',
  services: 'bg-orange-500',
};

export const ListingDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [bookingDate, setBookingDate] = useState(null);
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingGuests, setBookingGuests] = useState(1);
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    fetchListing();
  }, [id]);

  const fetchListing = async () => {
    try {
      const response = await listingsAPI.getOne(id);
      setListing(response.data);
    } catch (error) {
      console.error('Failed to fetch listing:', error);
      toast.error('Listing not found');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleWishlist = async () => {
    if (!isAuthenticated) {
      toast.error('Please login to add to wishlist');
      return;
    }
    try {
      if (isWishlisted) {
        await wishlistAPI.remove(id);
        setIsWishlisted(false);
        toast.success('Removed from wishlist');
      } else {
        await wishlistAPI.add(id);
        setIsWishlisted(true);
        toast.success('Added to wishlist!');
      }
    } catch (error) {
      toast.error('Failed to update wishlist');
    }
  };

  const handleBooking = async () => {
    if (!isAuthenticated) {
      toast.error('Please login to book');
      return;
    }
    if (!bookingDate) {
      toast.error('Please select a date');
      return;
    }

    setBookingLoading(true);
    try {
      await bookingsAPI.create({
        listing_id: id,
        booking_date: format(bookingDate, 'yyyy-MM-dd'),
        guests: bookingGuests,
        notes: bookingNotes,
      });
      toast.success('Booking request sent successfully!');
      setShowBookingDialog(false);
      setBookingDate(null);
      setBookingNotes('');
    } catch (error) {
      toast.error('Failed to create booking');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: listing?.title,
        text: listing?.description,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard!');
    }
  };

  const handleLike = async () => {
    if (!isAuthenticated) {
      toast.error('Please login to like');
      return;
    }
    try {
      await listingsAPI.like(id);
      setListing({ ...listing, likes: (listing.likes || 0) + 1 });
      toast.success('Liked!');
    } catch (error) {
      console.error('Failed to like:', error);
    }
  };

  const formatPrice = (price, type) => {
    if (price >= 10000000) {
      return `₹${(price / 10000000).toFixed(2)} Cr`;
    } else if (price >= 100000) {
      return `₹${(price / 100000).toFixed(2)} L`;
    }
    return `₹${price?.toLocaleString('en-IN')}${type === 'rent' ? '/mo' : ''}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Header />
        <div className="container-main py-8">
          <div className="animate-pulse space-y-6">
            <div className="aspect-[16/9] bg-stone-200 rounded-2xl" />
            <div className="h-10 bg-stone-200 rounded w-1/2" />
            <div className="h-6 bg-stone-200 rounded w-1/3" />
          </div>
        </div>
      </div>
    );
  }

  if (!listing) return null;

  const Icon = categoryIcons[listing.category] || Home;
  const bgColor = categoryColors[listing.category] || 'bg-primary';
  const images = listing.images?.length > 0 
    ? listing.images 
    : ['https://images.unsplash.com/photo-1744311971549-9c529b60b98a?w=800'];

  return (
    <div className="min-h-screen bg-stone-50" data-testid="listing-detail-page">
      <Header />

      {/* Back Button */}
      <div className="container-main py-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          Back to listings
        </button>
      </div>

      {/* Image Gallery */}
      <div className="container-main mb-8">
        <div className="relative aspect-[16/9] md:aspect-[21/9] rounded-2xl overflow-hidden">
          <img
            src={images[currentImageIndex]}
            alt={listing.title}
            className="w-full h-full object-cover"
          />
          
          {images.length > 1 && (
            <>
              <button
                onClick={() => setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/80 rounded-full flex items-center justify-center hover:bg-white transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={() => setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/80 rounded-full flex items-center justify-center hover:bg-white transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentImageIndex(i)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      i === currentImageIndex ? 'bg-white' : 'bg-white/50'
                    }`}
                  />
                ))}
              </div>
            </>
          )}

          {/* Actions */}
          <div className="absolute top-4 right-4 flex gap-2">
            <button
              onClick={handleWishlist}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                isWishlisted ? 'bg-red-500 text-white' : 'bg-white/80 hover:bg-white'
              }`}
              data-testid="wishlist-btn"
            >
              <Heart className={`w-6 h-6 ${isWishlisted ? 'fill-white' : ''}`} />
            </button>
            <button
              onClick={handleShare}
              className="w-12 h-12 bg-white/80 rounded-full flex items-center justify-center hover:bg-white transition-colors"
            >
              <Share2 className="w-6 h-6" />
            </button>
          </div>

          {/* Category Badge */}
          <div className={`absolute top-4 left-4 ${bgColor} px-4 py-2 rounded-full flex items-center gap-2`}>
            <Icon className="w-5 h-5 text-white" />
            <span className="text-white font-medium capitalize">{listing.category}</span>
          </div>
        </div>

        {/* Thumbnail Strip */}
        {images.length > 1 && (
          <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setCurrentImageIndex(i)}
                className={`flex-shrink-0 w-24 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                  i === currentImageIndex ? 'border-primary' : 'border-transparent'
                }`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="container-main pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Title & Price */}
            <div>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h1 className="font-heading text-3xl md:text-4xl font-bold text-stone-900">
                    {listing.title}
                  </h1>
                  <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                    <MapPin className="w-5 h-5" />
                    <span>{listing.location}, {listing.city}, {listing.state}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-heading text-3xl font-bold text-primary">
                    {formatPrice(listing.price, listing.listing_type)}
                  </p>
                  <span className="text-sm text-muted-foreground capitalize">
                    {listing.listing_type === 'rent' ? 'For Rent' : 'For Sale'}
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-6 text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  {listing.views} views
                </span>
                <button onClick={handleLike} className="flex items-center gap-1 hover:text-red-500 transition-colors">
                  <Heart className="w-4 h-4" />
                  {listing.likes} likes
                </button>
                <span className="flex items-center gap-1">
                  <MessageCircle className="w-4 h-4" />
                  {listing.inquiries} inquiries
                </span>
              </div>
            </div>

            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                  {listing.description}
                </p>
              </CardContent>
            </Card>

            {/* Amenities */}
            {listing.amenities?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Amenities</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {listing.amenities.map((amenity, i) => (
                      <div key={i} className="flex items-center gap-2 text-muted-foreground">
                        <Check className="w-5 h-5 text-primary" />
                        <span>{amenity}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Specifications */}
            {listing.specifications && Object.keys(listing.specifications).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Specifications</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(listing.specifications).map(([key, value]) => (
                      <div key={key} className="flex justify-between border-b pb-2">
                        <span className="text-muted-foreground capitalize">{key.replace('_', ' ')}</span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Owner Card - NO CONTACT INFO SHOWN */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  Verified Owner
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 bg-primary rounded-full flex items-center justify-center">
                    <User className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-lg">{listing.owner_name}</p>
                    <p className="text-sm text-muted-foreground">Property Owner</p>
                  </div>
                </div>

                {/* Info Box - Contact only via Chat */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                  <p className="text-sm text-amber-800">
                    Contact owner via chat only. Phone/Email not shared for security.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Booking Card */}
            <Card className="border-primary">
              <CardContent className="pt-6 space-y-3">
                {/* Instant Payment for Stay/Event/Services */}
                {(listing.category === 'stay' || listing.category === 'event' || listing.category === 'services') && (
                  <PaymentButton
                    listing={listing}
                    bookingDetails={{ date: bookingDate, guests: bookingGuests, notes: bookingNotes }}
                    className="w-full btn-primary text-base md:text-lg py-5 md:py-6"
                    onSuccess={() => {
                      toast.success('Booking confirmed! Check your email.');
                    }}
                  >
                    <CreditCard className="w-5 h-5 mr-2" />
                    {listing.category === 'stay' ? 'Book & Pay Now' :
                     listing.category === 'event' ? 'Book Venue & Pay' :
                     'Book Service & Pay'}
                  </PaymentButton>
                )}

                {/* Chat with Owner Button */}
                <ChatWithOwnerButton
                  ownerId={listing.owner_id}
                  ownerName={listing.owner_name}
                  listingId={listing.id}
                  listingTitle={listing.title}
                  className="w-full btn-secondary text-base py-5"
                />

                {/* Inquiry/Schedule Visit for Home/Business */}
                {(listing.category === 'home' || listing.category === 'business') && (
                  <Dialog open={showBookingDialog} onOpenChange={setShowBookingDialog}>
                    <DialogTrigger asChild>
                      <Button className="w-full bg-stone-100 hover:bg-stone-200 text-stone-800 py-5" data-testid="book-now-btn">
                        <CalendarIcon className="w-5 h-5 mr-2" />
                        Schedule Visit
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Schedule Property Visit</DialogTitle>
                        <DialogDescription>
                          Pick a date for site visit
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        <div>
                          <Label>Select Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-start text-left font-normal mt-2">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {bookingDate ? format(bookingDate, 'PPP') : 'Pick a date'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={bookingDate}
                                onSelect={setBookingDate}
                                disabled={(date) => date < new Date()}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div>
                          <Label>Additional Notes</Label>
                          <Textarea
                            placeholder="Preferred time, questions..."
                            value={bookingNotes}
                            onChange={(e) => setBookingNotes(e.target.value)}
                            className="mt-2"
                          />
                        </div>
                        <Button
                          onClick={handleBooking}
                          className="w-full btn-primary"
                          disabled={bookingLoading}
                          data-testid="confirm-booking-btn"
                        >
                          {bookingLoading ? 'Sending...' : 'Send Visit Request'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}

                <p className="text-center text-xs text-muted-foreground">
                  Secure payment • Instant confirmation
                </p>
              </CardContent>
            </Card>

            {/* Safety Tips */}
            <Card className="bg-secondary/5 border-secondary/20">
              <CardContent className="pt-6">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-secondary" />
                  Safety Tips
                </h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• Always visit the property before making any payment</li>
                  <li>• Verify owner documents and ownership proof</li>
                  <li>• Don't share OTPs or sensitive information</li>
                  <li>• Report suspicious listings to GharSetu</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ListingDetailPage;
