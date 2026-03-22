import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { motion } from 'framer-motion';
import { listingsAPI } from '../lib/api';
import { executeListingSearch, fetchListingSuggestions } from '../lib/smartSearch';
import SmartSearchInput from './SmartSearchInput';
import { Header, Footer } from './Layout';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import {
  MapPin,
  Home,
  Building2,
  Hotel,
  PartyPopper,
  Wrench,
  Filter,
  List,
  Map as MapIcon,
  X,
  Eye,
  Heart,
  Loader2,
  ChevronRight,
  Navigation,
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

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

// Custom marker icons for each category
const createCategoryIcon = (category) => {
  const color = categoryColors[category] || '#10b981';
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 36px;
        height: 36px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      ">
        <div style="
          transform: rotate(45deg);
          color: white;
          font-size: 14px;
        ">
          ${getCategoryEmoji(category)}
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
};

const getCategoryEmoji = (category) => {
  const emojis = {
    home: '🏠',
    business: '🏢',
    stay: '🏨',
    event: '🎉',
    services: '🔧',
  };
  return emojis[category] || '📍';
};

// Gujarat cities with coordinates
const gujaratCities = [
  { name: 'Surat', lat: 21.1702, lng: 72.8311 },
  { name: 'Ahmedabad', lat: 23.0225, lng: 72.5714 },
  { name: 'Vadodara', lat: 22.3072, lng: 73.1812 },
  { name: 'Rajkot', lat: 22.3039, lng: 70.8022 },
  { name: 'Gandhinagar', lat: 23.2156, lng: 72.6369 },
  { name: 'Bharuch', lat: 21.7051, lng: 72.9959 },
  { name: 'Anand', lat: 22.5645, lng: 72.9289 },
  { name: 'Nadiad', lat: 22.6916, lng: 72.8634 },
  { name: 'Morbi', lat: 22.8173, lng: 70.8378 },
  { name: 'Jamnagar', lat: 22.4707, lng: 70.0577 },
];

// Map controller component
const MapController = ({ center, zoom }) => {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom || 13, { duration: 1 });
    }
  }, [center, zoom, map]);

  return null;
};

