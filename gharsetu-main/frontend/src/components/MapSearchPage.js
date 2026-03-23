import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import { listingsAPI } from '../lib/api';
import { executeListingSearch, fetchListingSuggestions } from '../lib/smartSearch';
import { consumeRouteNavigationMetric, publishRouteNavigationMetric } from '../lib/routeTelemetry';
import SmartSearchInput from './SmartSearchInput';
import { Header } from './Layout';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  MapPin,
  Home,
  Building2,
  Hotel,
  PartyPopper,
  Wrench,
  List,
  Map as MapIcon,
  Eye,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_STYLE = 'mapbox://styles/mapbox/streets-v12';
const FALLBACK_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

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

const markerGlyphs = {
  home: '⌂',
  business: '▣',
  stay: '▦',
  event: '✦',
  services: '●',
};

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

const sanitize = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const resolveMapStyle = (token) => (token ? MAPBOX_STYLE : FALLBACK_STYLE);

const buildOsmEmbedUrl = (lat, lng, delta = 0.08) => {
  const left = lng - delta;
  const right = lng + delta;
  const top = lat + delta;
  const bottom = lat - delta;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${lat}%2C${lng}`;
};

export const MapSearchPage = () => {
  const [searchParams] = useSearchParams();
  const selectedListingId = searchParams.get('listingId') || '';

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || null);
  const [selectedCity, setSelectedCity] = useState(searchParams.get('city') || 'Surat');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [mapCenter, setMapCenter] = useState([21.1702, 72.8311]);
  const [mapZoom, setMapZoom] = useState(12);
  const [selectedListing, setSelectedListing] = useState(null);
  const [viewMode, setViewMode] = useState('map');
  const [didYouMean, setDidYouMean] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const pendingFlyRef = useRef(null);

  const mapboxToken = process.env.REACT_APP_MAPBOX_TOKEN || '';
  const useMapbox = Boolean(mapboxToken);
  const mapStyle = useMemo(() => resolveMapStyle(mapboxToken), [mapboxToken]);
  const osmEmbedUrl = useMemo(() => buildOsmEmbedUrl(mapCenter[0], mapCenter[1]), [mapCenter]);

  useEffect(() => {
    const metric = consumeRouteNavigationMetric('/map');
    if (metric) {
      publishRouteNavigationMetric(metric);
    }
  }, []);

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
    const city = gujaratCities.find((c) => c.name.toLowerCase() === selectedCity.toLowerCase());
    if (city) {
      setMapCenter([city.lat, city.lng]);
      setMapZoom(12);
      pendingFlyRef.current = { center: [city.lat, city.lng], zoom: 12 };
    }
  }, [selectedCity]);

  const fetchListings = useCallback(async () => {
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

      const rawListings = searchResult.listings || [];
      setDidYouMean(searchResult.didYouMean || '');

      const cityCoords = gujaratCities.find((c) => c.name.toLowerCase() === selectedCity.toLowerCase());
      const processedListings = rawListings.map((listing) => {
        const latitude = Number(listing.latitude);
        const longitude = Number(listing.longitude);
        const hasCoords = Number.isFinite(latitude) && Number.isFinite(longitude);

        return {
          ...listing,
          latitude: hasCoords ? latitude : (cityCoords?.lat || 21.1702) + (Math.random() - 0.5) * 0.1,
          longitude: hasCoords ? longitude : (cityCoords?.lng || 72.8311) + (Math.random() - 0.5) * 0.1,
        };
      });

      let nextListings = processedListings;
      let highlighted = null;

      if (selectedListingId) {
        highlighted = processedListings.find((l) => String(l.id) === String(selectedListingId)) || null;
        if (!highlighted) {
          try {
            const detailRes = await listingsAPI.getOne(selectedListingId);
            const detail = detailRes?.data?.listing;
            if (detail) {
              const lat = Number(detail.latitude);
              const lng = Number(detail.longitude);
              highlighted = {
                ...detail,
                latitude: Number.isFinite(lat) ? lat : (cityCoords?.lat || 21.1702),
                longitude: Number.isFinite(lng) ? lng : (cityCoords?.lng || 72.8311),
              };
              nextListings = [highlighted, ...processedListings.filter((l) => String(l.id) !== String(selectedListingId))];
            }
          } catch {
            // Keep flowing with available results
          }
        }
      }

      setListings(nextListings);

      if (highlighted) {
        setSelectedListing(highlighted);
        setMapCenter([highlighted.latitude, highlighted.longitude]);
        setMapZoom(15);
        pendingFlyRef.current = { center: [highlighted.latitude, highlighted.longitude], zoom: 15 };
      }
    } catch (error) {
      console.error('Failed to fetch listings:', error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCity, selectedCategory, selectedListingId]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  useEffect(() => {
    if (!useMapbox) return;
    if (!mapContainerRef.current || mapRef.current) return;

    if (mapboxToken) {
      mapboxgl.accessToken = mapboxToken;
    }

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: mapStyle,
      center: [mapCenter[1], mapCenter[0]],
      zoom: mapZoom,
      attributionControl: true,
      cooperativeGestures: true,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

    map.on('moveend', () => {
      const center = map.getCenter();
      setMapCenter([center.lat, center.lng]);
      setMapZoom(map.getZoom());
    });

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((entry) => entry.marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [mapStyle, mapboxToken, mapCenter, mapZoom, useMapbox]);

  useEffect(() => {
    if (!useMapbox) return;
    if (!mapRef.current || !pendingFlyRef.current) return;
    const next = pendingFlyRef.current;
    mapRef.current.flyTo({ center: [next.center[1], next.center[0]], zoom: next.zoom, essential: true, duration: 1300 });
    pendingFlyRef.current = null;
  }, [mapCenter, mapZoom, useMapbox]);

  useEffect(() => {
    if (!useMapbox) return;
    if (!mapRef.current) return;

    markersRef.current.forEach((entry) => entry.marker.remove());
    markersRef.current = [];

    listings.forEach((listing) => {
      const lat = Number(listing.latitude);
      const lng = Number(listing.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const color = categoryColors[listing.category] || '#10b981';
      const markerElement = document.createElement('button');
      markerElement.type = 'button';
      markerElement.className = `mapbox-marker${selectedListing && String(selectedListing.id) === String(listing.id) ? ' selected' : ''}`;
      markerElement.innerHTML = `
        <span class="mapbox-marker-dot" style="background:${color}"></span>
        <span class="mapbox-marker-glyph">${sanitize(markerGlyphs[listing.category] || markerGlyphs.home)}</span>
      `;
      markerElement.setAttribute('aria-label', sanitize(listing.title || 'Property marker'));

      markerElement.addEventListener('click', () => {
        setSelectedListing(listing);
        pendingFlyRef.current = { center: [lat, lng], zoom: Math.max(mapZoom, 16) };
      });

      const popup = new mapboxgl.Popup({ offset: 20, closeButton: false }).setHTML(`
        <div class="map-popup-card">
          <img src="${sanitize(listing.images?.[0] || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=300')}" alt="${sanitize(listing.title)}" loading="lazy" />
          <div class="map-popup-body">
            <h3>${sanitize(listing.title)}</h3>
            <p>${sanitize(listing.location || listing.city || '')}</p>
            <p style="font-weight: 700; color: #065f46; margin: 8px 0 10px 0; font-size: 13px;">${sanitize(
              listing.price >= 10000000 ? `₹${(listing.price / 10000000).toFixed(2)} Cr` :
              listing.price >= 100000 ? `₹${(listing.price / 100000).toFixed(2)} L` :
              `₹${listing.price?.toLocaleString('en-IN')}${listing.listing_type === 'rent' ? '/mo' : ''}`
            )}</p>
            <a href="/listing/${sanitize(listing.id)}">View Listing →</a>
          </div>
        </div>
      `);

      const marker = new mapboxgl.Marker({ element: markerElement })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(mapRef.current);

      markersRef.current.push({ id: listing.id, marker, element: markerElement });
    });
  }, [listings, mapZoom, selectedListing, useMapbox]);

  useEffect(() => {
    if (!useMapbox) return;
    markersRef.current.forEach(({ id, element, marker }) => {
      if (selectedListing && String(id) === String(selectedListing.id)) {
        element.classList.add('selected');
        if (!marker.getPopup()?.isOpen()) {
          marker.togglePopup();
        }
      } else {
        if (marker.getPopup()?.isOpen()) {
          marker.togglePopup();
        }
        element.classList.remove('selected');
      }
    });
  }, [selectedListing, useMapbox]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchListings();
  };

  const formatPrice = (price, type) => {
    if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
    if (price >= 100000) return `₹${(price / 100000).toFixed(2)} L`;
    return `₹${price?.toLocaleString('en-IN')}${type === 'rent' ? '/mo' : ''}`;
  };

  return (
    <div className="min-h-screen bg-stone-50" data-testid="map-search-page">
      <Header />

      <div className="bg-white border-b sticky top-16 z-20">
        <div className="container-main py-4">
          <form onSubmit={handleSearch} className="flex flex-col xl:flex-row xl:items-center gap-3">
            <div className="flex-1 relative min-w-[220px]">
              <SmartSearchInput
                value={searchQuery}
                onChange={(value) => setSearchQuery(value)}
                placeholder="Search properties..."
                suggestions={suggestions}
                onSuggestionSelect={(value) => setSearchQuery(value)}
                inputTestId="map-search-input"
              />
            </div>

            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="h-12 px-4 border rounded-full bg-white text-stone-700 min-w-[150px]"
              data-testid="city-selector"
            >
              {gujaratCities.map((city) => (
                <option key={city.name} value={city.name}>{city.name}</option>
              ))}
            </select>

            <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  !selectedCategory ? 'bg-primary text-white shadow-md shadow-primary/30' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                All
              </button>
              {Object.entries(categoryIcons).map(([key, Icon]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedCategory(key)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    selectedCategory === key ? 'bg-primary text-white shadow-md shadow-primary/30' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="capitalize">{key}</span>
                </button>
              ))}
            </div>

            <div className="flex rounded-full border overflow-hidden">
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

          {!mapboxToken && (
            <p className="mt-2 text-xs text-stone-500">
              Mapbox token not found. Showing OpenStreetMap fallback. Set REACT_APP_MAPBOX_TOKEN for premium Mapbox rendering.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row" style={{ height: 'calc(100vh - 220px)' }}>
        {viewMode === 'map' && (
          <>
            <div className="flex-1 relative min-h-[50vh] lg:min-h-0" data-testid="map-container">
              {useMapbox ? (
                <div ref={mapContainerRef} className="absolute inset-0" />
              ) : (
                <iframe
                  title="OpenStreetMap fallback"
                  src={osmEmbedUrl}
                  className="absolute inset-0 w-full h-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              )}

              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-stone-100/80 backdrop-blur-[1px] z-10">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              )}

              <div className="absolute bottom-4 left-4 bg-white rounded-full shadow-lg px-4 py-2 z-10">
                <p className="text-sm font-medium">
                  {listings.length} properties in {selectedCity}
                </p>
              </div>
            </div>

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
                      const lat = Number(listing.latitude);
                      const lng = Number(listing.longitude);
                      setSelectedListing(listing);
                      if (Number.isFinite(lat) && Number.isFinite(lng)) {
                        setMapCenter([lat, lng]);
                        setMapZoom(15);
                        if (useMapbox) {
                          pendingFlyRef.current = {
                            center: [lat, lng],
                            zoom: 15,
                          };
                        }
                      }
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
                  <ListViewCard key={listing.id} listing={listing} formatPrice={formatPrice} />
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
  const formatPrice = (price, type) => {
    if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
    if (price >= 100000) return `₹${(price / 100000).toFixed(2)} L`;
    return `₹${price?.toLocaleString('en-IN')}${type === 'rent' ? '/mo' : ''}`;
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left flex gap-3 p-3 rounded-xl transition-colors ${
        isSelected ? 'bg-primary/10 border border-primary' : 'bg-stone-50 hover:bg-stone-100 border border-transparent'
      }`}
      data-testid={`map-listing-${listing.id}`}
    >
      <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
        <img
          src={listing.images?.[0] || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=200'}
          alt={listing.title}
          loading="lazy"
          decoding="async"
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
    </button>
  );
};

const ListViewCard = ({ listing, formatPrice }) => {
  const Icon = categoryIcons[listing.category] || Home;

  return (
    <Link
      to={`/listing/${listing.id}`}
      className="group relative overflow-hidden rounded-2xl bg-white border border-stone-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={listing.images?.[0] || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400'}
          alt={listing.title}
          loading="lazy"
          decoding="async"
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
