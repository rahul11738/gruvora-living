import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { listingsAPI, recommendationsAPI } from '../lib/api';
import { executeListingSearch, fetchListingSuggestions } from '../lib/smartSearch';
import { consumeRouteNavigationMetric, publishRouteNavigationMetric } from '../lib/routeTelemetry';
import SmartSearchInput from './SmartSearchInput';
import { Header } from './Layout';
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
  TrendingUp,
} from 'lucide-react';

const GUJARAT_CITIES = [
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

const CATEGORY_CONFIG = {
  home: { color: '#16a34a', bg: '#dcfce7', label: 'Home', emoji: 'H' },
  business: { color: '#2563eb', bg: '#dbeafe', label: 'Business', emoji: 'B' },
  stay: { color: '#7c3aed', bg: '#ede9fe', label: 'Stay', emoji: 'S' },
  event: { color: '#db2777', bg: '#fce7f3', label: 'Event', emoji: 'E' },
  services: { color: '#ea580c', bg: '#ffedd5', label: 'Services', emoji: 'R' },
};

const ICON_COMPONENTS = {
  home: Home,
  business: Building2,
  stay: Hotel,
  event: PartyPopper,
  services: Wrench,
};

const TILE_SOURCES = [
  {
    key: 'carto-light',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
  },
  {
    key: 'osm',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    subdomains: 'abc',
  },
  {
    key: 'esri-world-street',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    subdomains: '',
  },
];

const safeTrackInteraction = async (payload) => {
  if (!localStorage.getItem('gharsetu_token')) return;

  const action = payload?.action || 'unknown';
  const listingId = payload?.listing_id || 'none';
  const dedupeKey = `${action}:${listingId}`;
  const now = Date.now();

  safeTrackInteraction._lastSent = safeTrackInteraction._lastSent || new Map();
  const lastSentAt = safeTrackInteraction._lastSent.get(dedupeKey) || 0;
  if (now - lastSentAt < 800) return;

  safeTrackInteraction._lastSent.set(dedupeKey, now);
  try {
    await recommendationsAPI.trackInteraction(payload);
  } catch {
    // Best effort telemetry should never break map interactions.
  }
};

function createCategoryIcon(category, isSelected = false) {
  const cfg = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.home;
  const color = isSelected ? '#ef4444' : cfg.color;
  const size = isSelected ? 44 : 36;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + 8}" viewBox="0 0 ${size} ${size + 8}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}"
        fill="${color}" stroke="white" stroke-width="${isSelected ? 3 : 2.5}"/>
      <text x="${size / 2}" y="${size / 2 + 5}" text-anchor="middle" font-size="${isSelected ? 17 : 14}" fill="white">${cfg.emoji}</text>
      <polygon points="${size / 2 - 5},${size - 2} ${size / 2 + 5},${size - 2} ${size / 2},${size + 7}" fill="${color}"/>
    </svg>`;

  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [size, size + 8],
    iconAnchor: [size / 2, size + 8],
    popupAnchor: [0, -(size + 8)],
  });
}

function MapController({ center, zoom, trigger }) {
  const map = useMap();
  const prevRef = useRef({ key: '' });

  useEffect(() => {
    const key = `${trigger}|${center[0].toFixed(5)}|${center[1].toFixed(5)}|${zoom}`;
    if (prevRef.current.key === key) return;
    prevRef.current.key = key;

    if (trigger === 'listing') {
      // Avoid uncached high-zoom tile flashes by panning at current zoom.
      map.panTo(center, { animate: true, duration: 0.35, easeLinearity: 0.5 });
    } else if (trigger === 'city') {
      map.setView(center, zoom, { animate: true, duration: 0.7, easeLinearity: 0.4 });
    } else {
      map.setView(center, zoom, { animate: false });
    }
  }, [center, zoom, trigger, map]);

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize({ pan: false });
    }, 150);

    const onResize = () => map.invalidateSize({ pan: false });
    window.addEventListener('resize', onResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', onResize);
    };
  }, [map]);

  return null;
}

function MapInteractionController({ interactionEnabled }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const handlers = [
      map.dragging,
      map.touchZoom,
      map.doubleClickZoom,
      map.boxZoom,
      map.keyboard,
    ];

    handlers.forEach((handler) => {
      if (!handler) return;
      if (interactionEnabled) handler.enable();
      else handler.disable();
    });

    // Keep wheel zoom disabled so list/sidebar scrolling never zooms the map accidentally.
    if (map.scrollWheelZoom) {
      map.scrollWheelZoom.disable();
    }
  }, [interactionEnabled, map]);

  useEffect(() => {
    if (!map) return;

    const el = map.getContainer();
    const stop = (event) => event.stopPropagation();
    el.addEventListener('wheel', stop, { passive: true, capture: true });

    return () => {
      el.removeEventListener('wheel', stop, { capture: true });
    };
  }, [map]);

  return null;
}

function formatPrice(price, type) {
  if (!price) return '-';
  if (price >= 10000000) return `INR ${(price / 10000000).toFixed(2)} Cr`;
  if (price >= 100000) return `INR ${(price / 100000).toFixed(2)} L`;
  return `INR ${price.toLocaleString('en-IN')}${type === 'rent' ? '/mo' : ''}`;
}

function jitter(base, idx) {
  const radius = 0.015;
  const angle = (idx * 137.508 * Math.PI) / 180;
  return base + radius * Math.cos(angle);
}

function isValidCoordinatePair(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export const MapSearchPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const requestedListingId = searchParams.get('listingId') || '';
  const requestedLat = Number(searchParams.get('lat'));
  const requestedLng = Number(searchParams.get('lng'));
  const hasRequestedCoords = isValidCoordinatePair(requestedLat, requestedLng);

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(requestedListingId);
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || null);
  const [selectedCity, setSelectedCity] = useState(searchParams.get('city') || 'Surat');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [suggestions, setSuggestions] = useState([]);
  const [didYouMean, setDidYouMean] = useState('');
  const [viewMode, setViewMode] = useState('map');
  const [mapCenter, setMapCenter] = useState(hasRequestedCoords ? [requestedLat, requestedLng] : [21.1702, 72.8311]);
  const [mapZoom, setMapZoom] = useState(hasRequestedCoords ? 13 : 12);
  const [mapMoveTrigger, setMapMoveTrigger] = useState('init');
  const [tileSourceIndex, setTileSourceIndex] = useState(0);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [mapInteractionEnabled, setMapInteractionEnabled] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [tileReady, setTileReady] = useState(false);
  const [tileErrors, setTileErrors] = useState(0);
  const tileReadyRef = useRef(false);

  const cardRefs = useRef({});

  const cityCoords = useMemo(
    () => GUJARAT_CITIES.find((city) => city.name === selectedCity) || GUJARAT_CITIES[0],
    [selectedCity],
  );

  const processedListings = useMemo(() => (
    listings.map((listing, index) => {
      const lat = Number(listing.latitude);
      const lng = Number(listing.longitude);
      const hasCoords = isValidCoordinatePair(lat, lng);
      if (hasCoords) {
        return { ...listing, _lat: lat, _lng: lng };
      }

      return {
        ...listing,
        _lat: jitter(cityCoords.lat, index),
        _lng: jitter(cityCoords.lng, index + 31),
        _approx: true,
      };
    })
  ), [listings, cityCoords]);

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
        const nextSuggestions = await fetchListingSuggestions({
          query,
          city: selectedCity,
          category: selectedCategory,
          limit: 6,
        });
        setSuggestions(nextSuggestions);
      } catch {
        setSuggestions([]);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedCity, selectedCategory]);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const result = await executeListingSearch({
        query: searchQuery,
        city: selectedCity || undefined,
        category: selectedCategory || undefined,
        limit: 80,
        fallbackParams: { city: selectedCity, category: selectedCategory || undefined },
      });

      let nextListings = result.listings || [];
      setDidYouMean(result.didYouMean || '');

      if (requestedListingId) {
        const found = nextListings.find((listing) => String(listing.id) === String(requestedListingId));
        if (found) {
          setSelectedId(found.id);
          const lat = Number(found.latitude);
          const lng = Number(found.longitude);
          if (isValidCoordinatePair(lat, lng)) {
            setMapCenter([lat, lng]);
            setMapZoom(13);
            setMapMoveTrigger('listing');
          }
        } else {
          try {
            const detailResponse = await listingsAPI.getOne(requestedListingId);
            const detail = detailResponse?.data?.listing;
            if (detail) {
              nextListings = [detail, ...nextListings.filter((l) => String(l.id) !== String(detail.id))];
              setSelectedId(detail.id);
            }
          } catch {
            // Keep regular listing results.
          }
        }
      }

      setListings(nextListings);
    } catch (error) {
      console.error('[MapSearchPage] listing fetch failed', error);
    } finally {
      setLoading(false);
    }
  }, [requestedListingId, searchQuery, selectedCategory, selectedCity]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  useEffect(() => {
    if (requestedListingId) return;
    setMapCenter([cityCoords.lat, cityCoords.lng]);
    setMapZoom(12);
    setMapMoveTrigger('city');
  }, [cityCoords, requestedListingId]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');

    const syncViewportMode = () => {
      const isMobile = media.matches;
      setIsMobileViewport(isMobile);
      setMapInteractionEnabled(!isMobile);
      if (!isMobile) {
        setMobileSheetOpen(false);
      }
    };

    syncViewportMode();

    if (media.addEventListener) {
      media.addEventListener('change', syncViewportMode);
      return () => media.removeEventListener('change', syncViewportMode);
    }

    media.addListener(syncViewportMode);
    return () => media.removeListener(syncViewportMode);
  }, []);

  useEffect(() => {
    tileReadyRef.current = tileReady;
  }, [tileReady]);

  useEffect(() => {
    setTileReady(false);
    setTileErrors(0);

    const timer = setTimeout(() => {
      setTileSourceIndex((prev) => {
        if (tileReadyRef.current) return prev;
        return Math.min(prev + 1, TILE_SOURCES.length - 1);
      });
    }, 2600);

    return () => clearTimeout(timer);
  }, [tileSourceIndex]);

  const handleSelectListing = useCallback((listing) => {
    if (String(selectedId) === String(listing.id)) {
      navigate(`/listing/${listing.id}`);
      return;
    }

    setSelectedId(listing.id);
    if (isValidCoordinatePair(listing._lat, listing._lng)) {
      setMapCenter([listing._lat, listing._lng]);
      setMapMoveTrigger('listing');
    } else {
      setMapCenter([cityCoords.lat, cityCoords.lng]);
      setMapZoom(12);
      setMapMoveTrigger('city');
    }
    setMobileSheetOpen(false);

    safeTrackInteraction({
      listing_id: listing.id,
      action: 'map_card_click',
      source: 'map_sidebar',
      city: listing.city || selectedCity,
      category: listing.category,
      price: listing.price,
    });

    const card = cardRefs.current[listing.id];
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [cityCoords.lat, cityCoords.lng, navigate, selectedCity, selectedId]);

  const handleMarkerClick = useCallback((listing) => {
    setSelectedId(listing.id);

    safeTrackInteraction({
      listing_id: listing.id,
      action: 'map_marker_click',
      source: 'map_marker',
      city: listing.city || selectedCity,
      category: listing.category,
      price: listing.price,
    });

    const card = cardRefs.current[listing.id];
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedCity]);

  const selectedListing = useMemo(
    () => processedListings.find((listing) => String(listing.id) === String(selectedId)) || null,
    [processedListings, selectedId],
  );

  const mobilePreviewListings = useMemo(() => {
    if (!processedListings.length) return [];
    if (!selectedListing) return processedListings.slice(0, 8);

    const seen = new Set([String(selectedListing.id)]);
    const rest = processedListings.filter((listing) => {
      const key = String(listing.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return [selectedListing, ...rest].slice(0, 8);
  }, [processedListings, selectedListing]);

  const submitSearch = useCallback((event) => {
    event.preventDefault();
    safeTrackInteraction({
      action: 'search',
      source: 'map_search',
      query: searchQuery,
      city: selectedCity,
      category: selectedCategory,
    });
    fetchListings();
  }, [fetchListings, searchQuery, selectedCity, selectedCategory]);

  return (
    <div className="bg-[#f8f7f4] flex flex-col" style={{ height: '100dvh', overflow: 'hidden' }} data-testid="map-search-page">
      <Header />

      <div
        className="bg-white border-b border-stone-200 sticky top-14 md:top-16 z-20 shadow-sm"
        style={{ backdropFilter: 'blur(12px)' }}
      >
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex flex-col gap-3">
          <form onSubmit={submitSearch} className="flex items-center gap-2 flex-wrap">
            <div className="flex-1 min-w-[180px] max-w-sm">
              <SmartSearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search properties..."
                suggestions={suggestions}
                onSuggestionSelect={(value) => setSearchQuery(value)}
                inputTestId="map-search-input"
              />
            </div>

            <select
              value={selectedCity}
              onChange={(event) => setSelectedCity(event.target.value)}
              className="h-10 px-3 rounded-full border border-stone-200 bg-white text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-primary/30"
              data-testid="city-selector"
            >
              {GUJARAT_CITIES.map((city) => (
                <option key={city.name} value={city.name}>{city.name}</option>
              ))}
            </select>

            <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
              <CategoryPill label="All" active={!selectedCategory} onClick={() => setSelectedCategory(null)} />
              {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
                const Icon = ICON_COMPONENTS[key];
                return (
                  <CategoryPill
                    key={key}
                    icon={<Icon className="w-3.5 h-3.5" />}
                    label={config.label}
                    color={config.color}
                    active={selectedCategory === key}
                    onClick={() => setSelectedCategory((prev) => (prev === key ? null : key))}
                  />
                );
              })}
            </div>

            <div className="flex rounded-full border border-stone-200 overflow-hidden shrink-0">
              <ViewToggleBtn active={viewMode === 'map'} onClick={() => setViewMode('map')}>
                <MapIcon className="w-4 h-4" /> <span className="hidden sm:inline ml-1">Map</span>
              </ViewToggleBtn>
              <ViewToggleBtn active={viewMode === 'list'} onClick={() => setViewMode('list')}>
                <List className="w-4 h-4" /> <span className="hidden sm:inline ml-1">List</span>
              </ViewToggleBtn>
            </div>
          </form>

          {didYouMean && searchQuery && (
            <p className="text-xs text-stone-500">
              Did you mean{' '}
              <button
                type="button"
                onClick={() => setSearchQuery(didYouMean)}
                className="text-primary font-semibold hover:underline"
              >
                {didYouMean}
              </button>
              ?
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
      {viewMode === 'map' ? (
        <div className="flex h-full overflow-hidden min-h-0">
          <div className="relative flex-1 min-w-0 h-full">
            {loading && (
              <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/70 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-9 h-9 animate-spin text-primary" />
                  <p className="text-sm text-stone-500 font-medium">Loading properties...</p>
                </div>
              </div>
            )}

            <MapContainer
              center={mapCenter}
              zoom={mapZoom}
              className="absolute inset-0 w-full h-full"
              zoomControl={false}
              attributionControl
              scrollWheelZoom={false}
            >
              <TileLayer
                key={TILE_SOURCES[tileSourceIndex].key}
                url={TILE_SOURCES[tileSourceIndex].url}
                attribution={TILE_SOURCES[tileSourceIndex].attribution}
                subdomains={TILE_SOURCES[tileSourceIndex].subdomains || 'abc'}
                maxZoom={19}
                keepBuffer={4}
                updateWhenIdle={false}
                eventHandlers={{
                  tileload: () => setTileReady(true),
                  tileerror: () => {
                    setTileErrors((prev) => {
                      const next = prev + 1;
                      if (next >= 4) {
                        setTileSourceIndex((current) => Math.min(current + 1, TILE_SOURCES.length - 1));
                        return 0;
                      }
                      return next;
                    });
                  },
                }}
              />

              <ZoomControl position="bottomright" />
              <MapController center={mapCenter} zoom={mapZoom} trigger={mapMoveTrigger} />
              <MapInteractionController interactionEnabled={mapInteractionEnabled} />

              <MarkerClusterGroup chunkedLoading maxClusterRadius={60} spiderfyOnMaxZoom>
                {processedListings.map((listing) => (
                  <Marker
                    key={listing.id}
                    position={[listing._lat, listing._lng]}
                    icon={createCategoryIcon(listing.category, String(selectedId) === String(listing.id))}
                    eventHandlers={{ click: () => handleMarkerClick(listing) }}
                    zIndexOffset={String(selectedId) === String(listing.id) ? 1000 : 0}
                  >
                    <Popup className="gharsetu-popup" maxWidth={230} closeButton={false} offset={[0, -8]} autoPan={false} keepInView={false}>
                      <MapPopupCard listing={listing} />
                    </Popup>
                  </Marker>
                ))}
              </MarkerClusterGroup>
            </MapContainer>

            {!tileReady && tileSourceIndex === TILE_SOURCES.length - 1 && (
              <div className="absolute inset-0 z-[1001] pointer-events-none flex items-center justify-center">
                <div className="pointer-events-auto bg-white/95 border border-stone-200 rounded-xl shadow-xl px-4 py-3 text-center max-w-xs">
                  <p className="text-sm font-semibold text-stone-700">Map tiles are slow right now</p>
                  <p className="text-xs text-stone-500 mt-1">Please check internet or retry map load.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setTileReady(false);
                      setTileSourceIndex(0);
                    }}
                    className="mt-3 text-xs px-3 py-1.5 rounded-full bg-stone-900 text-white"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}

            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[999] bg-white/95 backdrop-blur-sm shadow-lg rounded-full px-4 py-2 items-center gap-2 border border-stone-100 hidden md:flex">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-stone-800">
                {processedListings.length} properties in {selectedCity}
              </span>
            </div>

            <div className="md:hidden absolute inset-x-0 bottom-3 z-[998] px-3 pointer-events-none">
              <div className="pointer-events-auto rounded-2xl border border-stone-200/80 bg-white/90 backdrop-blur-md shadow-xl p-2">
                <div className="flex items-center justify-between px-1 pb-1.5">
                  <p className="text-xs font-semibold text-stone-700">Top Listings</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMapInteractionEnabled((prev) => !prev)}
                      className={`text-[11px] px-2.5 py-1 rounded-full border ${
                        mapInteractionEnabled
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'bg-white text-stone-600 border-stone-300'
                      }`}
                    >
                      {mapInteractionEnabled ? 'Explore Map' : 'Scroll Page'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMobileSheetOpen(true)}
                      className="text-[11px] px-2.5 py-1 rounded-full border border-stone-300 bg-white text-stone-700"
                    >
                      View All
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                  {mobilePreviewListings.map((listing) => (
                    <MobileMapCard
                      key={listing.id}
                      listing={listing}
                      selected={String(selectedId) === String(listing.id)}
                      onClick={() => handleSelectListing(listing)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <aside
            className="w-full max-w-xs lg:max-w-sm xl:max-w-md bg-white border-l border-stone-100 flex-shrink-0 hidden md:flex flex-col min-h-0 h-full"
            style={{ overscrollBehavior: 'contain' }}
            onWheelCapture={(event) => event.stopPropagation()}
            onTouchMoveCapture={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 px-4 py-3 border-b border-stone-100">
              <h2 className="font-semibold text-stone-800 text-base">
                {selectedCity}{' '}
                <span className="text-stone-400 font-normal text-sm">- {processedListings.length} listings</span>
              </h2>
            </div>

            <div
              className="flex-1 min-h-0 overflow-y-auto sidebar-scroll"
              style={{ overscrollBehavior: 'contain', touchAction: 'pan-y' }}
              onWheelCapture={(event) => event.stopPropagation()}
              onTouchMoveCapture={(event) => event.stopPropagation()}
            >
              <div className="flex flex-col gap-2 p-3">
              {processedListings.map((listing) => (
                <SidebarCard
                  key={listing.id}
                  ref={(node) => { cardRefs.current[listing.id] = node; }}
                  listing={listing}
                  selected={String(selectedId) === String(listing.id)}
                  onClick={() => handleSelectListing(listing)}
                />
              ))}
              {!loading && processedListings.length === 0 && <EmptyState />}
              </div>
            </div>
          </aside>

          {mobileSheetOpen && (
            <div className="md:hidden fixed inset-0 z-[1200] bg-black/40" onClick={() => setMobileSheetOpen(false)}>
              <div
                className="absolute inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl max-h-[75vh] flex flex-col"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-stone-800">{processedListings.length} listings in {selectedCity}</h3>
                  <button
                    type="button"
                    onClick={() => setMobileSheetOpen(false)}
                    className="text-xs px-2.5 py-1 rounded-full border border-stone-300 bg-white text-stone-600"
                  >
                    Close
                  </button>
                </div>

                <div
                  className="overflow-y-auto p-3 flex flex-col gap-2"
                  style={{ overscrollBehavior: 'contain', touchAction: 'pan-y' }}
                  onWheelCapture={(event) => event.stopPropagation()}
                  onTouchMoveCapture={(event) => event.stopPropagation()}
                >
                  {processedListings.map((listing) => (
                    <SidebarCard
                      key={listing.id}
                      listing={listing}
                      selected={String(selectedId) === String(listing.id)}
                      onClick={() => handleSelectListing(listing)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-screen-xl mx-auto">
            <p className="text-stone-500 text-sm mb-5">
              {processedListings.length} listings in <strong>{selectedCity}</strong>
            </p>
            {loading ? (
              <GridSkeleton />
            ) : processedListings.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {processedListings.map((listing) => (
                  <ListViewCard key={listing.id} listing={listing} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

const CategoryPill = ({ label, icon, color, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 border ${
      active
        ? 'text-white shadow-md border-transparent'
        : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
    }`}
    style={active ? { background: color || '#16a34a' } : {}}
  >
    {icon}
    {label}
  </button>
);