export const MapSearchPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || null);
  const [selectedCity, setSelectedCity] = useState(searchParams.get('city') || 'Surat');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [mapCenter, setMapCenter] = useState([21.1702, 72.8311]); // Surat default
  const [mapZoom, setMapZoom] = useState(12);
  const [selectedListing, setSelectedListing] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState('map'); // 'map' or 'list'
  const [didYouMean, setDidYouMean] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    fetchListings();
  }, [selectedCategory, selectedCity, searchQuery]);

  useEffect(() => {
    const query = (searchQuery || '').trim();
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const next = await fetchListingSuggestions({
          query,
          city: selectedCity || undefined,
          category: selectedCategory || undefined,
          limit: 6,
        });
        setSuggestions(next);
      } catch {
        setSuggestions([]);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedCity, selectedCategory]);

  useEffect(() => {
    // Update map center when city changes
    const city = gujaratCities.find(c => c.name.toLowerCase() === selectedCity.toLowerCase());
    if (city) {
      setMapCenter([city.lat, city.lng]);
      setMapZoom(12);
    }
  }, [selectedCity]);

  const fetchListings = async () => {
    setLoading(true);
    try {
      const searchResult = await executeListingSearch({
        query: searchQuery,
        city: selectedCity || undefined,
        category: selectedCategory || undefined,
        limit: 50,
        fallbackParams: {
          city: selectedCity,
          category: selectedCategory || undefined,
        },
      });

      const rawListings = searchResult.listings;
      setDidYouMean(searchResult.didYouMean || '');

      // If no coords, generate random coords around city center
      const cityCoords = gujaratCities.find(c => c.name.toLowerCase() === selectedCity.toLowerCase());
      const processedListings = rawListings.map((listing) => ({
        ...listing,
        latitude: listing.latitude || (cityCoords?.lat || 21.1702) + (Math.random() - 0.5) * 0.1,
        longitude: listing.longitude || (cityCoords?.lng || 72.8311) + (Math.random() - 0.5) * 0.1,
      }));
      
      setListings(processedListings);
    } catch (error) {
      console.error('Failed to fetch listings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchListings();
  };

  const handleCityChange = (city) => {
    setSelectedCity(city);
  };

  const handleMarkerClick = (listing) => {
    setSelectedListing(listing);
  };

  const formatPrice = (price, type) => {
    if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
    if (price >= 100000) return `₹${(price / 100000).toFixed(2)} L`;
    return `₹${price?.toLocaleString('en-IN')}${type === 'rent' ? '/mo' : ''}`;
  };

  return (
    <div className="min-h-screen bg-stone-50" data-testid="map-search-page">
      <Header />

      {/* Search Bar */}
      <div className="bg-white border-b sticky top-16 z-20">
        <div className="container-main py-4">
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3">
            {/* Search Input */}
            <div className="flex-1 relative">
              <SmartSearchInput
                value={searchQuery}
                onChange={(value) => setSearchQuery(value)}
                placeholder="Search properties..."
                suggestions={suggestions}
                onSuggestionSelect={(value) => setSearchQuery(value)}
                inputTestId="map-search-input"
              />
            </div>

            {/* City Selector */}
            <select
              value={selectedCity}
              onChange={(e) => handleCityChange(e.target.value)}
              className="h-12 px-4 border rounded-lg bg-white text-stone-700"
              data-testid="city-selector"
            >
              {gujaratCities.map(city => (
                <option key={city.name} value={city.name}>{city.name}</option>
              ))}
            </select>

            {/* Category Filters */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  !selectedCategory ? 'bg-primary text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                All
              </button>
              {Object.entries(categoryIcons).map(([key, Icon]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedCategory(key)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    selectedCategory === key ? 'bg-primary text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="capitalize">{key}</span>
                </button>
              ))}
            </div>

            {/* View Toggle */}
            <div className="flex rounded-lg border overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode('map')}
                className={`px-4 py-2 flex items-center gap-2 ${
                  viewMode === 'map' ? 'bg-primary text-white' : 'bg-white text-stone-600'
                }`}
              >
                <MapIcon className="w-4 h-4" />
                Map
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 flex items-center gap-2 ${
                  viewMode === 'list' ? 'bg-primary text-white' : 'bg-white text-stone-600'
                }`}
              >
                <List className="w-4 h-4" />
                List
              </button>
            </div>
          </form>

          {didYouMean && searchQuery && (
            <div className="mt-3 text-sm text-stone-600">
              Did you mean{' '}
              <button
                type="button"
                onClick={() => setSearchQuery(didYouMean)}
                className="text-primary font-semibold hover:underline"
              >
                {didYouMean}
              </button>
              ?
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row" style={{ height: 'calc(100vh - 220px)' }}>
        {/* Map View - Shows on mobile when map mode selected */}
        {viewMode === 'map' && (
          <>
            <div className="flex-1 relative min-h-[50vh] lg:min-h-0" data-testid="map-container">
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-stone-100">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <MapContainer
                  center={mapCenter}
                  zoom={mapZoom}
                  style={{ height: '100%', width: '100%' }}
                  className="z-0"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapController center={mapCenter} zoom={mapZoom} />
                  
                  {listings.map((listing) => (
                    <Marker
                      key={listing.id}
                      position={[listing.latitude, listing.longitude]}
                      icon={createCategoryIcon(listing.category)}
                      eventHandlers={{
                        click: () => handleMarkerClick(listing),
                      }}
                    >
                      <Popup>
                        <div className="w-64 p-0">
                          <img
                            src={listing.images?.[0] || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=300'}
                            alt={listing.title}
                            className="w-full h-32 object-cover rounded-t-lg"
                          />
                          <div className="p-3">
                            <h3 className="font-semibold text-sm line-clamp-1">{listing.title}</h3>
                            <p className="text-xs text-muted-foreground mt-1">
                              <MapPin className="w-3 h-3 inline mr-1" />
                              {listing.location}
                            </p>
                            <div className="flex items-center justify-between mt-2">
                              <p className="font-bold text-primary">
                                {formatPrice(listing.price, listing.listing_type)}
                              </p>
                              <Link to={`/listing/${listing.id}`}>
                                <Button size="sm" className="h-7 text-xs">
                                  View
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              )}

              {/* Listing Count */}
              <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg px-4 py-2 z-[1000]">
                <p className="text-sm font-medium">
                  {listings.length} properties in {selectedCity}
                </p>
              </div>
            </div>

            {/* Side Panel */}
            <div className="w-full lg:w-96 bg-white border-l overflow-y-auto" data-testid="listings-panel">
              <div className="p-4 border-b">
                <h2 className="font-heading font-semibold text-lg">
                  Properties in {selectedCity}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {listings.length} listings found
                </p>
              </div>

              <div className="p-4 space-y-4">
                {listings.map((listing) => (
                  <MapListingCard
                    key={listing.id}
                    listing={listing}
                    isSelected={selectedListing?.id === listing.id}
                    onClick={() => {
                      setSelectedListing(listing);
                      setMapCenter([listing.latitude, listing.longitude]);
                      setMapZoom(15);
                    }}
                  />
                ))}

                {listings.length === 0 && !loading && (
                  <div className="text-center py-8">
                    <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No properties found in this area</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="container-main">
              <div className="mb-6">
                <h2 className="font-heading text-2xl font-bold">
                  Properties in {selectedCity}
                </h2>
                <p className="text-muted-foreground">
                  {listings.length} listings found
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {listings.map((listing) => (
                  <ListViewCard key={listing.id} listing={listing} />
                ))}
              </div>

              {listings.length === 0 && !loading && (
                <div className="text-center py-16">
                  <MapPin className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-heading text-xl font-semibold mb-2">No Properties Found</h3>
                  <p className="text-muted-foreground">Try adjusting your search filters</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const MapListingCard = ({ listing, isSelected, onClick }) => {
  const Icon = categoryIcons[listing.category] || Home;

  const formatPrice = (price, type) => {
    if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
    if (price >= 100000) return `₹${(price / 100000).toFixed(2)} L`;
    return `₹${price?.toLocaleString('en-IN')}${type === 'rent' ? '/mo' : ''}`;
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      onClick={onClick}
      className={`flex gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
        isSelected ? 'bg-primary/10 border border-primary' : 'bg-stone-50 hover:bg-stone-100'
      }`}
      data-testid={`map-listing-${listing.id}`}
    >
      <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
        <img
          src={listing.images?.[0] || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=200'}
          alt={listing.title}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge
            className="text-xs"
            style={{ backgroundColor: categoryColors[listing.category], color: 'white' }}
          >
            {listing.category}
          </Badge>
        </div>
        <h3 className="font-medium text-sm line-clamp-1">{listing.title}</h3>
        <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
          <MapPin className="w-3 h-3 inline mr-1" />
          {listing.location}
        </p>
        <p className="font-bold text-primary mt-2">
          {formatPrice(listing.price, listing.listing_type)}
        </p>
      </div>
      <ChevronRight className="w-5 h-5 text-muted-foreground self-center" />
    </motion.div>
  );
};

const ListViewCard = ({ listing }) => {
  const Icon = categoryIcons[listing.category] || Home;
  const bgColor = `bg-[${categoryColors[listing.category]}]`;

  const formatPrice = (price, type) => {
    if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
    if (price >= 100000) return `₹${(price / 100000).toFixed(2)} L`;
    return `₹${price?.toLocaleString('en-IN')}${type === 'rent' ? '/mo' : ''}`;
  };

  return (
    <Link
      to={`/listing/${listing.id}`}
      className="group relative overflow-hidden rounded-2xl bg-white border border-stone-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={listing.images?.[0] || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400'}
          alt={listing.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
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

        <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm px-3 py-1 rounded-full">
          <span className="text-xs font-semibold text-stone-700 capitalize">
            {listing.listing_type === 'rent' ? 'For Rent' : 'For Sale'}
          </span>
        </div>
      </div>

      <div className="p-4">
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
              {listing.views?.toLocaleString() || 0}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default MapSearchPage;
