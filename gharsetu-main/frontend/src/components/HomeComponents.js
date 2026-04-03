import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { listingsAPI, categoriesAPI, recommendationsAPI } from '../lib/api';
import { prefetchMapRoute, prefetchReelsRoute } from '../lib/routePrefetch';
import { markRouteNavigation } from '../lib/routeTelemetry';
import { useAuth } from '../context/AuthContext';
import { useInteractions } from '../context/InteractionContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import {
  Home,
  Building2,
  Hotel,
  PartyPopper,
  Wrench,
  Search,
  MapPin,
  Heart,
  Eye,
  ArrowRight,
  Play,
  Star,
  Shield,
  Users,
  TrendingUp,
  ChevronRight,
  Mic,
  MicOff,
  Map,
  Sparkles,
  Zap,
  Phone,
  MessageCircle,
  Calendar,
  Video,
  CheckCircle,
  Award,
  Globe,
} from 'lucide-react';

const categoryIcons = {
  home: Home,
  business: Building2,
  stay: Hotel,
  event: PartyPopper,
  services: Wrench,
};

const categoryColors = {
  home: 'from-emerald-500 to-emerald-600',
  business: 'from-blue-500 to-blue-600',
  stay: 'from-purple-500 to-purple-600',
  event: 'from-pink-500 to-pink-600',
  services: 'from-orange-500 to-orange-600',
};

const categoryBgColors = {
  home: 'bg-emerald-500',
  business: 'bg-blue-500',
  stay: 'bg-purple-500',
  event: 'bg-pink-500',
  services: 'bg-orange-500',
};

const gujaratCities = [
  'Surat',
  'Ahmedabad',
  'Vadodara',
  'Rajkot',
  'Gandhinagar',
  'Bharuch',
  'Anand',
  'Nadiad',
  'Jamnagar',
  'Bhavnagar',
];

const revealUp = (reduceMotion, delay = 0, offset = 20) => ({
  initial: reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: offset },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: reduceMotion ? { duration: 0 } : { duration: 0.45, delay, ease: 'easeOut' },
});

