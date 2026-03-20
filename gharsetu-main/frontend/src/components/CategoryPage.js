import React, { useState, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { listingsAPI, categoriesAPI, wishlistAPI } from '../lib/api';
import { useAuth } from '../context/AuthContext';
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
  Search,
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
  home: 'bg-emerald-500',
  business: 'bg-blue-500',
  stay: 'bg-purple-500',
  event: 'bg-pink-500',
  services: 'bg-orange-500',
};

const categoryTitles = {
  home: { en: 'Home', gu: 'ઘર' },
  business: { en: 'Business', gu: 'બિઝનેસ' },
  stay: { en: 'Stay', gu: 'રહેવાનું' },
  event: { en: 'Event', gu: 'ઇવેન્ટ' },
  services: { en: 'Services', gu: 'સેવાઓ' },
};

export const CategoryPage = () => {
  const { category } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [categories, setCategories] = useState([]);
  const [viewMode, setViewMode] = useState('grid');
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({
    sub_category: searchParams.get('sub_category') || '',
    listing_type: searchParams.get('type') || '',
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
    fetchListings();
  }, [category, filters]);

  const fetchListings = async () => {
    setLoading(true);
    try {
      const params = {
        category: category,
        page: filters.page,
        limit: 12,
      };

      if (filters.sub_category) params.sub_category = filters.sub_category;
      if (filters.listing_type) params.listing_type = filters.listing_type;
      if (filters.city) params.city = filters.city;
      if (filters.min_price) params.min_price = parseFloat(filters.min_price);
      if (filters.max_price) params.max_price = parseFloat(filters.max_price);
      if (filters.search) params.search = filters.search;
      if (filters.sort_by) params.sort_by = filters.sort_by;

      const response = await listingsAPI.getAll(params);
      setListings(response.data.listings);
      setTotalPages(response.data.pages);
    } catch (error) {
      console.error('Failed to fetch listings:', error);
      toast.error('Failed to load listings');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value, page: 1 };
    setFilters(newFilters);

    const params = new URLSearchParams();
    Object.entries(newFilters).forEach(([k, v]) => {
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
  const title = categoryTitles[category] || { en: 'Listings', gu: '' };

  const handleWishlist = async (listingId, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      toast.error('Please login to add to wishlist');
      return;
    }
    try {
      await wishlistAPI.add(listingId);
      toast.success('Added to wishlist!');
    } catch (error) {
      toast.error('Failed to add to wishlist');
    }
  };

  return (
    <div className="min-h-screen bg-stone-50" data-testid={`category-page-${category}`}>
      <Header />

      {/* Hero Banner */}
      <div className={`${bgColor} text-white py-16`}>
        <div className="container-main">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
              <Icon className="w-8 h-8" />
            </div>
            <div>
              <h1 className="font-heading text-4xl md:text-5xl font-bold">{title.en}</h1>
              <p className="text-white/80 text-lg">{title.gu}</p>
            </div>
          </div>
          <p className="text-white/80 max-w-2xl">
            {currentCategory?.sub_categories?.map((s) => s.name).join(' • ') ||
              'Find the perfect space for your needs'}
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border-b border-stone-200 sticky top-16 md:top-20 z-30">
        <div className="container-main py-4">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search listings..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="pl-10"
                data-testid="category-search-input"
              />
            </div>

            {/* Sub Category */}
            <Select
              value={filters.sub_category || "all"}
              onValueChange={(value) => handleFilterChange('sub_category', value === "all" ? "" : value)}
            >
              <SelectTrigger className="w-[180px]" data-testid="subcategory-filter">
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
            <Select
              value={filters.listing_type || "all"}
              onValueChange={(value) => handleFilterChange('listing_type', value === "all" ? "" : value)}
            >
              <SelectTrigger className="w-[140px]" data-testid="type-filter">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="rent">For Rent</SelectItem>
                <SelectItem value="sell">For Sale</SelectItem>
              </SelectContent>
            </Select>

            {/* More Filters */}
            <Sheet open={showFilters} onOpenChange={setShowFilters}>
              <SheetTrigger asChild>
                <Button variant="outline" className="gap-2">
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
            <div className="hidden md:flex items-center gap-1 border rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-primary text-white' : ''}`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-primary text-white' : ''}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
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
            <div className={`w-20 h-20 ${bgColor} rounded-full flex items-center justify-center mx-auto mb-6`}>
              <Icon className="w-10 h-10 text-white" />
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

const ListingCard = ({ listing, viewMode, onWishlist }) => {
  const Icon = categoryIcons[listing.category] || Home;
  const bgColor = categoryColors[listing.category] || 'bg-primary';

  const formatPrice = (price, type) => {
    if (price >= 10000000) {
      return `₹${(price / 10000000).toFixed(2)} Cr`;
    } else if (price >= 100000) {
      return `₹${(price / 100000).toFixed(2)} L`;
    }
    return `₹${price.toLocaleString('en-IN')}${type === 'rent' ? '/mo' : ''}`;
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
              className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center hover:bg-red-50"
            >
              <Heart className="w-5 h-5 text-stone-600 hover:text-red-500" />
            </button>
          </div>
          <p className="text-muted-foreground text-sm line-clamp-2 mb-4">{listing.description}</p>
          <div className="flex items-center justify-between">
            <p className="font-heading font-bold text-xl text-primary">
              {formatPrice(listing.price, listing.listing_type)}
            </p>
            <div className="flex items-center gap-4 text-muted-foreground text-sm">
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
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className={`absolute top-4 left-4 ${bgColor} px-3 py-1 rounded-full flex items-center gap-1`}>
          <Icon className="w-3 h-3 text-white" />
          <span className="text-white text-xs font-medium capitalize">{listing.category}</span>
        </div>
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full">
          <span className="text-xs font-medium text-stone-700 capitalize">
            {listing.listing_type === 'rent' ? 'For Rent' : 'For Sale'}
          </span>
        </div>
        <button
          onClick={(e) => onWishlist(listing.id, e)}
          className="absolute bottom-4 right-4 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-colors"
        >
          <Heart className="w-5 h-5 text-stone-600 hover:text-red-500 transition-colors" />
        </button>
      </div>
      <div className="p-5">
        <h3 className="font-heading font-semibold text-lg text-stone-900 line-clamp-1 group-hover:text-primary transition-colors">
          {listing.title}
        </h3>
        <div className="flex items-center gap-1 mt-2 text-muted-foreground">
          <MapPin className="w-4 h-4" />
          <span className="text-sm line-clamp-1">{listing.location}, {listing.city}</span>
        </div>
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-stone-100">
          <p className="font-heading font-bold text-xl text-primary">
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
