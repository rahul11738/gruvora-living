import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { listingsAPI, categoriesAPI, recommendationsAPI } from '../lib/api';
import { prefetchMapRoute, prefetchReelsRoute } from '../lib/routePrefetch';
import { markRouteNavigation } from '../lib/routeTelemetry';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { VoiceSearchButton } from './VoiceSearch';
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

export const HeroSection = () => {
  const navigate = useNavigate();
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
    if (!voiceSupported) return;
    
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
    <section className="relative min-h-[90vh] flex items-center overflow-hidden" data-testid="hero-section">
      {/* Animated Background */}
      <div className="absolute inset-0">
        <motion.div
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 10, ease: "easeOut" }}
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: 'url(https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1920)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-stone-900/95 via-stone-900/80 to-stone-900/40" />
        {/* Floating Elements */}
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.3, 0.2]
          }}
          transition={{ duration: 4, repeat: Infinity }}
          className="absolute top-20 right-20 w-72 h-72 bg-primary/20 rounded-full blur-3xl" 
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.4, 0.2]
          }}
          transition={{ duration: 5, repeat: Infinity, delay: 1 }}
          className="absolute bottom-20 left-20 w-96 h-96 bg-secondary/20 rounded-full blur-3xl" 
        />
      </div>

      <div className="container-main relative z-10 py-16 pt-16 md:pt-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-8"
            >
              <Sparkles className="w-4 h-4 text-secondary" />
              <span className="text-white/90 text-sm font-medium">Gujarat's #1 Property Platform</span>
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="font-heading text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-tight mb-8"
            >
              Find Your
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="block bg-gradient-to-r from-secondary to-orange-400 bg-clip-text text-transparent"
              >
                Perfect Space
              </motion.span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-lg md:text-xl text-stone-300 mb-6 leading-relaxed max-w-xl"
            >
              Discover homes, business spaces, hotels, event venues, and professional services - all in one place.
            </motion.p>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-stone-400 mb-10"
            >
              {/* તમારી સંપૂર્ણ જગ્યા શોધો - ઘર, બિઝનેસ, રહેવાનું, ઇવેન્ટ અને સેવાઓ */}
            </motion.p>

            {/* Search Form with Category Filter */}
            <motion.form 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              onSubmit={handleSearch} 
              className="bg-white rounded-2xl p-3 md:p-4 shadow-2xl max-w-5xl"
            >
              <div className="flex flex-col xl:flex-row xl:items-center gap-3">
                <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1 xl:pb-0">
                {[
                  { id: 'home', label: 'Home', labelGu: 'ઘર', icon: Home },
                  { id: 'business', label: 'Business', labelGu: 'બિઝનેસ', icon: Building2 },
                  { id: 'stay', label: 'Stay', labelGu: 'રહેવાનું', icon: Hotel },
                  { id: 'event', label: 'Event', labelGu: 'ઇવેન્ટ', icon: PartyPopper },
                  { id: 'services', label: 'Services', labelGu: 'સેવાઓ', icon: Wrench },
                ].map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                        category === cat.id
                          ? 'bg-primary text-white shadow-md shadow-primary/30'
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="hidden md:inline">{cat.label}</span>
                      <span className="md:hidden">{cat.labelGu}</span>
                    </button>
                  );
                })}
                </div>

                <div className="flex-1 min-w-[240px] relative">
                  <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 w-4 md:w-5 h-4 md:h-5 text-stone-400" />
                  <Input
                    type="text"
                    placeholder="Search properties, office spaces, hotels..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 md:pl-12 pr-12 h-12 md:h-14 border-0 bg-stone-50 rounded-xl text-sm md:text-base"
                    data-testid="hero-search-input"
                  />
                  <VoiceSearchButton className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2" />
                </div>

                <div className="w-full xl:w-[210px] relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                  <select
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full pl-10 pr-8 h-12 md:h-14 border-0 bg-stone-50 rounded-xl text-sm md:text-base text-stone-700"
                    data-testid="hero-location-input"
                  >
                    <option value="">All Cities</option>
                    {gujaratCities.map((city) => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>
                <Button type="submit" className="btn-primary h-12 md:h-14 px-6 md:px-8 text-sm md:text-base" data-testid="hero-search-btn">
                  <Search className="w-4 md:w-5 h-4 md:h-5 mr-2" />
                  Search
                </Button>
              </div>
            </motion.form>

            {/* Quick Stats */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="flex flex-wrap items-center gap-6 mt-10 text-white"
            >
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="flex items-center gap-3"
              >
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                  <Home className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold">10K+</p>
                  <p className="text-stone-400 text-sm">Properties</p>
                </div>
              </motion.div>
              <div className="w-px h-12 bg-white/20 hidden md:block" />
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="flex items-center gap-3"
              >
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold">5K+</p>
                  <p className="text-stone-400 text-sm">Verified Owners</p>
                </div>
              </motion.div>
              <div className="w-px h-12 bg-white/20 hidden md:block" />
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="flex items-center gap-3"
              >
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                  <Star className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold">4.8</p>
                  <p className="text-stone-400 text-sm">User Rating</p>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* Hero Cards */}
          <div className="hidden lg:block relative h-[480px]">
            <motion.div 
              initial={{ opacity: 0, x: 50, rotate: 6 }}
              animate={{ opacity: 1, x: 0, rotate: 3 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              whileHover={{ rotate: 0, scale: 1.02 }}
              className="absolute top-0 right-0 w-80 bg-white rounded-2xl shadow-2xl p-6 cursor-pointer"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden">
                  <img src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=200" alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                </div>
                <div>
                  <h4 className="font-semibold">3 BHK Luxury Flat</h4>
                  <p className="text-sm text-muted-foreground">Vesu, Surat</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="font-bold text-xl text-primary">₹45,000/mo</p>
                <Badge className="bg-green-100 text-green-700">Available</Badge>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: -30, rotate: -6 }}
              animate={{ opacity: 1, x: 0, rotate: -3 }}
              transition={{ delay: 0.7, duration: 0.6 }}
              whileHover={{ rotate: 0, scale: 1.02 }}
              className="absolute top-44 left-0 w-72 bg-white rounded-2xl shadow-2xl p-4 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center">
                  <Play className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">GharSetu Reels</h4>
                  <p className="text-xs text-muted-foreground">Watch property videos</p>
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 0.6 }}
              whileHover={{ scale: 1.05 }}
              className="absolute bottom-0 right-4 w-64 bg-primary rounded-2xl shadow-2xl p-4 text-white cursor-pointer"
            >
              <div className="flex items-center gap-3 mb-3">
                <Shield className="w-8 h-8" />
                <span className="font-semibold">Verified Owners</span>
              </div>
              <p className="text-sm text-emerald-100">100% Aadhar verified property owners</p>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export const CategoriesSection = () => {
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
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
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
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
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
                      whileHover={{ scale: 1.1, rotate: 5 }}
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

  const sampleListings = [
    {
      id: '1',
      title: '3 BHK Luxury Apartment',
      category: 'home',
      sub_category: '3bhk',
      price: 45000,
      listing_type: 'rent',
      location: 'Vesu, Surat',
      city: 'Surat',
      images: ['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400'],
      views: 1250,
      likes: 89,
      owner_verified: true,
    },
    {
      id: '2',
      title: 'Premium Office Space',
      category: 'business',
      sub_category: 'office',
      price: 35000,
      listing_type: 'rent',
      location: 'Dumas Road',
      city: 'Surat',
      images: ['https://images.unsplash.com/photo-1497366216548-37526070297c?w=400'],
      views: 980,
      likes: 65,
      owner_verified: true,
    },
    {
      id: '3',
      title: 'Grand Banquet Hall',
      category: 'event',
      sub_category: 'banquethall',
      price: 150000,
      listing_type: 'rent',
      location: 'Adajan',
      city: 'Surat',
      images: ['https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=400'],
      views: 2100,
      likes: 156,
      owner_verified: true,
    },
    {
      id: '4',
      title: 'Boutique Hotel',
      category: 'stay',
      sub_category: 'hotel',
      price: 2500,
      listing_type: 'rent',
      location: 'Athwa',
      city: 'Surat',
      images: ['https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400'],
      views: 750,
      likes: 42,
      owner_verified: false,
    },
  ];

  const displayListings = listings.length > 0 ? listings : sampleListings;

  const categoryTabs = [
    { id: null, label: 'All' },
    { id: 'home', label: 'Home' },
    { id: 'business', label: 'Business' },
    { id: 'stay', label: 'Stay' },
    { id: 'event', label: 'Event' },
  ];

  return (
    <section className="section-padding bg-gradient-to-b from-stone-50 to-white" data-testid="trending-section">
      <div className="container-main">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {displayListings.slice(0, 4).map((listing) => (
            <PropertyCard key={listing.id} listing={listing} />
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link to="/search">
            <Button variant="outline" className="btn-outline text-base px-8 py-6">
              View All Properties
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
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
  const Icon = categoryIcons[listing.category] || Home;
  const bgColor = categoryBgColors[listing.category] || 'bg-primary';

  const handleVideoClick = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    prefetchReelsRoute();
    markRouteNavigation('/reels', 'home-property-video-btn');
    navigate(`/reels?listingId=${encodeURIComponent(listing.id)}`);
  }, [listing.id, navigate]);

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
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <Heart className="w-5 h-5 text-stone-600 group-hover/btn:text-red-500 transition-colors" />
          </button>
        )}

        {/* Quick Actions */}
        <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            title="Watch Video"
            aria-label="Watch Video"
            onMouseEnter={prefetchReelsRoute}
            onFocus={prefetchReelsRoute}
            onClick={handleVideoClick}
            className="w-9 h-9 bg-white/95 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white hover:-translate-y-0.5 shadow-sm transition-all"
          >
            <Video className="w-4 h-4 text-stone-600" />
          </button>
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
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-2 text-secondary font-medium text-sm uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            Platform Features
          </span>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-stone-900 mt-3">
            Why Choose GharSetu?
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="group p-8 rounded-2xl bg-stone-50 hover:bg-white hover:shadow-xl transition-all duration-300"
              >
                <div className={`w-14 h-14 ${feature.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="font-heading font-semibold text-xl text-stone-900 mb-3">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export const ReelsPromoSection = () => {
  return (
    <section className="section-padding bg-gradient-to-br from-secondary/10 via-orange-50 to-pink-50" data-testid="reels-promo">
      <div className="container-main">
        <div className="flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 bg-secondary/20 px-4 py-2 rounded-full mb-6">
              <Play className="w-4 h-4 text-secondary" />
              <span className="text-secondary font-medium text-sm">New Feature</span>
            </div>
            <h2 className="font-heading text-3xl md:text-5xl font-bold text-stone-900 mb-6">
              GharSetu Reels
            </h2>
            <p className="text-lg text-muted-foreground mb-4">
              Watch property videos like Instagram! Scroll through listings, like your favorites, and save for later.
            </p>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-3 text-muted-foreground">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span>Vertical video feed - scroll to explore</span>
              </li>
              <li className="flex items-center gap-3 text-muted-foreground">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span>Like, save, and share property videos</span>
              </li>
              <li className="flex items-center gap-3 text-muted-foreground">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span>Owners can upload property walkthroughs</span>
              </li>
            </ul>
            <Link
              to="/reels"
              onMouseEnter={prefetchReelsRoute}
              onFocus={prefetchReelsRoute}
              onClick={() => markRouteNavigation('/reels', 'home-reels-promo-cta')}
            >
              <Button className="btn-secondary text-lg px-8 py-6">
                <Play className="w-5 h-5 mr-2" />
                Watch Reels
              </Button>
            </Link>
          </div>

          <div className="flex-1 relative">
            <div className="relative max-w-xs mx-auto">
              {/* Phone Frame */}
              <div className="bg-stone-900 rounded-[3rem] p-3 shadow-2xl">
                <div className="bg-stone-800 rounded-[2.5rem] overflow-hidden aspect-[9/16] relative">
                  <img
                    src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400"
                    alt="Reels Preview"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center">
                      <Play className="w-8 h-8 text-white ml-1" />
                    </div>
                  </div>
                  {/* UI Elements */}
                  <div className="absolute right-4 bottom-20 flex flex-col gap-4">
                    <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                      <Heart className="w-5 h-5 text-white" />
                    </div>
                    <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                      <MessageCircle className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </div>
              </div>
              {/* Floating Stats */}
              <div className="absolute -left-16 top-20 bg-white rounded-xl p-3 shadow-xl">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                    <Heart className="w-4 h-4 text-white fill-white" />
                  </div>
                  <span className="font-bold">2.5K</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export const TrustSection = () => {
  return (
    <section className="section-padding bg-primary text-white" data-testid="trust-section">
      <div className="container-main">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-emerald-300 font-medium text-sm uppercase tracking-wider">Why Trust Us</span>
            <h2 className="font-heading text-3xl md:text-4xl font-bold mt-2 mb-6">
              100% Verified & Trusted
            </h2>
            <p className="text-emerald-100 text-lg mb-8">
              Every property owner on GharSetu is verified with Aadhar card and mobile number, ensuring you connect with genuine listings only.
            </p>

            <div className="grid grid-cols-2 gap-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Aadhar Verified</h4>
                  <p className="text-emerald-200 text-sm">Owner identity verified</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Phone className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Mobile Verified</h4>
                  <p className="text-emerald-200 text-sm">OTP verification</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Quality Listings</h4>
                  <p className="text-emerald-200 text-sm">Admin approved only</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Globe className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Pan Gujarat</h4>
                  <p className="text-emerald-200 text-sm">All major cities covered</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative">
            <img
              src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600"
              alt="Happy Family"
              className="rounded-2xl shadow-2xl"
            />
            <div className="absolute -bottom-6 -left-6 bg-white text-stone-900 rounded-xl p-4 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                  <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                </div>
                <div>
                  <p className="font-bold text-2xl">4.8/5</p>
                  <p className="text-sm text-muted-foreground">50K+ Reviews</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export const CTASection = () => {
  return (
    <section className="section-padding bg-stone-900" data-testid="cta-section">
      <div className="container-main text-center">
        <h2 className="font-heading text-3xl md:text-5xl font-bold text-white mb-6">
          Ready to List Your Property?
        </h2>
        <p className="text-stone-400 text-lg mb-8 max-w-2xl mx-auto">
          Join thousands of verified property owners and reach millions of potential buyers and renters across Gujarat.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/register">
            <Button className="btn-primary text-lg px-10 py-6">
              List Your Property Free
            </Button>
          </Link>
          <Link to="/contact">
            <Button variant="outline" className="border-white text-white hover:bg-white/10 text-lg px-10 py-6 rounded-full">
              Contact Us
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};