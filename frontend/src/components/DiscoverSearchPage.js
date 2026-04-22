import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listingsAPI } from '../lib/api';
import { Header } from './Layout';
import SeoHead from './SeoHead';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import {
  Search,
  Home,
  Building2,
  Hotel,
  PartyPopper,
  Wrench,
  Eye,
  Loader2,
} from 'lucide-react';
import OptimizedImage from './OptimizedImage';

const categoryIcons = {
  home: Home,
  business: Building2,
  stay: Hotel,
  event: PartyPopper,
  services: Wrench,
};

const categoryColors = {
  home: '#10b981',
  business: '#3b82f6',
  stay: '#8b5cf6',
  event: '#ec4899',
  services: '#f97316',
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
  'Morbi',
  'Jamnagar',
];

export const DiscoverSearchPage = () => {
  const [searchParams] = useSearchParams();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || null);
  const [selectedCity, setSelectedCity] = useState(searchParams.get('city') || 'Surat');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  // Show 6 cards per page on all screens (mobile, laptop, etc.)
  const PAGE_SIZE = 6;

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const params = { city: selectedCity, limit: 50 };
      if (selectedCategory) params.category = selectedCategory;
      if (searchQuery) params.q = searchQuery;

      const response = await listingsAPI.getAll(params);
      setListings(response?.data?.listings || []);
      setCurrentPage(1); // Reset to page 1 on new search/filter
    } catch (error) {
      console.error('Failed to fetch listings:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, selectedCity, searchQuery]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchListings();
  };

  // Pagination logic
  const totalPages = Math.ceil(listings.length / PAGE_SIZE);
  const paginatedListings = listings.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const formatPrice = (price, type, category) => {
    if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
    if (price >= 100000) return `₹${(price / 100000).toFixed(2)} L`;
    const monthlySuffix = type === 'rent' && isPropertyTransactionCategory(category) ? '/mo' : '';
    return `₹${price?.toLocaleString('en-IN')}${monthlySuffix}`;
  };

  return (
    <div className="min-h-screen bg-stone-50 overflow-x-hidden" data-testid="discover-search-page">
      <SeoHead
        title="Discover Properties – Gruvora Living"
        description="Browse and search premium rental properties and stays in Gujarat and across India on Gruvora Living. Filter by city, category, and more."
        canonical="https://gruvora.com/discover"
        keywords={["Gruvora", "discover", "property search", "rental listings", "Gujarat", "India"]}
        og={[{
          property: "og:title",
          content: "Discover Properties – Gruvora Living"
        }, {
          property: "og:description",
          content: "Browse and search premium rental properties and stays in Gujarat and across India on Gruvora Living. Filter by city, category, and more."
        }, {
          property: "og:url",
          content: "https://gruvora.com/discover"
        }, {
          property: "og:type",
          content: "website"
        }]}
        twitter={[{
          name: "twitter:card",
          content: "summary_large_image"
        }, {
          name: "twitter:title",
          content: "Discover Properties – Gruvora Living"
        }, {
          name: "twitter:description",
          content: "Browse and search premium rental properties and stays in Gujarat and across India on Gruvora Living. Filter by city, category, and more."
        }]}
      />
      <Header />

      <div className="bg-white border-b sticky top-16 z-20">
        <div className="container-main py-4">
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search listings..."
                className="pl-10 h-12"
                data-testid="listings-search-input"
              />
            </div>

            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="h-12 w-full md:w-auto px-4 border rounded-lg bg-white text-stone-700"
              data-testid="city-selector"
            >
              {gujaratCities.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>

            <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar md:scrollbar-hide">
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${!selectedCategory ? 'bg-primary text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
              >
                All
              </button>
              {Object.entries(categoryIcons).map(([key, Icon]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedCategory(key)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${selectedCategory === key ? 'bg-primary text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="capitalize">{key}</span>
                </button>
              ))}
            </div>
          </form>
        </div>
      </div>

      <div className="container-main py-6">
        <div className="mb-6">
          <h2 className="font-heading text-2xl font-bold">Listings in {selectedCity}</h2>
          <p className="text-muted-foreground">{listings.length} listings found</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-16">
            <Home className="w-14 h-14 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-heading text-xl font-semibold mb-2">No Listings Found</h3>
            <p className="text-muted-foreground">Try adjusting your search filters.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedListings.map((listing) => (
                <ListViewCard
                  key={listing.id}
                  listing={listing}
                  formatPrice={formatPrice}
                  contextCategory={selectedCategory}
                />
              ))}
            </div>
            {/* Pagination Controls - always visible, sticky on mobile */}
            {totalPages > 1 && (
              <div
                className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 border-t border-stone-200 py-3 flex justify-center items-center gap-2 shadow-lg md:static md:bg-transparent md:border-0 md:py-0 md:shadow-none mt-8"
                style={{ pointerEvents: 'auto' }}
              >
                <button
                  className="px-3 py-2 rounded border bg-white text-stone-700 disabled:opacity-50"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  aria-label="Previous page"
                >
                  Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i + 1}
                    className={`px-3 py-2 rounded border ${currentPage === i + 1 ? 'bg-primary text-white border-primary' : 'bg-white text-stone-700'}`}
                    onClick={() => setCurrentPage(i + 1)}
                    aria-current={currentPage === i + 1 ? 'page' : undefined}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  className="px-3 py-2 rounded border bg-white text-stone-700 disabled:opacity-50"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  aria-label="Next page"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const ListViewCard = ({ listing, formatPrice, contextCategory = null }) => {
  const Icon = categoryIcons[listing.category] || Home;
  const effectiveCategory = contextCategory || listing.category;
  const showTransactionType =
    isPropertyTransactionCategory(effectiveCategory) &&
    isPropertyTransactionCategory(listing.category);

  return (
    <Link
      to={`/listing/${listing.id}`}
      className="group relative overflow-hidden rounded-2xl bg-white border border-stone-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <OptimizedImage
          publicId={listing.images?.[0] || 'gharshetu/placeholders/listing-default'}
          alt={listing.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
          width={640}
          sizes="(max-width: 1024px) 100vw, 33vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        <div className="absolute top-3 left-3">
          <Badge
            className="text-xs"
            style={{ backgroundColor: categoryColors[listing.category], color: 'white' }}
          >
            <Icon className="w-3 h-3 mr-1" />
            {listing.category}
          </Badge>
        </div>

        {showTransactionType && (
          <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm px-3 py-1 rounded-full">
            <span className="text-xs font-semibold text-stone-700 capitalize">
              {listing.listing_type === 'rent' ? 'For Rent' : 'For Sale'}
            </span>
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-heading font-semibold text-lg text-stone-900 line-clamp-1 group-hover:text-primary transition-colors">
          {listing.title}
        </h3>

        <p className="text-sm text-muted-foreground line-clamp-1 mt-2">
          {listing.location}, {listing.city}
        </p>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-stone-100">
          <p className="font-heading font-bold text-xl text-primary">
            {formatPrice(listing.price, listing.listing_type, listing.category)}
          </p>
          <div className="flex items-center gap-3 text-muted-foreground text-sm">
            <span className="flex items-center gap-1">
              <Eye className="w-4 h-4" />
              {listing.views?.toLocaleString() || 0}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default DiscoverSearchPage;