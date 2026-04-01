import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { User, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { videosAPI } from '../../lib/api';
import CommentSection from './CommentSection';

const CommentsModal = ({ video, onCommentCreated, onClose }) => {
  const { isAuthenticated, user } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const inputRef = useRef(null);

  const fetchComments = useCallback(async () => {
    try {
      const response = await videosAPI.getComments(video.id);
      const data = response.data || {};
      setComments(data.comments || []);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    } finally {
      setLoading(false);
    }
  }, [video.id]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !isAuthenticated) return;

    const text = newComment.trim();
    const optimisticId = `temp-${Date.now()}`;
    const optimisticComment = {
      id: optimisticId,
      video_id: video.id,
      user_id: user?.id,
      user_name: user?.name || user?.email || 'You',
      user_profile_image: user?.profile_image || '',
      comment: text,
      created_at: new Date().toISOString(),
    };

    setSending(true);
    setComments((prev) => [optimisticComment, ...prev]);
    onCommentCreated?.(video.id, 1);
    setNewComment('');

    try {
      const response = await videosAPI.addComment(video.id, text);
      const savedComment = response?.data?.comment;
      const serverCount = response?.data?.comments_count;

      if (savedComment) {
        setComments((prev) => prev.map((item) => (item.id === optimisticId ? savedComment : item)));
      } else {
        fetchComments();
      }
      if (typeof serverCount === 'number') {
        onCommentCreated?.(video.id, 0, serverCount);
      }
    } catch (error) {
      setComments((prev) => prev.filter((item) => item.id !== optimisticId));
      onCommentCreated?.(video.id, -1);
      toast.error('Failed to post comment');
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25 }}
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b text-center relative">
          <h3 className="font-bold">Comments</h3>
          <button onClick={onClose} className="absolute right-4 top-4">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <CommentSection comments={comments} />
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-4 border-t flex items-center gap-3 bg-white">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {user?.profile_image ? (
              <img
                src={user.profile_image}
                alt={user?.name || 'Your avatar'}
                className="w-full h-full object-cover"
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <User className="w-4 h-4 text-gray-500" />
            )}
          </div>
          <input
            ref={inputRef}
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={isAuthenticated ? 'Add a comment...' : 'Login to comment'}
            disabled={!isAuthenticated || sending}
            className="flex-1 bg-transparent outline-none text-sm"
          />
          <button
            type="submit"
            disabled={!newComment.trim() || sending}
            className="text-blue-500 font-semibold text-sm disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default CommentsModal;