const ViewToggleBtn = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center px-3 py-2 text-xs font-semibold transition-colors ${
      active ? 'bg-stone-900 text-white' : 'bg-white text-stone-500 hover:text-stone-800'
    }`}
  >
    {children}
  </button>
);

const MapPopupCard = ({ listing }) => {
  const cfg = CATEGORY_CONFIG[listing.category] || CATEGORY_CONFIG.home;

  return (
    <div style={{ width: 210, fontFamily: 'inherit' }}>
      <div
        style={{
          height: 110,
          borderRadius: 10,
          overflow: 'hidden',
          marginBottom: 8,
          background: '#f3f4f6',
        }}
      >
        <img
          src={listing.images?.[0] || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400'}
          alt={listing.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          loading="lazy"
        />
      </div>

      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          background: cfg.bg,
          color: cfg.color,
          borderRadius: 999,
          padding: '2px 8px',
          fontSize: 10,
          fontWeight: 700,
          marginBottom: 4,
          textTransform: 'capitalize',
        }}
      >
        {cfg.label}
      </div>

      <p style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3, margin: '4px 0' }}>{listing.title}</p>
      <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0' }}>{listing.location || listing.city}</p>
      <p style={{ fontSize: 14, fontWeight: 800, color: '#065f46', margin: '6px 0' }}>
        {formatPrice(listing.price, listing.listing_type)}
      </p>

      <Link
        to={`/listing/${listing.id}`}
        style={{
          display: 'block',
          textAlign: 'center',
          background: '#16a34a',
          color: 'white',
          borderRadius: 8,
          padding: '7px 0',
          fontSize: 12,
          fontWeight: 700,
          textDecoration: 'none',
          marginTop: 6,
        }}
      >
        View Listing
      </Link>
    </div>
  );
};

const SidebarCard = React.forwardRef(({ listing, selected, onClick }, ref) => {
  const cfg = CATEGORY_CONFIG[listing.category] || CATEGORY_CONFIG.home;

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={`w-full text-left flex gap-3 p-3 rounded-xl transition-all border-2 group ${
        selected
          ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
          : 'border-transparent bg-stone-50 hover:bg-stone-100 hover:border-stone-200'
      }`}
      data-testid={`map-listing-${listing.id}`}
    >
      <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-stone-200">
        <img
          src={listing.images?.[0] || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=200'}
          alt={listing.title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
        />
      </div>

      <div className="flex-1 min-w-0">
        <div
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold mb-1"
          style={{ background: cfg.bg, color: cfg.color }}
        >
          {cfg.label}
          {listing._approx && <span className="ml-1 opacity-60" title="Approximate location">~</span>}
        </div>

        <p className="font-semibold text-[13px] text-stone-800 line-clamp-1 leading-tight">{listing.title}</p>

        <p className="text-[11px] text-stone-400 mt-0.5 flex items-center gap-0.5">
          <MapPin className="w-3 h-3 shrink-0" />
          <span className="line-clamp-1">{listing.location || listing.city}</span>
        </p>

        <div className="flex items-center justify-between mt-1.5">
          <p className="font-bold text-sm text-primary">{formatPrice(listing.price, listing.listing_type)}</p>
          <span className="text-[10px] text-stone-400 flex items-center gap-1">
            <Eye className="w-3 h-3" />{listing.views || 0}
          </span>
        </div>
      </div>

      <ChevronRight className={`w-4 h-4 shrink-0 self-center transition-transform ${selected ? 'translate-x-0.5 text-primary' : 'text-stone-300'}`} />
    </button>
  );
});

SidebarCard.displayName = 'SidebarCard';

const MobileMapCard = ({ listing, selected, onClick }) => {
  const cfg = CATEGORY_CONFIG[listing.category] || CATEGORY_CONFIG.home;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-[210px] max-w-[210px] text-left rounded-xl border p-2.5 transition-all ${
        selected
          ? 'border-primary bg-primary/5 shadow-md shadow-primary/15'
          : 'border-stone-200 bg-white hover:border-stone-300'
      }`}
    >
      <div className="flex gap-2">
        <div className="w-16 h-16 rounded-lg overflow-hidden bg-stone-100 shrink-0">
          <img
            src={listing.images?.[0] || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=180'}
            alt={listing.title}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div
            className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold mb-1"
            style={{ background: cfg.bg, color: cfg.color }}
          >
            {cfg.label}
          </div>
          <p className="text-[12px] font-semibold text-stone-800 line-clamp-2 leading-tight">{listing.title}</p>
          <p className="text-[11px] font-bold text-primary mt-1">{formatPrice(listing.price, listing.listing_type)}</p>
        </div>
      </div>
    </button>
  );
};

