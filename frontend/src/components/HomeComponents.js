import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion, useInView } from 'framer-motion';
import { listingsAPI, categoriesAPI, recommendationsAPI, chatAPI } from '../lib/api';
import { prefetchDiscoverRoute, prefetchReelsRoute } from '../lib/routePrefetch';
import { markRouteNavigation } from '../lib/routeTelemetry';
import { useAuth } from '../context/AuthContext';
import { useInteractions } from '../context/InteractionContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import OptimizedImage from './OptimizedImage';
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
  Mic,
  MicOff,
  Compass,
  Sparkles,
  Zap,
  Phone,
  MessageCircle,
  Calendar,
  Video,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
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

const categoryThemes = {
  home: {
    gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
    glow: 'rgba(16,185,129,0.35)',
    accent: '#10b981',
    badge: 'bg-emerald-500/15 text-emerald-700 border-emerald-300/40',
    stat: 'text-emerald-600',
    orb: 'from-emerald-400/20 to-teal-400/10',
  },
  business: {
    gradient: 'from-blue-500 via-indigo-500 to-violet-500',
    glow: 'rgba(59,130,246,0.35)',
    accent: '#3b82f6',
    badge: 'bg-blue-500/15 text-blue-700 border-blue-300/40',
    stat: 'text-blue-600',
    orb: 'from-blue-400/20 to-indigo-400/10',
  },
  stay: {
    gradient: 'from-cyan-500 via-sky-500 to-blue-500',
    glow: 'rgba(6,182,212,0.35)',
    accent: '#06b6d4',
    badge: 'bg-cyan-500/15 text-cyan-700 border-cyan-300/40',
    stat: 'text-cyan-600',
    orb: 'from-cyan-400/20 to-sky-400/10',
  },
  event: {
    gradient: 'from-rose-500 via-pink-500 to-fuchsia-500',
    glow: 'rgba(244,63,94,0.35)',
    accent: '#f43f5e',
    badge: 'bg-rose-500/15 text-rose-700 border-rose-300/40',
    stat: 'text-rose-600',
    orb: 'from-rose-400/20 to-pink-400/10',
  },
  services: {
    gradient: 'from-orange-500 via-amber-500 to-yellow-500',
    glow: 'rgba(249,115,22,0.35)',
    accent: '#f97316',
    badge: 'bg-orange-500/15 text-orange-700 border-orange-300/40',
    stat: 'text-orange-600',
    orb: 'from-orange-400/20 to-amber-400/10',
  },
};

const defaultCategories = [
  {
    id: 'home',
    name: 'Home',
    name_gu: 'ઘર',
    description: '1-4 BHK · Villas · Penthouses · Farmhouses',
    sub_categories: [],
  },
  {
    id: 'business',
    name: 'Business',
    name_gu: 'બિઝનેસ',
    description: 'Shops · Offices · Warehouses · Co-working',
    sub_categories: [],
  },
  {
    id: 'stay',
    name: 'Stay',
    name_gu: 'રહેવાનું',
    description: 'Hotels · Guest Houses · Resorts · PG',
    sub_categories: [],
  },
  {
    id: 'event',
    name: 'Event',
    name_gu: 'ઇવેન્ટ',
    description: 'Party Plots · Marriage Halls · Banquets',
    sub_categories: [],
  },
  {
    id: 'services',
    name: 'Services',
    name_gu: 'સેવાઓ',
    description: 'Plumber · Electrician · Cleaning · Repair',
    sub_categories: [],
  },
];

const categoryBgColors = {
  home: 'bg-emerald-500',
  business: 'bg-blue-500',
  stay: 'bg-purple-500',
  event: 'bg-pink-500',
  services: 'bg-orange-500',
};

