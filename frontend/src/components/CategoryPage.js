import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { listingsAPI, categoriesAPI } from '../lib/api';
import { prefetchDiscoverRoute, prefetchReelsRoute } from '../lib/routePrefetch';
import { markRouteNavigation } from '../lib/routeTelemetry';
import { executeListingSearch, fetchListingSuggestions } from '../lib/smartSearch';
import SmartSearchInput from './SmartSearchInput';
import { useAuth } from '../context/AuthContext';
import { useInteractions } from '../context/InteractionContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Slider } from './ui/slider';
import { toast } from 'sonner';
import {
  MapPin,
  Heart,
  Eye,
  Filter,
  Grid,
  List,
  Home,
  Building2,
  Hotel,
  PartyPopper,
  Wrench,
  X,
  SlidersHorizontal,
  ChevronDown,
  Video,
  Compass,
} from 'lucide-react';
import { Header, Footer } from './Layout';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';

const categoryIcons = {
  home: Home,
  business: Building2,
  stay: Hotel,
  event: PartyPopper,
  services: Wrench,
};

const categoryColors = {
  home: 'bg-sky-500',
  business: 'bg-indigo-500',
  stay: 'bg-violet-500',
  event: 'bg-rose-500',
  services: 'bg-amber-500',
};

const categoryThemes = {
  home: {
    banner: 'bg-gradient-to-br from-sky-50 via-white to-slate-50',
    panel: 'border-sky-100/80 bg-gradient-to-br from-white via-sky-50/45 to-white',
    icon: 'bg-gradient-to-br from-sky-100 to-white ring-sky-200',
    chip: 'border-sky-200/70 bg-sky-50/70',
    blobOne: 'bg-sky-200/55',
    blobTwo: 'bg-indigo-200/35',
  },
  business: {
    banner: 'bg-gradient-to-br from-indigo-50 via-white to-slate-50',
    panel: 'border-indigo-100/80 bg-gradient-to-br from-white via-indigo-50/45 to-white',
    icon: 'bg-gradient-to-br from-indigo-100 to-white ring-indigo-200',
    chip: 'border-indigo-200/70 bg-indigo-50/70',
    blobOne: 'bg-indigo-200/50',
    blobTwo: 'bg-sky-200/30',
  },
  stay: {
    banner: 'bg-gradient-to-br from-violet-50 via-white to-slate-50',
    panel: 'border-violet-100/80 bg-gradient-to-br from-white via-violet-50/45 to-white',
    icon: 'bg-gradient-to-br from-violet-100 to-white ring-violet-200',
    chip: 'border-violet-200/70 bg-violet-50/70',
    blobOne: 'bg-violet-200/55',
    blobTwo: 'bg-fuchsia-200/30',
  },
  event: {
    banner: 'bg-gradient-to-br from-rose-50 via-white to-slate-50',
    panel: 'border-rose-100/80 bg-gradient-to-br from-white via-rose-50/45 to-white',
    icon: 'bg-gradient-to-br from-rose-100 to-white ring-rose-200',
    chip: 'border-rose-200/70 bg-rose-50/70',
    blobOne: 'bg-rose-200/55',
    blobTwo: 'bg-orange-200/30',
  },
  services: {
    banner: 'bg-gradient-to-br from-amber-50 via-white to-slate-50',
    panel: 'border-amber-100/80 bg-gradient-to-br from-white via-amber-50/45 to-white',
    icon: 'bg-gradient-to-br from-amber-100 to-white ring-amber-200',
    chip: 'border-amber-200/70 bg-amber-50/70',
    blobOne: 'bg-amber-200/55',
    blobTwo: 'bg-yellow-200/30',
  },
  default: {
    banner: 'bg-gradient-to-br from-slate-50 via-white to-stone-50',
    panel: 'border-slate-200/80 bg-gradient-to-br from-white via-slate-50/45 to-white',
    icon: 'bg-gradient-to-br from-slate-100 to-white ring-slate-200',
    chip: 'border-slate-200/70 bg-slate-50/70',
    blobOne: 'bg-slate-200/45',
    blobTwo: 'bg-sky-200/25',
  },
};

const categoryTitles = {
  home: { en: 'Home', gu: 'ઘર' },
  business: { en: 'Business', gu: 'બિઝનેસ' },
  stay: { en: 'Stay', gu: 'રહેવાનું' },
  event: { en: 'Event', gu: 'ઇવેન્ટ' },
  services: { en: 'Services', gu: 'સેવાઓ' },
};