export const HeroSection = () => {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('home');
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      setVoiceSupported(true);
    }
  }, []);

  const handleVoiceSearch = () => {
    if (!voiceSupported) {
      toast.error('Voice search is not supported in this browser.');
      return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = 'en-IN';
    recognition.continuous = false;
    
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setSearchQuery(transcript);
    };
    
    recognition.start();
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (location) params.set('city', location);
    navigate(`/category/${category}?${params.toString()}`);
  };

  return (
    <section className="hero-container relative min-h-[90vh] flex items-center overflow-hidden" data-testid="hero-section">
      {/* Animated Background */}
      <div className="absolute inset-0">
        <motion.div
          initial={reduceMotion ? false : { scale: 1.1 }}
          animate={reduceMotion ? { scale: 1 } : { scale: 1 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 10, ease: 'easeOut' }}
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: 'url(https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1920)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-stone-900/95 via-stone-900/80 to-stone-900/40" />
        {/* Floating Elements */}
        <motion.div 
          animate={reduceMotion ? { opacity: 0.2, scale: 1 } : { 
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.3, 0.2]
          }}
          transition={reduceMotion ? { duration: 0 } : { duration: 4, repeat: Infinity }}
          className="absolute top-20 right-20 w-72 h-72 bg-primary/20 rounded-full blur-3xl" 
        />
        <motion.div 
          animate={reduceMotion ? { opacity: 0.2, scale: 1 } : { 
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.4, 0.2]
          }}
          transition={reduceMotion ? { duration: 0 } : { duration: 5, repeat: Infinity, delay: 1 }}
          className="absolute bottom-20 left-20 w-96 h-96 bg-secondary/20 rounded-full blur-3xl" 
        />
        <motion.div
          animate={reduceMotion ? { opacity: 0.12, y: 0 } : {
            y: [0, -14, 0],
            opacity: [0.12, 0.24, 0.12],
          }}
          transition={reduceMotion ? { duration: 0 } : { duration: 6, repeat: Infinity, delay: 0.6 }}
          className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[28rem] h-[18rem] bg-emerald-300/20 rounded-full blur-3xl"
        />
      </div>

      <div className="container-main relative z-10 py-16 pt-16 md:pt-20">
        <div className="grid grid-cols-1 gap-10 items-center justify-items-center">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.8 }}
            className="w-full max-w-5xl text-center flex flex-col items-center"
          >
            <motion.div 
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduceMotion ? { duration: 0 } : { delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-8"
            >
              <Sparkles className="w-4 h-4 text-secondary" />
              <span className="text-white/90 text-sm font-medium">Gujarat's #1 Property Platform</span>
            </motion.div>
            
            <motion.h1 
              initial={reduceMotion ? false : { opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduceMotion ? { duration: 0 } : { delay: 0.3, duration: 0.6 }}
              className="font-heading text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-tight mb-8"
            >
              Find Your
              <motion.span 
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={reduceMotion ? { duration: 0 } : { delay: 0.6 }}
                className="block bg-gradient-to-r from-secondary to-orange-400 bg-clip-text text-transparent"
              >
                Perfect Space
              </motion.span>
            </motion.h1>
            
            <motion.p 
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={reduceMotion ? { duration: 0 } : { delay: 0.5 }}
              className="text-lg md:text-xl text-stone-300 mb-6 leading-relaxed max-w-3xl mx-auto"
            >
              Discover homes, business spaces, hotels, event venues, and professional services - all in one place.
            </motion.p>
            <motion.p 
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={reduceMotion ? { duration: 0 } : { delay: 0.6 }}
              className="text-stone-400 mb-10"
            >
              {/* તમારી સંપૂર્ણ જગ્યા શોધો - ઘર, બિઝનેસ, રહેવાનું, ઇવેન્ટ અને સેવાઓ */}
            </motion.p>

            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduceMotion ? { duration: 0 } : { delay: 0.66, duration: 0.4 }}
              className="flex flex-wrap items-center justify-center gap-2 mb-8"
            >
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-100 border border-emerald-400/35 backdrop-blur-sm">
                <Shield className="w-3.5 h-3.5" /> Verified Owners
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-stone-100 border border-white/25 backdrop-blur-sm">
                <CheckCircle className="w-3.5 h-3.5" /> Trusted Listings
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-stone-100 border border-white/25 backdrop-blur-sm">
                <TrendingUp className="w-3.5 h-3.5" /> Fast Discovery
              </span>
            </motion.div>

            {/* Search Form with Category Filter */}
            <motion.form
              initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={reduceMotion ? { duration: 0 } : { delay: 0.7, duration: 0.55, ease: 'easeOut' }}
              onSubmit={handleSearch}
              className="hero-search-shell w-full max-w-5xl mx-auto"
            >
              <div className="hero-search-inner">
                <div className="w-full overflow-x-auto hide-scrollbar pb-1">
                  <div className="flex w-max mx-auto items-center gap-2 px-1">
                    {[
                      { id: 'home', label: 'Home', labelGu: 'ઘર', icon: Home },
                      { id: 'business', label: 'Business', labelGu: 'બિઝનેસ', icon: Building2 },
                      { id: 'stay', label: 'Stay', labelGu: 'રહેવાનું', icon: Hotel },
                      { id: 'event', label: 'Event', labelGu: 'ઇવેન્ટ', icon: PartyPopper },
                      { id: 'services', label: 'Services', labelGu: 'સેવાઓ', icon: Wrench },
                    ].map((cat, index) => {
                      const Icon = cat.icon;
                      const isActive = category === cat.id;
                      return (
                        <motion.button
                          key={cat.id}
                          type="button"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.78 + index * 0.04, duration: 0.25 }}
                          onClick={() => setCategory(cat.id)}
                          className={`hero-pill ${isActive ? 'hero-pill-active' : ''}`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="hidden md:inline">{cat.label}</span>
                          <span className="md:hidden">{cat.labelGu}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                <div className="hero-search-grid">
                  <div className="hero-input-wrap">
                    <Input
                      type="text"
                      placeholder="Search properties, office spaces..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="hero-search-input"
                      data-testid="hero-search-input"
                    />
                    <div className="hero-voice-slot">
                      <motion.button
                        type="button"
                        onClick={handleVoiceSearch}
                        animate={isListening && !reduceMotion ? { scale: [1, 1.08, 1], boxShadow: ['0 0 0 0 rgba(16,185,129,0.4)', '0 0 0 8px rgba(16,185,129,0)', '0 0 0 0 rgba(16,185,129,0)'] } : { scale: 1, boxShadow: '0 0 0 0 rgba(16,185,129,0)' }}
                        transition={reduceMotion ? { duration: 0 } : { duration: 1.2, repeat: isListening ? Infinity : 0 }}
                        whileHover={reduceMotion ? undefined : { scale: 1.04 }}
                        whileTap={{ scale: 0.97 }}
                        className="w-10 h-10 bg-primary rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors"
                        data-testid="voice-search-trigger"
                        aria-label="Voice Search"
                      >
                        {isListening ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
                      </motion.button>
                    </div>
                  </div>

                  <div className="hero-location-wrap">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none z-10" />
                    <select
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="hero-location-select"
                      data-testid="hero-location-input"
                    >
                      <option value="">All Cities</option>
                      {gujaratCities.map((city) => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                  </div>

                  <Button type="submit" className="hero-search-btn" data-testid="hero-search-btn">
                    <Search className="w-4 md:w-5 h-4 md:h-5 mr-2" />
                    <span>Search</span>
                  </Button>
                </div>
              </div>
            </motion.form>

            <div className="h-4 md:h-6" aria-hidden="true" />
          </motion.div>

        </div>
      </div>
    </section>
  );
};

export const CategoriesSection = () => {
  const reduceMotion = useReducedMotion();
  const [categories, setCategories] = useState([]);

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

  const defaultCategories = [
    { id: 'home', name: 'Home', name_gu: 'ઘર', description: '1-4 BHK, Villas, Penthouses, Farmhouses' },
    { id: 'business', name: 'Business', name_gu: 'બિઝનેસ', description: 'Shops, Offices, Warehouses, Co-working' },
    { id: 'stay', name: 'Stay', name_gu: 'રહેવાનું', description: 'Hotels, Guest Houses, Resorts, PG' },
    { id: 'event', name: 'Event', name_gu: 'ઇવેન્ટ', description: 'Party Plots, Marriage Halls, Banquets' },
    { id: 'services', name: 'Services', name_gu: 'સેવાઓ', description: 'Plumber, Electrician, Cleaning, Repair' },
  ];

  const displayCategories = categories.length > 0 ? categories : defaultCategories;

  return (
    <section className="section-padding bg-white" data-testid="categories-section">
      <div className="container-main">
        <motion.div 
          {...revealUp(reduceMotion, 0.02)}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-2 text-secondary font-medium text-sm uppercase tracking-wider">
            <Zap className="w-4 h-4" />
            Explore Categories
          </span>
          <h2 className="font-heading text-3xl md:text-5xl font-bold text-stone-900 mt-3">
            What are you looking for?
          </h2>
          <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
            Browse through our 5 comprehensive categories covering all your property and service needs
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {displayCategories.map((cat, index) => {
            const Icon = categoryIcons[cat.id] || Home;
            const gradientColor = categoryColors[cat.id] || 'from-primary to-emerald-600';

            return (
              <motion.div
                key={cat.id}
                {...revealUp(reduceMotion, index * 0.06, 24)}
              >
                <Link
                  to={`/category/${cat.id}`}
                  className="group relative overflow-hidden rounded-3xl p-8 hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 block bg-stone-50"
                  data-testid={`category-card-${cat.id}`}
                >
                  {/* Background Gradient */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${gradientColor} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  
                  {/* Content */}
                  <div className="relative z-10">
                    <motion.div 
                      whileHover={reduceMotion ? undefined : { scale: 1.08, rotate: 4 }}
                      className={`w-16 h-16 bg-gradient-to-br ${gradientColor} rounded-2xl flex items-center justify-center mb-6 shadow-lg`}
                    >
                      <Icon className="w-8 h-8 text-white" />
                    </motion.div>
                    <h3 className="font-heading font-bold text-xl text-stone-900 group-hover:text-white transition-colors">{cat.name}</h3>
                    <p className="text-primary font-medium text-sm mt-1 group-hover:text-white/80 transition-colors">{cat.name_gu}</p>
                    <p className="text-muted-foreground text-sm mt-3 line-clamp-2 group-hover:text-white/70 transition-colors">
                      {cat.description || cat.sub_categories?.slice(0, 4).map(s => s.name).join(', ')}
                    </p>
                    <div className="mt-4 flex items-center gap-2 text-primary group-hover:text-white transition-colors">
                      <span className="text-sm font-medium">Explore</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export const TrendingSection = () => {
  const reduceMotion = useReducedMotion();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(null);

  const fetchTrending = useCallback(async () => {
    try {
      const response = await listingsAPI.getTrending(8, activeCategory);
      setListings(response.data.listings);
    } catch (error) {
      console.error('Failed to fetch trending:', error);
    } finally {
      setLoading(false);
    }
  }, [activeCategory]);

  useEffect(() => {
    fetchTrending();
  }, [fetchTrending]);

  const categoryTabs = [
    { id: null, label: 'All' },
    { id: 'home', label: 'Home' },
    { id: 'business', label: 'Business' },
    { id: 'stay', label: 'Stay' },
    { id: 'event', label: 'Event' },
    { id: 'services', label: 'Services' },
  ];

  return (
    <section className="section-padding bg-gradient-to-b from-stone-50 to-white" data-testid="trending-section">
      <div className="container-main">
        <motion.div
          {...revealUp(reduceMotion, 0.02)}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10"
        >
          <div>
            <span className="inline-flex items-center gap-2 text-secondary font-medium text-sm uppercase tracking-wider">
              <TrendingUp className="w-4 h-4" />
              Trending Now
            </span>
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-stone-900 mt-2">
              Popular Properties
            </h2>
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {categoryTabs.map((tab) => (
              <button
                key={tab.id || 'all'}
                onClick={() => setActiveCategory(tab.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  activeCategory === tab.id
                    ? 'bg-primary text-white shadow-md shadow-primary/30'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200 hover:-translate-y-0.5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {listings.slice(0, 4).map((listing, index) => (
            <motion.div key={listing.id} {...revealUp(reduceMotion, 0.05 + index * 0.05, 20)}>
              <PropertyCard listing={listing} />
            </motion.div>
          ))}
        </div>

        <motion.div {...revealUp(reduceMotion, 0.12, 14)} className="mt-10 text-center">
          <Link to="/search">
            <Button variant="outline" className="btn-outline text-base px-8 py-6">
              View All Properties
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

// AI Recommendations Section
export const RecommendationsSection = () => {
  const { isAuthenticated } = useAuth();
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [aiExplanation, setAiExplanation] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      fetchRecommendations();
    }
  }, [isAuthenticated]);

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const response = await recommendationsAPI.getRecommendations(6);
      setRecommendations(response.data.recommendations || []);
      setAiExplanation(response.data.ai_explanation || '');
    } catch (error) {
      console.error('Failed to fetch recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated || recommendations.length === 0) {
    return null;
  }

  return (
    <section className="py-16 bg-gradient-to-b from-primary/5 to-transparent" data-testid="recommendations-section">
      <div className="container-main">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="font-heading text-2xl md:text-3xl font-bold">
              Recommended for You
            </h2>
            {aiExplanation && (
              <p className="text-muted-foreground text-sm mt-1">{aiExplanation}</p>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommendations.slice(0, 3).map((listing) => (
              <PropertyCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export const PropertyCard = memo(({ listing, showActions = true }) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { isWishlisted, toggleWishlist, pendingWishlistMap } = useInteractions();
  const Icon = categoryIcons[listing.category] || Home;
  const bgColor = categoryBgColors[listing.category] || 'bg-primary';
  const wishlisted = isWishlisted(listing.id);
  const wishlistPending = Boolean(pendingWishlistMap[listing.id]);

  const handleWishlistClick = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      toast.error('Please login to add to wishlist');
      return;
    }

    try {
      const result = await toggleWishlist(listing.id);
      if (result.ok) {
        toast.success(result.wishlisted ? 'Added to wishlist!' : 'Removed from wishlist', {
          duration: 1500,
          id: `wishlist-${listing.id}`,
        });
      }
    } catch {
      toast.error('Failed to update wishlist');
    }
  }, [isAuthenticated, listing.id, toggleWishlist]);

  const handleMapClick = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    prefetchMapRoute();
    markRouteNavigation('/map', 'home-property-map-btn');
    const params = new URLSearchParams();
    params.set('listingId', listing.id);
    if (listing.city) params.set('city', listing.city);
    if (listing.category) params.set('category', listing.category);
    navigate(`/map?${params.toString()}`);
  }, [listing.id, listing.city, listing.category, navigate]);

  const formatPrice = (price, type) => {
    if (price >= 10000000) {
      return `₹${(price / 10000000).toFixed(2)} Cr`;
    } else if (price >= 100000) {
      return `₹${(price / 100000).toFixed(2)} L`;
    }
    return `₹${price?.toLocaleString('en-IN')}${type === 'rent' ? '/mo' : ''}`;
  };

  return (
    <Link
      to={`/listing/${listing.id}`}
      className="group relative overflow-hidden rounded-2xl bg-white border border-stone-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
      data-testid={`property-card-${listing.id}`}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={listing.images?.[0] || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400'}
          alt={listing.title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        
        {/* Top Badges */}
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <div className={`${bgColor} px-3 py-1 rounded-full flex items-center gap-1`}>
            <Icon className="w-3 h-3 text-white" />
            <span className="text-white text-xs font-medium capitalize">{listing.category}</span>
          </div>
          {listing.owner_verified && (
            <div className="bg-green-500 p-1 rounded-full">
              <CheckCircle className="w-3 h-3 text-white" />
            </div>
          )}
        </div>

        {/* Type Badge */}
        <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm px-3 py-1 rounded-full">
          <span className="text-xs font-semibold text-stone-700 capitalize">
            {listing.listing_type === 'rent' ? 'For Rent' : 'For Sale'}
          </span>
        </div>

        {/* Wishlist Button */}
        {showActions && (
          <button
            className="absolute bottom-4 right-4 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white hover:scale-110 transition-all group/btn"
            onClick={handleWishlistClick}
            disabled={wishlistPending}
          >
            <Heart className={`w-5 h-5 transition-colors ${wishlisted ? 'text-red-500 fill-red-500' : 'text-stone-600 group-hover/btn:text-red-500'}`} />
          </button>
        )}

        {/* Quick Actions */}
        <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            title="View on Map"
            aria-label="View on Map"
            onMouseEnter={prefetchMapRoute}
            onFocus={prefetchMapRoute}
            onClick={handleMapClick}
            className="w-9 h-9 bg-white/95 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white hover:-translate-y-0.5 shadow-sm transition-all"
          >
            <Map className="w-4 h-4 text-stone-600" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="font-heading font-semibold text-lg text-stone-900 line-clamp-1 group-hover:text-primary transition-colors">
          {listing.title}
        </h3>
        
        <div className="flex items-center gap-1 mt-2 text-muted-foreground">
          <MapPin className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm line-clamp-1">{listing.location}, {listing.city}</span>
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-stone-100">
          <p className="font-heading font-bold text-xl text-primary">
            {formatPrice(listing.price, listing.listing_type)}
          </p>
          <div className="flex items-center gap-3 text-muted-foreground text-sm">
            <span className="flex items-center gap-1">
              <Eye className="w-4 h-4" />
              {listing.views?.toLocaleString()}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="w-4 h-4" />
              {listing.likes}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
});

export const FeaturesSection = () => {
  const reduceMotion = useReducedMotion();
  const features = [
    {
      icon: Shield,
      title: 'Verified Owners',
      description: 'All property owners verified with Aadhar for your safety',
      color: 'bg-green-500',
    },
    {
      icon: Video,
      title: 'Property Reels',
      description: 'Watch property videos like Instagram before visiting',
      color: 'bg-pink-500',
    },
    {
      icon: MessageCircle,
      title: 'Direct Chat',
      description: 'Chat directly with owners without sharing phone numbers',
      color: 'bg-blue-500',
    },
    {
      icon: Map,
      title: 'Map Search',
      description: 'Find properties on map with location-based search',
      color: 'bg-purple-500',
    },
    {
      icon: TrendingUp,
      title: 'Price Negotiation',
      description: 'Send offers and negotiate prices directly on platform',
      color: 'bg-orange-500',
    },
    {
      icon: Calendar,
      title: 'Schedule Visits',
      description: 'Book property visits online - in person or video call',
      color: 'bg-cyan-500',
    },
  ];

  return (
    <section className="section-padding bg-white" data-testid="features-section">
      <div className="container-main">
        <motion.div {...revealUp(reduceMotion, 0.02)} className="text-center mb-12">
          <span className="inline-flex items-center gap-2 text-secondary font-medium text-sm uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            Platform Features
          </span>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-stone-900 mt-3">
            Why Choose GRUVORA LIVING?
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={index}
                {...revealUp(reduceMotion, 0.04 + index * 0.05, 18)}
                whileHover={reduceMotion ? undefined : { y: -4 }}
                className="group p-8 rounded-2xl bg-stone-50 hover:bg-white hover:shadow-xl transition-all duration-300"
              >
                <div className={`w-14 h-14 ${feature.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="font-heading font-semibold text-xl text-stone-900 mb-3">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export const ReelsPromoSection = () => {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const handleWatchReels = useCallback(() => {
    prefetchReelsRoute();
    markRouteNavigation('/reels', 'home-reels-promo-cta');
    navigate('/reels');
  }, [navigate]);

  return (
    <section className="section-padding bg-white" data-testid="reels-promo">
      <div className="container-main">
        <motion.div
          {...revealUp(reduceMotion, 0.02, 24)}
          className="relative overflow-hidden rounded-3xl border border-stone-200 bg-gradient-to-br from-white via-stone-50 to-emerald-50/40 p-6 md:p-10 shadow-sm"
        >
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-300/20 blur-3xl rounded-full" aria-hidden="true" />

          <div className="relative grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-300/40 px-4 py-2 rounded-full mb-5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700 font-medium text-sm">Reels Experience</span>
              </div>

              <h2 className="font-heading text-3xl md:text-5xl font-bold text-stone-900 leading-tight mb-4">
                Explore Properties In
                <span className="block text-emerald-600">Short Video Format</span>
              </h2>

              <p className="text-stone-600 text-base md:text-lg mb-6 max-w-2xl">
                Swipe through property reels, shortlist favorites instantly, and discover listings faster with a mobile-first viewing experience.
              </p>

              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-3 text-stone-700">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <span>Vertical reel feed with smooth swipe browsing</span>
                </li>
                <li className="flex items-center gap-3 text-stone-700">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <span>One-tap like, save, and share actions</span>
                </li>
                <li className="flex items-center gap-3 text-stone-700">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <span>Owner walkthrough videos for better trust</span>
                </li>
              </ul>

              <Button
                type="button"
                onMouseEnter={prefetchReelsRoute}
                onFocus={prefetchReelsRoute}
                onClick={handleWatchReels}
                className="h-12 rounded-full px-7 text-base font-semibold bg-emerald-500 hover:bg-emerald-400 text-stone-950"
              >
                <Play className="w-5 h-5 mr-2" />
                Watch Reels
              </Button>
            </div>

            <div className="relative">
              <div className="mx-auto w-[230px] sm:w-[260px] rounded-[2.5rem] border border-white/20 bg-stone-900 p-2.5 shadow-[0_28px_60px_rgba(0,0,0,0.45)]">
                <div className="rounded-[2rem] overflow-hidden aspect-[9/16] relative bg-stone-800">
                  <img
                    src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400"
                    alt="Reels Preview"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                  <div className="absolute inset-0 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={handleWatchReels}
                      className="w-16 h-16 rounded-full bg-white/25 hover:bg-white/35 backdrop-blur-sm flex items-center justify-center transition-colors"
                      aria-label="Play Reels"
                    >
                      <Play className="w-8 h-8 text-white ml-1" />
                    </button>
                  </div>

                  <div className="absolute right-3 bottom-4 flex flex-col gap-3">
                    <div className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                      <Heart className="w-4 h-4 text-white" />
                    </div>
                    <div className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                      <MessageCircle className="w-4 h-4 text-white" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export const TrustSection = () => {
  const reduceMotion = useReducedMotion();
  const trustPoints = [
    {
      icon: Shield,
      title: 'Aadhar Verified',
      description: 'Owner identity verified',
    },
    {
      icon: Phone,
      title: 'Mobile Verified',
      description: 'OTP verification',
    },
    {
      icon: Award,
      title: 'Quality Listings',
      description: 'Admin approved only',
    },
    {
      icon: Globe,
      title: 'Pan Gujarat',
      description: 'All major cities covered',
    },
  ];

  return (
    <section className="section-padding bg-white" data-testid="trust-section">
      <div className="container-main">
        <motion.div
          {...revealUp(reduceMotion, 0.02, 24)}
          className="relative overflow-hidden rounded-3xl border border-stone-200 bg-gradient-to-br from-white via-stone-50 to-emerald-50/50 p-6 md:p-10 shadow-sm"
        >
          <motion.div
            initial={reduceMotion ? false : { opacity: 0.35, scale: 0.9 }}
            whileInView={{ opacity: 0.7, scale: 1 }}
            viewport={{ once: true }}
            transition={reduceMotion ? { duration: 0 } : { duration: 1.2, ease: 'easeOut' }}
            className="pointer-events-none absolute -top-24 -left-20 w-72 h-72 rounded-full bg-emerald-200/35 blur-3xl"
            aria-hidden="true"
          />
          <motion.div
            initial={reduceMotion ? false : { opacity: 0.25, scale: 0.9 }}
            whileInView={{ opacity: 0.55, scale: 1 }}
            viewport={{ once: true }}
            transition={reduceMotion ? { duration: 0 } : { duration: 1.2, delay: 0.15, ease: 'easeOut' }}
            className="pointer-events-none absolute -bottom-24 -right-20 w-80 h-80 rounded-full bg-cyan-200/25 blur-3xl"
            aria-hidden="true"
          />

          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
            <div className="relative z-10">
              <motion.span
                {...revealUp(reduceMotion, 0.03, 10)}
                className="inline-flex items-center gap-2 text-emerald-700 font-medium text-sm uppercase tracking-wider bg-emerald-500/10 border border-emerald-300/40 px-4 py-2 rounded-full"
              >
                <Shield className="w-4 h-4" />
                Why Trust Us
              </motion.span>

              <motion.h2
                {...revealUp(reduceMotion, 0.05, 14)}
                className="font-heading text-3xl md:text-5xl font-bold text-stone-900 mt-4 mb-5 leading-tight"
              >
                100% Verified
                <span className="block text-emerald-600">And Trusted Listings</span>
              </motion.h2>

              <motion.p
                {...revealUp(reduceMotion, 0.08, 14)}
                className="text-stone-600 text-base md:text-lg mb-8 max-w-2xl"
              >
                Every property owner on GRUVORA LIVING is verified with Aadhar and mobile checks, helping you connect only with genuine listings.
              </motion.p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {trustPoints.map((point, index) => {
                  const Icon = point.icon;

                  return (
                    <motion.div
                      key={point.title}
                      {...revealUp(reduceMotion, 0.12 + index * 0.06, 18)}
                      whileHover={reduceMotion ? undefined : { y: -4, scale: 1.01 }}
                      className="group flex items-start gap-3 p-4 rounded-2xl bg-white/95 border border-stone-200 shadow-[0_8px_22px_rgba(2,6,23,0.05)]"
                    >
                      <div className="w-11 h-11 bg-emerald-500/10 text-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-stone-900 mb-0.5">{point.title}</h4>
                        <p className="text-stone-600 text-sm">{point.description}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            <motion.div
              initial={reduceMotion ? false : { opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.5, delay: 0.12 }}
              className="relative z-10"
            >
              <motion.img
                src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600"
                alt="Happy Family"
                whileHover={reduceMotion ? undefined : { scale: 1.02 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.4, ease: 'easeOut' }}
                className="rounded-2xl shadow-xl border border-stone-200"
              />

              <motion.div
                {...revealUp(reduceMotion, 0.2, 12)}
                animate={reduceMotion ? undefined : { y: [0, -3, 0] }}
                className="absolute -bottom-5 -left-5 bg-white text-stone-900 rounded-xl p-3 shadow-lg border border-stone-200"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                    <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  </div>
                  <div>
                    <p className="font-bold text-2xl leading-none">4.8/5</p>
                    <p className="text-xs text-muted-foreground mt-1">Good Reviews</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export const CTASection = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const handleListPropertyClick = useCallback(() => {
    if (isAuthenticated) {
      navigate('/owner/dashboard?openCreate=1');
      return;
    }
    navigate('/owner/register');
  }, [isAuthenticated, navigate]);

  return (
    <section className="py-10 md:py-14 bg-stone-950 relative overflow-hidden" data-testid="cta-section">
      <motion.div
        animate={reduceMotion ? undefined : { y: [0, -8, 0], opacity: [0.12, 0.2, 0.12] }}
        transition={reduceMotion ? { duration: 0 } : { duration: 6, repeat: Infinity }}
        className="absolute -top-16 -left-16 w-72 h-72 bg-emerald-500/15 blur-3xl rounded-full"
        aria-hidden="true"
      />
      <motion.div
        animate={reduceMotion ? undefined : { y: [0, 10, 0], opacity: [0.08, 0.14, 0.08] }}
        transition={reduceMotion ? { duration: 0 } : { duration: 7, repeat: Infinity, delay: 0.2 }}
        className="absolute -bottom-24 -right-12 w-80 h-80 bg-cyan-500/10 blur-3xl rounded-full"
        aria-hidden="true"
      />

      <div className="container-main relative">
        <motion.div
          {...revealUp(reduceMotion, 0.04, 20)}
          className="max-w-4xl mx-auto rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] backdrop-blur-sm px-5 py-8 md:px-10 md:py-10 text-center"
        >
          <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
              <CheckCircle className="w-3.5 h-3.5" /> Verified Owners
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-stone-200 border border-white/20">
              <Users className="w-3.5 h-3.5" /> High Intent Buyers
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-stone-200 border border-white/20">
              <Shield className="w-3.5 h-3.5" /> Trusted Platform
            </span>
          </div>

          <h2 className="font-heading text-2xl md:text-4xl lg:text-5xl font-bold text-white leading-tight">
            Ready To Scale
            <span className="block bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">
              Your Property Business?
            </span>
          </h2>

          <p className="text-stone-300 text-sm md:text-lg mt-4 mb-7 max-w-2xl mx-auto leading-relaxed">
            Join thousands of verified owners, publish listings in minutes, and connect with serious buyers and renters across Gujarat.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              onClick={handleListPropertyClick}
              className="h-12 rounded-full px-7 text-sm md:text-base font-semibold bg-emerald-500 hover:bg-emerald-400 text-stone-950"
              data-testid="list-property-cta"
            >
              List Your Property Free
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button asChild variant="outline" className="h-12 rounded-full border-white/30 text-white hover:bg-white/10 text-sm md:text-base px-7" data-testid="cta-contact-link">
              <Link to="/about-us">
                Contact Us
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};