const PROPERTY_TRANSACTION_CATEGORIES = new Set(['home', 'business']);
const isPropertyTransactionCategory = (category) =>
  PROPERTY_TRANSACTION_CATEGORIES.has(String(category || '').trim().toLowerCase());

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

    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      const cleanedTranscript = transcript.trim();
      setSearchQuery(cleanedTranscript);

      try {
        const response = await chatAPI.voiceSearch(cleanedTranscript);
        const data = response?.data || {};
        const normalizedQuery = (data.normalized_query || cleanedTranscript).trim();
        const detectedCategory = data?.parsed?.category || category;
        const detectedCity = data?.parsed?.location || location;

        const params = new URLSearchParams();
        if (normalizedQuery) params.set('q', normalizedQuery);
        if (detectedCity) params.set('city', detectedCity);

        navigate(`/category/${detectedCategory}?${params.toString()}`);
      } catch (error) {
        console.error('Voice search normalization failed:', error);
        const params = new URLSearchParams();
        if (cleanedTranscript) params.set('q', cleanedTranscript);
        if (location) params.set('city', location);
        navigate(`/category/${category}?${params.toString()}`);
      }
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
    <section className="hero-container relative min-h-[90vh] flex items-center overflow-hidden bg-stone-950" data-testid="hero-section">
      {/* Animated Background */}
      <div className="absolute inset-0">
        <motion.div
          initial={reduceMotion ? false : { scale: 1.1 }}
          animate={reduceMotion ? { scale: 1 } : { scale: 1 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 10, ease: 'easeOut' }}
          className="absolute inset-0"
        />
        <img
          src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1920"
          alt=""
          aria-hidden="true"
          loading="eager"
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-stone-950/55" />
        <div className="absolute inset-0 bg-gradient-to-r from-stone-950/95 via-stone-950/78 to-stone-950/40" />
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
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/8 md:backdrop-blur-sm border border-white/15 mb-8"
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
              className="text-lg md:text-xl text-stone-200 mb-6 leading-relaxed max-w-3xl mx-auto"
            >
              Discover homes, business spaces, hotels, event venues, and professional services - all in one place.
            </motion.p>
            <motion.p
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={reduceMotion ? { duration: 0 } : { delay: 0.6 }}
              className="text-stone-300/80 mb-10"
            >
              {/* a��a��a�+a��a�� a�+a��a��a��a��a��a�� a��a��a��a��a�+ a��a��a��a�� - a��a��, a��a�+a��a��a��a�+, a��a��a��a��a�+a��a��a��, a��a��a��a��a��a�� a��a��a�� a�+a��a��a�+a�� */}
            </motion.p>

            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduceMotion ? { duration: 0 } : { delay: 0.66, duration: 0.4 }}
              className="flex flex-wrap items-center justify-center gap-2 mb-8"
            >
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-100 border border-emerald-400/35 md:backdrop-blur-sm">
                <Shield className="w-3.5 h-3.5" /> Verified Owners
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-stone-100 border border-white/25 md:backdrop-blur-sm">
                <CheckCircle className="w-3.5 h-3.5" /> Trusted Listings
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-stone-100 border border-white/25 md:backdrop-blur-sm">
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
                <div className="w-full pb-1">
                  <div className="flex w-full flex-nowrap justify-start sm:justify-center items-center gap-2 sm:gap-3 px-1 sm:px-2 py-1 overflow-x-auto hide-scrollbar">
                    {[
                      { id: 'home', label: 'Home' },
                      { id: 'business', label: 'Business' },
                      { id: 'stay', label: 'Stay' },
                      { id: 'event', label: 'Event' },
                      { id: 'services', label: 'Services' },
                    ].map((cat, index) => {
                      const isActive = category === cat.id;
                      return (
                        <motion.button
                          key={cat.id}
                          type="button"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.78 + index * 0.04, duration: 0.25 }}
                          onClick={() => setCategory(cat.id)}
                          className={`hero-pill min-w-fit ${isActive ? 'hero-pill-active' : ''}`}
                        >
                          <span>{cat.label}</span>
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

const CategoryCard = memo(({ cat, index, isActive, reduceMotion }) => {
  const Icon = categoryIcons[cat.id] || Home;
  const theme = categoryThemes[cat.id] || categoryThemes.home;
  const subCount = cat.sub_categories?.length || 0;

  const cardRef = useRef(null);
  const inView = useInView(cardRef, { once: true, margin: '-60px' });

  return (
    <motion.div
      ref={cardRef}
      initial={reduceMotion ? false : { opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={reduceMotion
        ? { duration: 0 }
        : {
          duration: 0.55,
          delay: index * 0.08,
          ease: [0.22, 1, 0.36, 1],
        }}
      className="group relative w-full"
    >
      <Link
        to={`/category/${cat.id}`}
        className="relative flex flex-col h-full overflow-hidden rounded-[1.75rem] transition-all duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        data-testid={`category-card-${cat.id}`}
        style={{
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: isActive
            ? `1.5px solid ${theme.accent}55`
            : '1.5px solid rgba(0,0,0,0.07)',
          boxShadow: isActive
            ? `0 8px 32px -6px ${theme.glow}, 0 0 0 3px ${theme.accent}22`
            : '0 4px 24px -4px rgba(0,0,0,0.08)',
        }}
      >
        <div
          className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${theme.gradient} transition-all duration-500 group-hover:h-[4px]`}
        />

        <div
          className={`pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-br ${theme.orb} blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700`}
        />

        <div
          className={`pointer-events-none absolute inset-0 rounded-[1.75rem] bg-gradient-to-br ${theme.gradient} opacity-0 group-hover:opacity-[0.92] transition-opacity duration-500`}
        />

        <div className="relative z-10 flex flex-col flex-1 p-6 md:p-7 text-center items-center">
          <div className="flex items-start justify-between mb-6 w-full">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${theme.badge} transition-all duration-400 group-hover:bg-white/20 group-hover:text-white/90 group-hover:border-white/30`}
            >
              <TrendingUp className="w-3 h-3" />
              {subCount > 0 ? `${subCount} types` : 'Top picks'}
            </span>

            {isActive && (
              <span className="inline-flex items-center gap-1 bg-white/90 text-stone-700 text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
                <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                Active
              </span>
            )}
          </div>

          <motion.div
            whileHover={!reduceMotion ? { scale: 1.12, rotate: 6 } : undefined}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className={`w-[60px] h-[60px] rounded-2xl bg-gradient-to-br ${theme.gradient} flex items-center justify-center mb-5 shadow-lg ring-2 ring-white/60 flex-shrink-0 mx-auto`}
            style={{ boxShadow: `0 8px 24px -4px ${theme.glow}` }}
          >
            <Icon className="w-7 h-7 text-white drop-shadow-sm" />
          </motion.div>

          <h3 className="font-heading font-bold text-[1.35rem] leading-tight text-stone-900 group-hover:text-white transition-colors duration-300 mb-0.5">
            {cat.name}
          </h3>
          <p className="text-[13px] font-semibold text-stone-400 group-hover:text-white/70 transition-colors duration-300 mb-3 font-accent italic">
            {cat.name_gu}
          </p>

          <p className="text-[13px] text-stone-500 group-hover:text-white/75 transition-colors duration-300 leading-relaxed line-clamp-2 flex-1 w-full">
            {cat.description || cat.sub_categories?.slice(0, 4).map((s) => s.name).join(' · ')}
          </p>

          <div className="mt-5 inline-flex items-center gap-1.5 text-stone-500 group-hover:text-white transition-colors duration-300">
            <span className="text-[13px] font-semibold">Explore</span>
            <div className="w-7 h-7 rounded-full border border-stone-200 group-hover:border-white/40 group-hover:bg-white/20 flex items-center justify-center transition-all duration-300">
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-300" />
            </div>
          </div>
        </div>

        <div
          className="pointer-events-none absolute inset-0 rounded-[1.75rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{ boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.25)' }}
        />
      </Link>
    </motion.div>
  );
});

const SectionHeader = memo(({ canScrollLeft, canScrollRight, onSlide, reduceMotion }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <motion.div
      ref={ref}
      initial={reduceMotion ? false : { opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="mb-8 md:mb-10"
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-300/40 text-emerald-700 text-[11px] font-bold uppercase tracking-[0.2em]">
            <Zap className="w-3.5 h-3.5" />
            Explore Categories
          </span>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200/60 text-amber-700 text-[11px] font-semibold">
            <Sparkles className="w-3 h-3" />
            5 categories
          </span>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          {[
            { dir: -1, can: canScrollLeft, label: 'Previous' },
            { dir: 1, can: canScrollRight, label: 'Next' },
          ].map(({ dir, can, label }) => (
            <button
              key={dir}
              onClick={() => onSlide(dir)}
              disabled={!can}
              aria-label={label}
              className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all active:scale-90 ${can
                ? 'bg-white border-stone-200 text-stone-700 shadow-sm hover:shadow-md hover:border-stone-300'
                : 'bg-stone-100 border-stone-100 text-stone-300 cursor-not-allowed'
                }`}
            >
              {dir === -1 ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="font-heading text-[2rem] sm:text-[2.5rem] md:text-[3rem] font-black text-stone-950 leading-[1.1] tracking-tight">
            Discover Your
            <span className="block bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500 bg-clip-text text-transparent">
              Perfect Space Faster
            </span>
          </h2>
          <p className="text-stone-500 mt-3 text-base md:text-[1.05rem] leading-relaxed">
            Premium categories with smarter discovery - from homes to on-demand services.
          </p>
        </div>

        <div className="hidden md:flex items-center gap-2 flex-shrink-0">
          {[
            { dir: -1, can: canScrollLeft, label: 'Previous' },
            { dir: 1, can: canScrollRight, label: 'Next' },
          ].map(({ dir, can, label }) => (
            <button
              key={dir}
              onClick={() => onSlide(dir)}
              disabled={!can}
              aria-label={label}
              className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all duration-200 active:scale-90 ${can
                ? 'bg-white border-stone-200 text-stone-700 shadow-sm hover:shadow-md hover:border-stone-300'
                : 'bg-stone-100 border-stone-100 text-stone-300 cursor-not-allowed'
                }`}
            >
              {dir === -1 ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
});

const DotIndicators = ({ categories, activeCategoryId, railRef }) => (
  <div className="flex justify-center gap-2 mt-6 md:hidden" aria-hidden="true">
    {categories.map((cat, i) => {
      const theme = categoryThemes[cat.id] || categoryThemes.home;
      const isActive = activeCategoryId === cat.id;

      return (
        <button
          key={cat.id}
          onClick={() => {
            const cardWidth = window.innerWidth * 0.82 + 16;
            railRef.current?.scrollTo({ left: i * cardWidth, behavior: 'smooth' });
          }}
          aria-label={`Go to ${cat.name}`}
          className="transition-all duration-300"
          style={{
            width: isActive ? 24 : 6,
            height: 6,
            borderRadius: 999,
            background: isActive ? theme.accent : '#d4d4d4',
          }}
        />
      );
    })}
  </div>
);

export const CategoriesSection = () => {
  const reduceMotion = useReducedMotion();
  const location = useLocation();
  const [categories, setCategories] = useState([]);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const railRef = useRef(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await categoriesAPI.getAll();
        setCategories(response.data.categories || []);
      } catch {
        // Keep default category set.
      }
    };

    fetchCategories();
  }, []);

  const syncScrollState = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    syncScrollState();
    el.addEventListener('scroll', syncScrollState, { passive: true });
    const ro = new ResizeObserver(syncScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', syncScrollState);
      ro.disconnect();
    };
  }, [syncScrollState]);

  const slide = useCallback((dir) => {
    railRef.current?.scrollBy({ left: dir * 340, behavior: 'smooth' });
  }, []);

  const displayCategories = categories.length > 0 ? categories : defaultCategories;

  const activeCategoryId = location.pathname.startsWith('/category/')
    ? location.pathname.split('/')[2] || ''
    : '';

  return (
    <section
      className="section-padding relative overflow-hidden"
      data-testid="categories-section"
      style={{ background: 'linear-gradient(180deg,#f8faf9 0%,#ffffff 50%,#f8faf9 100%)' }}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <motion.div
          animate={reduceMotion ? { opacity: 0.18 } : { y: [0, -20, 0], opacity: [0.18, 0.28, 0.18] }}
          transition={reduceMotion ? { duration: 0 } : { duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-32 right-0 md:right-16 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle,rgba(16,185,129,0.15) 0%,transparent 70%)' }}
        />
        <motion.div
          animate={reduceMotion ? { opacity: 0.14 } : { y: [0, 18, 0], opacity: [0.14, 0.22, 0.14] }}
          transition={reduceMotion ? { duration: 0 } : { duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute -bottom-32 -left-16 w-[420px] h-[420px] rounded-full"
          style={{ background: 'radial-gradient(circle,rgba(249,115,22,0.12) 0%,transparent 70%)' }}
        />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg,#000 0,#000 1px,transparent 1px,transparent 40px),repeating-linear-gradient(90deg,#000 0,#000 1px,transparent 1px,transparent 40px)',
          }}
        />
      </div>

      <div className="container-main relative z-10">
        <SectionHeader
          canScrollLeft={canScrollLeft}
          canScrollRight={canScrollRight}
          onSlide={slide}
          reduceMotion={reduceMotion}
        />

        <div
          ref={railRef}
          className={[
            'grid grid-flow-col auto-cols-[82vw] sm:auto-cols-[62vw] gap-4 overflow-x-auto overflow-y-hidden pb-2 px-1',
            'md:grid md:grid-cols-5 md:auto-cols-auto md:gap-5 md:overflow-visible',
            'hide-scrollbar',
          ].join(' ')}
          style={{ WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory' }}
        >
          {displayCategories.map((cat, index) => (
            <div key={cat.id} className="snap-start min-w-0" style={{ scrollSnapAlign: 'start' }}>
              <CategoryCard
                cat={cat}
                index={index}
                isActive={activeCategoryId === cat.id}
                reduceMotion={reduceMotion}
              />
            </div>
          ))}
        </div>

        <DotIndicators
          categories={displayCategories}
          activeCategoryId={activeCategoryId}
          railRef={railRef}
        />
      </div>
    </section>
  );
};

export const TrendingSection = () => {
  const reduceMotion = useReducedMotion();
  const [listings, setListings] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);

  const fetchTrending = useCallback(async () => {
    try {
      const response = await listingsAPI.getTrending(8, activeCategory);
      setListings(response.data.listings);
    } catch (error) {
      console.error('Failed to fetch trending:', error);
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
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeCategory === tab.id
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
              <PropertyCard listing={listing} contextCategory={activeCategory} />
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

export const PropertyCard = memo(({ listing, showActions = true, contextCategory = null }) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { isWishlisted, toggleWishlist, pendingWishlistMap } = useInteractions();
  const Icon = categoryIcons[listing.category] || Home;
  const bgColor = categoryBgColors[listing.category] || 'bg-primary';
  const effectiveCategory = contextCategory || listing.category;
  const showTransactionType =
    isPropertyTransactionCategory(effectiveCategory) &&
    isPropertyTransactionCategory(listing.category);
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

  const handleDiscoverClick = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    prefetchDiscoverRoute();
    markRouteNavigation('/discover', 'home-property-discover-btn');
    const params = new URLSearchParams();
    params.set('listingId', listing.id);
    if (listing.city) params.set('city', listing.city);
    if (listing.category) params.set('category', listing.category);
    navigate(`/discover?${params.toString()}`);
  }, [listing.id, listing.city, listing.category, navigate]);

  const formatPrice = (price, type) => {
    if (price >= 10000000) {
      return `G�${(price / 10000000).toFixed(2)} Cr`;
    } else if (price >= 100000) {
      return `G�${(price / 100000).toFixed(2)} L`;
    }
    const monthlySuffix = showTransactionType && type === 'rent' ? '/mo' : '';
    return `G�${price?.toLocaleString('en-IN')}${monthlySuffix}`;
  };

  return (
    <Link
      to={`/listing/${listing.id}`}
      className="group relative overflow-hidden rounded-2xl bg-white border border-stone-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
      data-testid={`property-card-${listing.id}`}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <OptimizedImage
          publicId={listing.images?.[0] || 'gharshetu/placeholders/listing-default'}
          alt={listing.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
          width={640}
          sizes="(max-width: 1024px) 100vw, 33vw"
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
        {showTransactionType && (
          <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm px-3 py-1 rounded-full">
            <span className="text-xs font-semibold text-stone-700 capitalize">
              {listing.listing_type === 'rent' ? 'For Rent' : 'For Sale'}
            </span>
          </div>
        )}

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
            title="Open Discover"
            aria-label="Open Discover"
            onMouseEnter={prefetchDiscoverRoute}
            onFocus={prefetchDiscoverRoute}
            onClick={handleDiscoverClick}
            className="w-9 h-9 bg-white/95 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white hover:-translate-y-0.5 shadow-sm transition-all"
          >
            <Compass className="w-4 h-4 text-stone-600" />
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
      icon: Compass,
      title: 'Discover Search',
      description: 'Find properties with city and category filters',
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
    <section className="section-padding relative overflow-hidden bg-gradient-to-b from-stone-50 via-white to-stone-50" data-testid="features-section">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-20 left-0 h-72 w-72 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="absolute top-24 right-0 h-80 w-80 rounded-full bg-cyan-200/20 blur-3xl" />
      </div>

      <div className="container-main relative">
        <motion.div {...revealUp(reduceMotion, 0.02)} className="mx-auto max-w-3xl text-center mb-8 md:mb-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3.5 py-1.5 text-emerald-700 font-semibold text-[11px] md:text-xs uppercase tracking-[0.24em] shadow-sm">
            <Sparkles className="w-4 h-4" />
            Platform Features
          </span>
          <h2 className="font-heading text-2xl md:text-4xl font-bold text-stone-950 mt-3 leading-tight">
            Why choose GRUVORA LIVING?
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 md:gap-4">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                {...revealUp(reduceMotion, 0.04 + index * 0.05, 18)}
                whileHover={reduceMotion ? undefined : { y: -6, scale: 1.01 }}
                className="group relative overflow-hidden rounded-[1.6rem] border border-stone-200 bg-white p-5 md:p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)] transition-all duration-300 hover:shadow-[0_24px_60px_rgba(15,23,42,0.1)]"
              >
                <div className="relative flex items-start justify-between gap-3">
                  <div className={`w-12 h-12 ${feature.color} rounded-2xl flex items-center justify-center shadow-lg shadow-black/5 group-hover:scale-105 transition-transform`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
                    0{index + 1}
                  </span>
                </div>

                <div className="relative mt-4">
                  <h3 className="font-heading font-semibold text-lg md:text-xl text-stone-950 mb-2.5 leading-tight">
                    {feature.title}
                  </h3>
                  <p className="text-stone-600 leading-relaxed text-sm md:text-[14px]">
                    {feature.description}
                  </p>
                </div>
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
                    className="w-full h-full object-cover"
                    loading="lazy"
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
              <motion.div
                whileHover={reduceMotion ? undefined : { scale: 1.02 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.4, ease: 'easeOut' }}
                className="rounded-2xl shadow-xl border border-stone-200 overflow-hidden"
              >
                <img
                  src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600"
                  alt="Happy Family"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </motion.div>

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
          className="max-w-4xl mx-auto rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.1] to-white/[0.03] backdrop-blur-md px-5 py-8 md:px-10 md:py-10 text-center shadow-[0_20px_60px_rgba(2,6,23,0.18)]"
        >
          <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
              <CheckCircle className="w-3.5 h-3.5" /> Verified Owners
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/8 text-stone-100 border border-white/15">
              <Users className="w-3.5 h-3.5" /> High Intent Buyers
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/8 text-stone-100 border border-white/15">
              <Shield className="w-3.5 h-3.5" /> Trusted Platform
            </span>
          </div>

          <h2 className="font-heading text-2xl md:text-4xl lg:text-5xl font-bold text-white leading-tight">
            Ready To Scale
            <span className="block bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">
              Your Property Business?
            </span>
          </h2>

          <p className="text-stone-200 text-sm md:text-lg mt-4 mb-7 max-w-2xl mx-auto leading-relaxed">
            Join thousands of verified owners, publish listings in minutes, and connect with serious buyers and renters across Gujarat.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              onClick={handleListPropertyClick}
              className="h-12 rounded-full px-7 text-sm md:text-base font-semibold bg-emerald-500 hover:bg-emerald-400 text-stone-950 shadow-[0_12px_28px_rgba(16,185,129,0.18)]"
              data-testid="list-property-cta"
            >
              List Your Property Free
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button asChild variant="outline" className="h-12 rounded-full border-white/25 text-white hover:bg-white/10 text-sm md:text-base px-7 backdrop-blur-sm" data-testid="cta-contact-link">
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