const categoryDescriptions = {
  home: 'Explore premium residential spaces tailored for modern living.',
  business: 'Discover high-visibility commercial spaces to grow your brand.',
  stay: 'Find comfortable hospitality options for short and long stays.',
  event: 'Book curated venues designed for memorable celebrations and gatherings.',
  services: 'Connect with trusted professionals for home and business needs.',
};

const PROPERTY_TRANSACTION_CATEGORIES = new Set(['home', 'business']);
const isPropertyTransactionCategory = (category) =>
  PROPERTY_TRANSACTION_CATEGORIES.has(String(category || '').trim().toLowerCase());

export const CategoryPage = () => {
  const { category } = useParams();
  const showListingTypeControls = isPropertyTransactionCategory(category);
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const { isWishlisted, toggleWishlist, pendingWishlistMap } = useInteractions();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [categories, setCategories] = useState([]);
  const [viewMode, setViewMode] = useState('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [didYouMean, setDidYouMean] = useState('');

  const [filters, setFilters] = useState({
    sub_category: searchParams.get('sub_category') || '',
    listing_type: showListingTypeControls ? searchParams.get('type') || '' : '',
    city: searchParams.get('city') || '',
    min_price: searchParams.get('min_price') || '',
    max_price: searchParams.get('max_price') || '',
    search: searchParams.get('q') || '',
    sort_by: searchParams.get('sort') || 'created_at',
    page: parseInt(searchParams.get('page')) || 1,
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

  useEffect(() => {
    const query = (filters.search || '').trim();
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const next = await fetchListingSuggestions({
          query,
          city: filters.city || undefined,
          category: category || undefined,
          limit: 6,
        });
        setSuggestions(next);
      } catch {
        setSuggestions([]);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [filters.search, filters.city, category]);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const searchResult = await executeListingSearch({
        query: filters.search,
        city: filters.city || undefined,
        category: category || undefined,
        limit: filters.search ? 50 : 12,
        fallbackParams: {
          category: category,
          page: filters.page,
          sub_category: filters.sub_category || undefined,
          listing_type: showListingTypeControls ? filters.listing_type || undefined : undefined,
          city: filters.city || undefined,
          min_price: filters.min_price ? parseFloat(filters.min_price) : undefined,
          max_price: filters.max_price ? parseFloat(filters.max_price) : undefined,
          sort_by: filters.sort_by || undefined,
        },
      });

      if (searchResult.mode === 'smart') {
        let smartResults = searchResult.listings;

        // Keep existing local filters working on top of smart search output.
        if (filters.sub_category) {
          const sub = filters.sub_category.toLowerCase();
          smartResults = smartResults.filter((l) => String(l.sub_category || '').toLowerCase() === sub);
        }
        if (showListingTypeControls && filters.listing_type) {
          const type = filters.listing_type.toLowerCase();
          smartResults = smartResults.filter((l) => String(l.listing_type || '').toLowerCase() === type);
        }
        if (filters.min_price) {
          const min = parseFloat(filters.min_price);
          smartResults = smartResults.filter((l) => Number(l.price || 0) >= min);
        }
        if (filters.max_price) {
          const max = parseFloat(filters.max_price);
          smartResults = smartResults.filter((l) => Number(l.price || 0) <= max);
        }

        setDidYouMean(searchResult.didYouMean || '');
        setListings(smartResults);
        setTotalPages(1);
      } else {
        setDidYouMean('');
        setListings(searchResult.listings);
        setTotalPages(searchResult.pages);
      }
    } catch (error) {
      console.error('Failed to fetch listings:', error);
      toast.error('Failed to load listings');
    } finally {
      setLoading(false);
    }
  }, [category, filters, showListingTypeControls]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const handleFilterChange = (key, value) => {
    if (key === 'listing_type' && !showListingTypeControls) {
      return;
    }

    const newFilters = {
      ...filters,
      [key]: value,
      page: key === 'page' ? value : 1,
    };
    setFilters(newFilters);

    const params = new URLSearchParams();
    Object.entries(newFilters).forEach(([k, v]) => {
      if (k === 'listing_type' && !showListingTypeControls) return;
      if (v) params.set(k, v);
    });
    setSearchParams(params);
  };

  const clearFilters = () => {
    setFilters({
      sub_category: '',
      listing_type: '',
      city: '',
      min_price: '',
      max_price: '',
      search: '',
      sort_by: 'created_at',
      page: 1,
    });
    setSearchParams(new URLSearchParams());
  };

  const currentCategory = categories.find((c) => c.id === category);
  const Icon = categoryIcons[category] || Home;
  const bgColor = categoryColors[category] || 'bg-primary';
  const theme = categoryThemes[category] || categoryThemes.default;
  const title = categoryTitles[category] || { en: 'Listings', gu: '' };
  const description =
    categoryDescriptions[category] || 'Discover verified listings curated for your needs.';

  const handleWishlist = async (listingId, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      toast.error('Please login to add to wishlist');
      return;
    }
    try {
      const result = await toggleWishlist(listingId);
      if (result.ok) {
        toast.success(result.wishlisted ? 'Added to wishlist!' : 'Removed from wishlist', {
          duration: 1500,
          id: `wishlist-${listingId}`,
        });
      }
    } catch {
      toast.error('Failed to update wishlist');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 via-white to-stone-100/60" data-testid={`category-page-${category}`}>
      <Header />

      {/* Hero Banner */}
      <div className={`relative overflow-hidden ${theme.banner} py-10 md:py-12`}>
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className={`absolute -top-24 left-8 h-64 w-64 rounded-full ${theme.blobOne} blur-3xl`} />
          <div className={`absolute -bottom-20 right-8 h-72 w-72 rounded-full ${theme.blobTwo} blur-3xl`} />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.75),transparent_45%)]" />
        </div>
        <div className="container-main">
          <div className={`relative rounded-3xl border ${theme.panel} p-6 md:p-8 shadow-[0_24px_64px_-36px_rgba(15,23,42,0.28)] backdrop-blur-sm`}>
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-stone-200/90 to-transparent" />
            <div className="flex items-center gap-4 mb-4">
              <div className={`w-16 h-16 ${theme.icon} rounded-2xl flex items-center justify-center ring-1`}>
                <Icon className="w-8 h-8 text-stone-800" />
              </div>
              <div>
                <h1 className="font-heading text-4xl md:text-5xl font-bold tracking-tight text-stone-900">{title.en}</h1>
                <p className="text-stone-500 text-lg">{title.gu}</p>
              </div>
            </div>
            <p className="text-stone-600 text-base md:text-lg max-w-3xl leading-relaxed">{description}</p>
            <div className={`mt-5 inline-flex items-center rounded-full border ${theme.chip} px-4 py-2 text-sm text-stone-700`}>
              Verified listings and fast discovery
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white/90 backdrop-blur-md border-b border-stone-200 sticky top-16 md:top-20 z-30 shadow-sm">
        <div className="container-main py-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-3 md:p-4 flex items-center gap-3 md:gap-4 flex-wrap shadow-sm">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <SmartSearchInput
                value={filters.search}
                onChange={(value) => handleFilterChange('search', value)}
                placeholder="Search listings..."
                suggestions={suggestions}
                onSuggestionSelect={(value) => handleFilterChange('search', value)}
                inputTestId="category-search-input"
              />
            </div>

            {/* Sub Category */}
            <Select
              value={filters.sub_category || "all"}
              onValueChange={(value) => handleFilterChange('sub_category', value === "all" ? "" : value)}
            >
              <SelectTrigger className="w-[180px] rounded-xl" data-testid="subcategory-filter">
                <SelectValue placeholder="Sub Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {currentCategory?.sub_categories?.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id}>
                    {sub.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Type */}
            {showListingTypeControls && (
              <Select
                value={filters.listing_type || "all"}
                onValueChange={(value) => handleFilterChange('listing_type', value === "all" ? "" : value)}
              >
                <SelectTrigger className="w-[140px] rounded-xl" data-testid="type-filter">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="rent">For Rent</SelectItem>
                  <SelectItem value="sell">For Sale</SelectItem>
                </SelectContent>
              </Select>
            )}

            {/* More Filters */}
            <Sheet open={showFilters} onOpenChange={setShowFilters}>
              <SheetTrigger asChild>
                <Button variant="outline" className="gap-2 rounded-xl">
                  <SlidersHorizontal className="w-4 h-4" />
                  More Filters
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-6">
                  <div>
                    <label className="text-sm font-medium mb-2 block">City</label>
                    <Input
                      placeholder="Enter city"
                      value={filters.city}
                      onChange={(e) => handleFilterChange('city', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Min Price</label>
                    <Input
                      type="number"
                      placeholder="Min price"
                      value={filters.min_price}
                      onChange={(e) => handleFilterChange('min_price', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Max Price</label>
                    <Input
                      type="number"
                      placeholder="Max price"
                      value={filters.max_price}
                      onChange={(e) => handleFilterChange('max_price', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Sort By</label>
                    <Select
                      value={filters.sort_by || "created_at"}
                      onValueChange={(value) => handleFilterChange('sort_by', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="created_at">Newest First</SelectItem>
                        <SelectItem value="price">Price: Low to High</SelectItem>
                        <SelectItem value="views">Most Viewed</SelectItem>
                        <SelectItem value="likes">Most Liked</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={clearFilters} variant="outline" className="w-full">
                    Clear All Filters
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            {/* View Toggle */}
            <div className="hidden md:flex items-center gap-1 border border-stone-200 rounded-xl p-1 bg-stone-50">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-primary text-white' : 'text-stone-600 hover:bg-stone-100'}`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-primary text-white' : 'text-stone-600 hover:bg-stone-100'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {didYouMean && filters.search && (
            <div className="mt-3 text-sm text-stone-600">
              Did you mean{' '}
              <button
                type="button"
                className="text-primary font-semibold hover:underline"
                onClick={() => handleFilterChange('search', didYouMean)}
              >
                {didYouMean}
              </button>
              ?
            </div>
          )}
        </div>
      </div>

      {/* Listings */}
      <div className="container-main py-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="aspect-[4/3] bg-stone-200" />
                <CardContent className="p-4 space-y-3">
                  <div className="h-5 bg-stone-200 rounded w-3/4" />
                  <div className="h-4 bg-stone-200 rounded w-1/2" />
                  <div className="h-6 bg-stone-200 rounded w-1/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-stone-100 border border-stone-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <Icon className="w-10 h-10 text-stone-700" />
            </div>
            <h3 className="font-heading text-2xl font-bold mb-2">No Listings Found</h3>
            <p className="text-muted-foreground mb-6">
              Try adjusting your filters or search criteria
            </p>
            <Button onClick={clearFilters} variant="outline">
              Clear Filters
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <p className="text-muted-foreground">
                Found <span className="font-medium text-foreground">{listings.length}</span> listings
              </p>
            </div>

            <div
              className={
                viewMode === 'grid'
                  ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                  : 'flex flex-col gap-4'
              }
            >
              {listings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  viewMode={viewMode}
                  onWishlist={handleWishlist}
                  wishlisted={isWishlisted(listing.id)}
                  wishlistPending={Boolean(pendingWishlistMap[listing.id])}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-12">
                <Button
                  variant="outline"
                  disabled={filters.page === 1}
                  onClick={() => handleFilterChange('page', filters.page - 1)}
                >
                  Previous
                </Button>
                <span className="px-4 py-2">
                  Page {filters.page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={filters.page === totalPages}
                  onClick={() => handleFilterChange('page', filters.page + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <Footer />
    </div>
  );
};

const ListingCard = ({ listing, viewMode, onWishlist, wishlisted, wishlistPending }) => {
  const navigate = useNavigate();
  const Icon = categoryIcons[listing.category] || Home;
  const bgColor = categoryColors[listing.category] || 'bg-primary';

  const handleOpenReels = (e) => {
    e.preventDefault();
    e.stopPropagation();
    prefetchReelsRoute();
    markRouteNavigation('/reels', 'category-listing-video-btn');
    navigate(`/reels?listingId=${encodeURIComponent(listing.id)}`);
  };

  const handleOpenDiscover = (e) => {
    e.preventDefault();
    e.stopPropagation();
    prefetchDiscoverRoute();
    markRouteNavigation('/discover', 'category-listing-discover-btn');
    const params = new URLSearchParams();
    params.set('listingId', listing.id);
    if (listing.city) params.set('city', listing.city);
    if (listing.category) params.set('category', listing.category);
    navigate(`/discover?${params.toString()}`);
  };

  const formatPrice = (price, type) => {
    if (price >= 10000000) {
      return `₹${(price / 10000000).toFixed(2)} Cr`;
    } else if (price >= 100000) {
      return `₹${(price / 100000).toFixed(2)} L`;
    }
    const monthlySuffix = isPropertyTransactionCategory(listing.category) && type === 'rent' ? '/mo' : '';
    return `₹${price.toLocaleString('en-IN')}${monthlySuffix}`;
  };

  if (viewMode === 'list') {
    return (
      <Link
        to={`/listing/${listing.id}`}
        className="flex bg-white rounded-xl border border-stone-100 overflow-hidden hover:shadow-lg transition-all"
        data-testid={`listing-card-${listing.id}`}
      >
        <div className="relative w-64 flex-shrink-0">
          <img
            src={listing.images?.[0] || 'https://images.unsplash.com/photo-1744311971549-9c529b60b98a?w=400'}
            alt={listing.title}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
          />
          <div className={`absolute top-3 left-3 ${bgColor} px-2 py-1 rounded-full flex items-center gap-1`}>
            <Icon className="w-3 h-3 text-white" />
            <span className="text-white text-xs font-medium capitalize">{listing.category}</span>
          </div>
        </div>
        <div className="flex-1 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-heading font-semibold text-lg text-stone-900 mb-2">{listing.title}</h3>
              <div className="flex items-center gap-1 text-muted-foreground mb-3">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">{listing.location}, {listing.city}</span>
              </div>
            </div>
            <button
              onClick={(e) => onWishlist(listing.id, e)}
              disabled={wishlistPending}
              className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center hover:bg-red-50"
            >
              <Heart className={`w-5 h-5 transition-colors ${wishlisted ? 'text-red-500 fill-red-500' : 'text-stone-600 hover:text-red-500'}`} />
            </button>
          </div>
          <p className="text-muted-foreground text-sm line-clamp-2 mb-4">{listing.description}</p>
          <div className="flex items-center justify-between">
            <p className="font-heading font-bold text-xl text-stone-900">
              {formatPrice(listing.price, listing.listing_type)}
            </p>
            <div className="flex items-center gap-3 text-muted-foreground text-sm">
              <button
                type="button"
                title="Watch Video"
                aria-label="Watch Video"
                onMouseEnter={prefetchReelsRoute}
                onFocus={prefetchReelsRoute}
                onClick={handleOpenReels}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-all"
              >
                <Video className="w-4 h-4" />
              </button>
              <button
                type="button"
                title="Open Discover"
                aria-label="Open Discover"
                onMouseEnter={prefetchDiscoverRoute}
                onFocus={prefetchDiscoverRoute}
                onClick={handleOpenDiscover}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-all"
              >
                <Compass className="w-4 h-4" />
              </button>
              <span className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                {listing.views}
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
  }

  return (
    <Link
      to={`/listing/${listing.id}`}
      className="card-property group"
      data-testid={`listing-card-${listing.id}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={listing.images?.[0] || 'https://images.unsplash.com/photo-1744311971549-9c529b60b98a?w=400'}
          alt={listing.title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className={`absolute top-4 left-4 ${bgColor} px-3 py-1 rounded-full flex items-center gap-1`}>
          <Icon className="w-3 h-3 text-white" />
          <span className="text-white text-xs font-medium capitalize">{listing.category}</span>
        </div>
        {showListingTypeControls && (
          <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full">
            <span className="text-xs font-medium text-stone-700 capitalize">
              {listing.listing_type === 'rent' ? 'For Rent' : 'For Sale'}
            </span>
          </div>
        )}
        <button
          onClick={(e) => onWishlist(listing.id, e)}
          disabled={wishlistPending}
          className="absolute bottom-4 right-4 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-colors"
        >
          <Heart className={`w-5 h-5 transition-colors ${wishlisted ? 'text-red-500 fill-red-500' : 'text-stone-600 hover:text-red-500'}`} />
        </button>

        <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <button
            onMouseEnter={prefetchDiscoverRoute}
            onFocus={prefetchDiscoverRoute}
            type="button"
            title="Watch Video"
            aria-label="Watch Video"
            onClick={handleOpenReels}
            className="w-9 h-9 bg-white/95 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white shadow-sm transition-all"
          >
            <Video className="w-4 h-4 text-stone-600" />
          </button>
          <button
            type="button"
            title="Open Discover"
            aria-label="Open Discover"
            onClick={handleOpenDiscover}
            className="w-9 h-9 bg-white/95 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white shadow-sm transition-all"
          >
            <Compass className="w-4 h-4 text-stone-600" />
          </button>
        </div>
      </div>
      <div className="p-5">
        <h3 className="font-heading font-semibold text-lg text-stone-900 line-clamp-1 group-hover:text-stone-900 transition-colors">
          {listing.title}
        </h3>
        <div className="flex items-center gap-1 mt-2 text-muted-foreground">
          <MapPin className="w-4 h-4" />
          <span className="text-sm line-clamp-1">{listing.location}, {listing.city}</span>
        </div>
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-stone-100">
          <p className="font-heading font-bold text-xl text-stone-900">
            {formatPrice(listing.price, listing.listing_type)}
          </p>
          <div className="flex items-center gap-3 text-muted-foreground text-sm">
            <span className="flex items-center gap-1">
              <Eye className="w-4 h-4" />
              {listing.views}
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
};

export default CategoryPage;
