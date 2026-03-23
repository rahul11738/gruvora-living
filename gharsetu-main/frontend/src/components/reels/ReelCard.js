import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Heart,
  MessageCircle,
  Bookmark,
  Send,
  Volume2,
  VolumeX,
  Play,
  Home,
  User,
  Check,
  Music,
  MapPin,
} from 'lucide-react';
import { videosAPI } from '../../lib/api';
import FollowButton from './FollowButton';

const ReelCard = React.memo(({
  video,
  videoId,
  ownerId,
  isActive,
  shouldLoad,
  isAuthenticated,
  userId,
  onOpenComments,
  isMuted,
  onToggleMute,
  liked,
  likeCount,
  commentCount,
  following,
  followPending,
  likePending,
  onLike,
  onFollow,
}) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [saved, setSaved] = useState(video.user_saved || false);
  const [shares, setShares] = useState(video.shares || 0);
  const [saveLoading, setSaveLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const [progress, setProgress] = useState(0);
  const lastTap = useRef(0);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
      if (isActive) {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
        videosAPI.recordView(videoId).catch(() => {});
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
        setIsPlaying(false);
      }
    }
  }, [isActive, videoId, isMuted]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const nextProgress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(nextProgress);
    }
  };

  const togglePlay = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      handleDoubleTap();
      return;
    }
    lastTap.current = now;

    setTimeout(() => {
      if (Date.now() - lastTap.current >= 280) {
        if (videoRef.current) {
          if (isPlaying) {
            videoRef.current.pause();
          } else {
            videoRef.current.play();
          }
          setIsPlaying(!isPlaying);
        }
      }
    }, 300);
  };

  const handleDoubleTap = () => {
    if (!liked) {
      handleLike();
    }
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 800);
  };

  const toggleMute = (e) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
    onToggleMute();
  };

  const handleLike = async () => {
    if (likePending) return;
    await onLike(videoId);
  };

  const handleSave = async () => {
    if (!isAuthenticated) {
      toast.error('Login to save');
      return;
    }
    if (saveLoading) return;

    const prevSaved = saved;
    setSaved(!prevSaved);
    setSaveLoading(true);

    try {
      if (prevSaved) {
        await videosAPI.unsave(videoId);
        toast.success('Removed from saved');
      } else {
        await videosAPI.save(videoId);
        toast.success('Saved to your collection');
      }
    } catch (error) {
      console.error('Save failed:', error);
      setSaved(prevSaved);
      toast.error('Failed to update saved state');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleFollow = async () => {
    if (ownerId === userId) return;
    if (followPending) return;
    await onFollow(ownerId);
  };

  const handleShare = async () => {
    if (shareLoading) return;
    setShareLoading(true);

    const shareUrl = `${window.location.origin}/reels/${videoId}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: video.title,
          url: shareUrl,
        });
      } catch (error) {}
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied!');
    }

    try {
      const res = await videosAPI.share(videoId);
      if (typeof res?.data?.shares === 'number') {
        setShares(res.data.shares);
      } else {
        setShares((prev) => prev + 1);
      }
    } catch (error) {
      console.error('Share track failed:', error);
    } finally {
      setShareLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className="h-full w-full snap-start bg-black flex items-center justify-center px-0 md:px-6 lg:px-10" data-testid={`reel-${videoId}`}>
      <div className="relative w-full h-full md:h-auto md:aspect-[9/16] md:w-auto md:max-h-[calc(100vh-2rem)] md:max-w-[430px] lg:max-w-[480px]">
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/20 z-30">
          <motion.div
            className="h-full bg-white"
            style={{ width: `${progress}%` }}
          />
        </div>

        <video
          ref={videoRef}
          src={shouldLoad ? (video.video_url || video.url) : undefined}
          poster={video.thumbnail_url}
          loop
          muted={isMuted}
          playsInline
          preload="metadata"
          className="h-full w-auto max-w-full max-h-screen object-contain bg-black mx-auto"
          onClick={togglePlay}
          onTimeUpdate={handleTimeUpdate}
          onError={(e) => {
            console.error('Video load error:', videoId);
            e.target.style.display = 'none';
          }}
        />

        <AnimatePresence>
          {showHeart && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
            >
              <Heart className="w-28 h-28 text-white fill-red-500 drop-shadow-lg" />
            </motion.div>
          )}
        </AnimatePresence>

        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="w-20 h-20 bg-black/40 rounded-full flex items-center justify-center">
              <Play className="w-10 h-10 text-white ml-1" />
            </div>
          </div>
        )}

        <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5 z-20">
          <div className="relative mb-2">
            <Link to={`/owner/${ownerId}`}>
              <div className="w-12 h-12 rounded-full border-2 border-white overflow-hidden bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 p-[2px]">
                <div className="w-full h-full rounded-full bg-black overflow-hidden">
                  {video.owner_image ? (
                    <img src={video.owner_image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-6 h-6 text-white" />
                    </div>
                  )}
                </div>
              </div>
            </Link>
            {ownerId !== userId && (
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2">
                <FollowButton
                  following={following}
                  pending={followPending}
                  onClick={handleFollow}
                  compact
                  data-testid="follow-btn"
                />
              </div>
            )}
          </div>

          <motion.button onClick={handleLike} disabled={likePending} className="flex flex-col items-center disabled:opacity-60" data-testid="like-btn" whileTap={{ scale: 0.9 }}>
              <Heart className={`w-8 h-8 ${liked ? 'text-red-500 fill-red-500' : 'text-white'}`} />
            <span className="text-white text-xs mt-1 font-semibold">{formatNumber(likeCount)}</span>
          </motion.button>

          <button onClick={() => onOpenComments(video)} className="flex flex-col items-center" data-testid="comment-btn">
            <MessageCircle className="w-8 h-8 text-white" />
            <span className="text-white text-xs mt-1 font-semibold">{formatNumber(commentCount || 0)}</span>
          </button>

          <button onClick={handleShare} disabled={shareLoading} className="flex flex-col items-center disabled:opacity-60" data-testid="share-btn">
            <Send className="w-7 h-7 text-white transform rotate-12" />
            <span className="text-white text-xs mt-1 font-semibold">{formatNumber(shares)}</span>
          </button>

          <motion.button onClick={handleSave} disabled={saveLoading} className="flex flex-col items-center disabled:opacity-60" data-testid="save-btn" whileTap={{ scale: 0.9 }}>
              <Bookmark className={`w-8 h-8 ${saved ? 'text-white fill-white' : 'text-white'}`} />
          </motion.button>

          <button onClick={toggleMute} className="relative">
            <div className="w-10 h-10 rounded-lg border border-white/50 overflow-hidden bg-gradient-to-br from-gray-800 to-gray-600 flex items-center justify-center">
              {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
            </div>
          </button>
        </div>

        <div className="absolute left-3 right-16 bottom-6 z-20">
          <Link to={`/owner/${ownerId}`} className="flex items-center gap-2 mb-2">
            <span className="text-white font-bold text-sm">
              {video.owner_name || 'Owner'}
            </span>
            {following && <Check className="w-4 h-4 text-blue-400" />}
            {ownerId !== userId && (
              <span onClick={(e) => e.preventDefault()}>
                <FollowButton
                  following={following}
                  pending={followPending}
                  onClick={handleFollow}
                  data-testid="follow-btn"
                />
              </span>
            )}
          </Link>

          <p className="text-white text-sm mb-2 line-clamp-2">{video.description || video.title}</p>

          {video.hashtags && (
            <p className="text-white/80 text-xs mb-2">
              {video.hashtags.split(',').map((tag) => `#${tag.trim()}`).join(' ')}
            </p>
          )}

          {video.location && (
            <div className="flex items-center gap-1 text-white/70 text-xs mb-2">
              <MapPin className="w-3 h-3" />
              <span>{video.location}</span>
            </div>
          )}

          {video.listing_id && (
            <Link
              to={`/listing/${video.listing_id}`}
              className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full text-white text-xs font-medium"
            >
              <Home className="w-3 h-3" />
              View Property
            </Link>
          )}

          <div className="flex items-center gap-2 mt-3">
            <Music className="w-3 h-3 text-white/70" />
            <div className="flex-1 overflow-hidden">
              <motion.p
                animate={{ x: [0, -200, 0] }}
                transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                className="text-white/70 text-xs whitespace-nowrap"
              >
                Original audio - {video.owner_name || 'GharSetu'}
              </motion.p>
            </div>
          </div>
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />
      </div>
    </div>
  );
});

export default ReelCard;
