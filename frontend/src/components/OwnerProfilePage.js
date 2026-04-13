import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useInteractions } from '../context/InteractionContext';
import { usersAPI, listingsAPI, reelsAPI, adminAPI } from '../lib/api';
import { Header, Footer } from './Layout';
import { normalizeMediaUrl } from '../lib/media';
import OptimizedImage from './OptimizedImage';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ProfileSkeleton } from './SkeletonLoaders';
import { toast } from 'sonner';
import {
  User,
  MapPin,
  Play,
  Grid3X3,
  Heart,
  Eye,
  UserPlus,
  UserMinus,
  CheckCircle,
  Shield,
  Home,
  Building2,
  Hotel,
  PartyPopper,
  Wrench,
  Loader2,
  ArrowLeft,
  MoreVertical,
  EyeOff,
  Trash2,
} from 'lucide-react';

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

const PROPERTY_TRANSACTION_CATEGORIES = new Set(['home', 'business']);
const isPropertyTransactionCategory = (category) =>
  PROPERTY_TRANSACTION_CATEGORIES.has(String(category || '').toLowerCase());
const OWNER_ROLES = new Set(['property_owner', 'stay_owner', 'service_provider', 'hotel_owner', 'event_owner']);

export const OwnerProfilePage = () => {
  const { ownerId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const {
    followingMap,
    pendingFollowMap,
    primeFromVideos,
    primeOwnerFollow,
    hydrateSnapshot,
    toggleFollow,
  } = useInteractions();
  const [owner, setOwner] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('reels');

  const fetchOwnerProfile = useCallback(async () => {
    try {
      const [profileRes, listingsRes] = await Promise.all([
        usersAPI.getProfile(ownerId),
        listingsAPI.getAll({ owner_id: ownerId, limit: 20 }),
      ]);

      setOwner(profileRes.data);
      setListings(listingsRes.data.listings || []);

      primeFromVideos(profileRes.data?.reels || []);
      primeOwnerFollow(ownerId, Boolean(profileRes.data?.is_following));
      if (isAuthenticated) {
        await hydrateSnapshot({ ownerIds: [ownerId] });
      }
    } catch (error) {
      console.error('Failed to fetch owner profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [hydrateSnapshot, isAuthenticated, ownerId, primeFromVideos, primeOwnerFollow]);

  useEffect(() => {
    fetchOwnerProfile();
  }, [fetchOwnerProfile]);

  const handleFollow = async () => {
    if (!isAuthenticated) {
      toast.error('Login કરો follow કરવા માટે');
      navigate('/login');
      return;
    }

    try {
      const result = await toggleFollow(ownerId);
      if (result.ok) {
        if (typeof result.followersCount === 'number') {
          setOwner(prev => ({ ...prev, followers_count: result.followersCount }));
        }
        toast.success(result.following ? 'Following!' : 'Unfollowed');
      }
    } catch (error) {
      toast.error('Action failed');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Header />
        <ProfileSkeleton />
      </div>
    );
  }

  if (!owner) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Header />
        <div className="container-main py-20 text-center">
          <User className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-heading text-2xl font-bold mb-2">Owner Not Found</h2>
          <p className="text-muted-foreground mb-6">This profile doesn't exist or has been removed.</p>
          <Button onClick={() => navigate(-1)} className="btn-primary">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  const isOwnProfile = user?.id === ownerId;
  const isOwnerRole = OWNER_ROLES.has(String(user?.role || '').toLowerCase());
  const canModerateReels = Boolean(
    isAuthenticated
    && (user?.role === 'admin' || (isOwnProfile && isOwnerRole))
  );
  const isFollowing = Boolean(followingMap[ownerId]);
  const followLoading = Boolean(pendingFollowMap[ownerId]);

  return (
    <div className="min-h-screen bg-stone-50 overflow-x-hidden" data-testid="owner-profile-page">
      <Header />

      {/* Profile Header */}
      <div className="bg-white border-b">
        <div className="container-main py-6 md:py-8">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-10">
            {/* Profile Picture */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative"
            >
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-tr from-pink-500 via-purple-500 to-orange-500 p-1">
                <div className="w-full h-full rounded-full bg-white p-1">
                  <div className="w-full h-full rounded-full bg-primary overflow-hidden flex items-center justify-center">
                    {owner.profile_image ? (
                      <OptimizedImage
                        publicId={owner.profile_image}
                        alt={owner.name || 'Owner avatar'}
                        className="w-full h-full object-cover"
                        width={160}
                        sizes="160px"
                      />
                    ) : (
                      <User className="w-16 h-16 md:w-20 md:h-20 text-white" />
                    )}
                  </div>
                </div>
              </div>
              {owner.aadhar_verified && (
                <div className="absolute bottom-2 right-2 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
              )}
            </motion.div>

            {/* Profile Info */}
            <div className="flex-1 text-center md:text-left min-w-0">
              <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
                <h1 className="font-heading text-2xl md:text-3xl font-bold" data-testid="owner-name">
                  {owner.name}
                </h1>
                {!isOwnProfile && (
                  <div className="flex items-center justify-center md:justify-start gap-2">
                    <Button
                      onClick={handleFollow}
                      disabled={followLoading}
                      className={[
                        'min-w-[122px] border transition-colors active:scale-[0.98] disabled:opacity-60',
                        isFollowing
                          ? 'bg-slate-100 text-slate-900 border-slate-300 hover:bg-slate-200 active:bg-slate-300'
                          : 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-500 active:bg-emerald-700',
                      ].join(' ')}
                      data-testid="follow-btn"
                    >
                      {followLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isFollowing ? (
                        <>
                          <UserMinus className="w-4 h-4 mr-2" />
                          Following
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4 mr-2" />
                          Follow
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="text-center rounded-xl bg-stone-50 px-3 py-3">
                  <p className="font-bold text-xl">{owner.reels?.length || 0}</p>
                  <p className="text-muted-foreground text-sm">Reels</p>
                </div>
                <div className="text-center rounded-xl bg-stone-50 px-3 py-3">
                  <p className="font-bold text-xl">{listings.length}</p>
                  <p className="text-muted-foreground text-sm">Listings</p>
                </div>
                <div className="text-center rounded-xl bg-stone-50 px-3 py-3">
                  <p className="font-bold text-xl">{owner.followers_count || 0}</p>
                  <p className="text-muted-foreground text-sm">Followers</p>
                </div>
                <div className="text-center rounded-xl bg-stone-50 px-3 py-3">
                  <p className="font-bold text-xl">{owner.following_count || 0}</p>
                  <p className="text-muted-foreground text-sm">Following</p>
                </div>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-4">
                {owner.role && owner.role !== 'user' && (
                  <Badge className="bg-primary/10 text-primary capitalize">
                    {owner.role.replace('_', ' ')}
                  </Badge>
                )}
                {owner.aadhar_verified && (
                  <Badge className="bg-blue-100 text-blue-700">
                    <Shield className="w-3 h-3 mr-1" />
                    Verified
                  </Badge>
                )}
                {owner.city && (
                  <Badge variant="outline" className="text-muted-foreground">
                    <MapPin className="w-3 h-3 mr-1" />
                    {owner.city}
                  </Badge>
                )}
              </div>

              {/* Bio */}
              {owner.bio && (
                <p className="text-muted-foreground max-w-md">{owner.bio}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b sticky top-16 z-10">
        <div className="container-main">
          <div className="flex items-center justify-start gap-4 overflow-x-auto hide-scrollbar whitespace-nowrap py-1">
            <button
              onClick={() => setActiveTab('reels')}
              className={`flex items-center gap-2 py-4 border-b-2 transition-colors shrink-0 ${activeTab === 'reels'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              data-testid="reels-tab"
            >
              <Play className="w-4 h-4" />
              <span className="font-medium">Reels</span>
            </button>
            <button
              onClick={() => setActiveTab('listings')}
              className={`flex items-center gap-2 py-4 border-b-2 transition-colors shrink-0 ${activeTab === 'listings'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              data-testid="listings-tab"
            >
              <Grid3X3 className="w-4 h-4" />
              <span className="font-medium">Listings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container-main py-8">
        {activeTab === 'reels' && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4" data-testid="reels-grid">
            {owner.reels?.length > 0 ? (
              owner.reels.map((reel) => (
                <ReelCard
                  key={reel.id}
                  reel={reel}
                  canModerate={canModerateReels}
                  isOwnProfile={isOwnProfile}
                  isAdmin={user?.role === 'admin'}
                />
              ))
            ) : (
              <div className="col-span-full py-16 text-center">
                <Play className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-heading text-xl font-semibold mb-2">No Reels Yet</h3>
                <p className="text-muted-foreground">
                  {isOwnProfile ? 'Upload your first reel!' : 'This owner hasn\'t uploaded any reels yet.'}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'listings' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6" data-testid="listings-grid">
            {listings.length > 0 ? (
              listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))
            ) : (
              <div className="col-span-full py-16 text-center">
                <Home className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-heading text-xl font-semibold mb-2">No Listings Yet</h3>
                <p className="text-muted-foreground">
                  {isOwnProfile ? 'Create your first listing!' : 'This owner hasn\'t added any listings yet.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

const ReelCard = ({ reel, canModerate = false, isOwnProfile = false, isAdmin = false }) => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const source = reel.stream_url || reel.adaptive_url || reel.secure_url || reel.url || reel.video_url || '';

  const handleHide = async (event) => {
    event.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const res = isAdmin ? await adminAPI.hideReel(reel.id) : await reelsAPI.hideOwn(reel.id);
      const hidden = Boolean(res?.data?.hidden);
      reel.hidden = hidden;
      reel.visibility = hidden ? 'hidden' : 'public';
      toast.success(hidden ? 'Reel hidden' : 'Reel unhidden');
      setMenuOpen(false);
    } catch (error) {
      toast.error('Failed to update reel visibility');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (event) => {
    event.stopPropagation();
    if (busy) return;
    if (!window.confirm('Delete this reel? It will be soft-deleted first.')) return;
    setBusy(true);
    try {
      if (isAdmin) {
        await adminAPI.deleteReel(reel.id);
      } else {
        await reelsAPI.deleteOwn(reel.id);
      }
      toast.success('Reel deleted');
      setMenuOpen(false);
    } catch (error) {
      toast.error('Failed to delete reel');
    } finally {
      setBusy(false);
    }
  };

  const handleClick = () => {
    navigate(`/reels?video=${reel.id}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      whileHover={{ scale: 1.02 }}
      className="aspect-[9/16] relative rounded-lg overflow-hidden cursor-pointer group bg-stone-900"
      onClick={handleClick}
      data-testid={`reel-card-${reel.id}`}
    >
      {canModerate && (
        <div className="absolute top-2 right-2 z-20" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center border border-white/20"
            aria-label="Moderate reel"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-40 rounded-lg bg-stone-900/95 border border-white/10 shadow-lg overflow-hidden">
              <button
                type="button"
                onClick={handleHide}
                disabled={busy}
                className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2"
              >
                {reel.hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                {reel.hidden ? 'Unhide' : 'Hide'}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                className="w-full px-3 py-2 text-left text-sm text-red-300 hover:bg-white/10 flex items-center gap-2 border-t border-white/10"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          )}
        </div>
      )}

      {reel.thumbnail_url ? (
        <OptimizedImage
          publicId={normalizeMediaUrl(reel.thumbnail_url)}
          alt={reel.title}
          className="w-full h-full object-cover"
          width={360}
          sizes="(max-width: 1024px) 50vw, 25vw"
        />
      ) : (
        <video
          src={normalizeMediaUrl(source)}
          className="w-full h-full object-cover"
          muted
          preload="metadata"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      )}

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Play Icon */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-12 h-12 bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center">
          <Play className="w-6 h-6 text-white ml-1" />
        </div>
      </div>

      {/* Stats */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center gap-3 text-white text-sm opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="flex items-center gap-1">
          <Eye className="w-4 h-4" />
          {reel.views?.toLocaleString() || 0}
        </span>
        <span className="flex items-center gap-1">
          <Heart className="w-4 h-4" />
          {reel.likes || 0}
        </span>
      </div>
    </motion.div>
  );
};

const ListingCard = ({ listing }) => {
  const Icon = categoryIcons[listing.category] || Home;
  const bgColor = categoryColors[listing.category] || 'bg-primary';
  const showTransactionType = isPropertyTransactionCategory(listing.category);

  const formatPrice = (price, type) => {
    if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
    if (price >= 100000) return `₹${(price / 100000).toFixed(2)} L`;
    const monthlySuffix = showTransactionType && type === 'rent' ? '/mo' : '';
    return `₹${price?.toLocaleString('en-IN')}${monthlySuffix}`;
  };

  return (
    <Link
      to={`/listing/${listing.id}`}
      className="group relative overflow-hidden rounded-2xl bg-white border border-stone-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
      data-testid={`listing-card-${listing.id}`}
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

        {/* Category Badge */}
        <div className="absolute top-3 left-3">
          <div className={`${bgColor} px-3 py-1 rounded-full flex items-center gap-1`}>
            <Icon className="w-3 h-3 text-white" />
            <span className="text-white text-xs font-medium capitalize">{listing.category}</span>
          </div>
        </div>

        {/* Type Badge */}
        {showTransactionType && (
          <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm px-3 py-1 rounded-full">
            <span className="text-xs font-semibold text-stone-700 capitalize">
              {listing.listing_type === 'rent' ? 'For Rent' : 'For Sale'}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
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

export default OwnerProfilePage;