const ListViewCard = ({ listing }) => {
  const cfg = CATEGORY_CONFIG[listing.category] || CATEGORY_CONFIG.home;
  const Icon = ICON_COMPONENTS[listing.category] || Home;

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
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        <div
          className="absolute top-3 left-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold text-white"
          style={{ background: cfg.color }}
        >
          <Icon className="w-3 h-3" />
          {cfg.label}
        </div>

        <div className="absolute top-3 right-3 bg-white/95 px-2.5 py-1 rounded-full text-[11px] font-semibold text-stone-700">
          {listing.listing_type === 'rent' ? 'For Rent' : 'For Sale'}
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-base text-stone-900 line-clamp-1 group-hover:text-primary transition-colors">
          {listing.title}
        </h3>
        <p className="flex items-center gap-1 text-xs text-stone-400 mt-1">
          <MapPin className="w-3 h-3 shrink-0" />
          {listing.location}, {listing.city}
        </p>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-stone-100">
          <p className="font-bold text-lg text-primary">{formatPrice(listing.price, listing.listing_type)}</p>
          <span className="flex items-center gap-1 text-xs text-stone-400">
            <Eye className="w-3.5 h-3.5" /> {(listing.views || 0).toLocaleString()}
          </span>
        </div>
      </div>
    </Link>
  );
};

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <MapPin className="w-12 h-12 text-stone-300 mb-3" />
    <p className="font-semibold text-stone-600">No properties found</p>
    <p className="text-sm text-stone-400 mt-1">Try adjusting city, category or search terms</p>
  </div>
);

const GridSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
    {Array.from({ length: 8 }).map((_, index) => (
      <div key={index} className="rounded-2xl bg-stone-200 animate-pulse aspect-[4/3]" />
    ))}
  </div>
);

export default MapSearchPage;
