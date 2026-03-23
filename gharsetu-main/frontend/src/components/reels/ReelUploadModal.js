import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, Loader2, MapPin, UploadCloud, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const categoryOptions = [
  { id: 'home', label: 'Property Sale' },
  { id: 'business', label: 'Property Rent' },
  { id: 'stay', label: 'Stay' },
  { id: 'services', label: 'Services' },
  { id: 'event', label: 'Event' },
];

const roleCategoryAllowlist = {
  property_owner: ['home', 'business'],
  stay_owner: ['stay'],
  hotel_owner: ['stay'],
  service_provider: ['services'],
  event_owner: ['event'],
  admin: ['home', 'business', 'stay', 'services', 'event'],
};

const allCategoryIds = categoryOptions.map((category) => category.id);

const ReelUploadModal = ({ onClose, onSuccess }) => {
  const { token, user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('home');
  const [hashtags, setHashtags] = useState('');
  const [location, setLocation] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const allowedCategoryIds = useMemo(() => {
    if (!user?.role) {
      return allCategoryIds;
    }
    return roleCategoryAllowlist[user.role] || [];
  }, [user?.role]);

  const allowedCategories = useMemo(
    () => categoryOptions.filter((option) => allowedCategoryIds.includes(option.id)),
    [allowedCategoryIds],
  );

  useEffect(() => {
    if (allowedCategories.length > 0 && !allowedCategoryIds.includes(category)) {
      setCategory(allowedCategories[0].id);
    }
  }, [allowedCategories, allowedCategoryIds, category]);

  const validateVideo = (file) => {
    if (!file) return false;
    if (file.size > 100 * 1024 * 1024) {
      toast.error('Video must be less than 100MB');
      return false;
    }
    if (!file.type.startsWith('video/')) {
      toast.error('Please select a video file');
      return false;
    }
    return true;
  };

  const setSelectedVideo = (file) => {
    if (!validateVideo(file)) {
      return;
    }
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    setSelectedVideo(file);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    if (!uploading) {
      setDragActive(true);
    }
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    if (uploading) {
      return;
    }
    const file = event.dataTransfer?.files?.[0];
    setSelectedVideo(file);
  };

  const handleUpload = async () => {
    if (!title || !videoFile) {
      toast.error('Title and video are required');
      return;
    }

    if (!allowedCategoryIds.includes(category)) {
      toast.error('Selected category is not allowed for your role');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('category', category);
      formData.append('hashtags', hashtags);
      formData.append('location', location);
      formData.append('video', videoFile);

      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 5, 95));
      }, 300);

      const response = await fetch(`${API_URL}/api/videos/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (response.ok) {
        toast.success('Reel uploaded successfully!');
        setTimeout(onSuccess, 500);
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm p-3 sm:p-6"
    >
      <motion.div
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mx-auto h-full w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-b from-stone-50 to-white shadow-2xl"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Create Reel</h2>
              <p className="text-xs text-slate-500">Share a high-converting property story</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="grid gap-5 lg:grid-cols-[1.1fr,1.4fr]">
              <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <p className="mb-3 text-sm font-semibold text-slate-900">Video Upload</p>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => !uploading && fileInputRef.current?.click()}
                  className={[
                    'group relative flex min-h-[300px] cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-colors',
                    dragActive ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-slate-50',
                    uploading ? 'cursor-not-allowed opacity-70' : 'hover:border-slate-400',
                  ].join(' ')}
                >
                  {videoPreview ? (
                    <video src={videoPreview} controls className="h-full w-full object-cover" />
                  ) : (
                    <div className="px-4 text-center">
                      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white">
                        <UploadCloud className="h-7 w-7" />
                      </div>
                      <p className="text-sm font-semibold text-slate-900">Drag and drop your reel</p>
                      <p className="mt-1 text-xs text-slate-500">MP4, MOV up to 100MB</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleFileSelect}
                  disabled={uploading}
                  className="hidden"
                />
                {videoFile && (
                  <p className="mt-3 truncate text-xs text-slate-500">Selected: {videoFile.name}</p>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Title</label>
                    <Input
                      placeholder="e.g., 2BHK walkthrough in Vesu"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      disabled={uploading}
                      className="h-11 border-slate-300"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Caption</label>
                    <Textarea
                      placeholder="Add details buyers should know..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      maxLength={2200}
                      disabled={uploading}
                      className="min-h-[150px] resize-y border-slate-300"
                    />
                    <p className="mt-1 text-right text-xs text-slate-400">{description.length}/2200</p>
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-medium text-slate-700">Category</p>
                    <div className="flex flex-wrap gap-2">
                      {allowedCategories.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setCategory(cat.id)}
                          disabled={uploading}
                          className={[
                            'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition',
                            category === cat.id
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-300 bg-white text-slate-700 hover:border-slate-500',
                            uploading ? 'cursor-not-allowed opacity-70' : '',
                          ].join(' ')}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                    {allowedCategories.length === 0 && (
                      <p className="mt-2 text-xs text-red-600">Your account role cannot post reels in any category.</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Hashtags</label>
                    <Input
                      placeholder="luxury, surat, newlisting"
                      value={hashtags}
                      onChange={(e) => setHashtags(e.target.value)}
                      disabled={uploading}
                      className="h-11 border-slate-300"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Location</label>
                    <div className="flex h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-3">
                      <MapPin className="h-4 w-4 text-slate-500" />
                      <input
                        placeholder="Vesu, Surat"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        disabled={uploading}
                        className="h-full w-full bg-transparent text-sm outline-none"
                      />
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {uploading && (
              <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-emerald-100">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                    className="h-full bg-emerald-500"
                  />
                </div>
                <p className="mt-2 text-center text-xs font-medium text-emerald-700">Uploading... {uploadProgress}%</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4 sm:px-6">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading || !title || !videoFile || allowedCategories.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {uploading ? 'Publishing...' : 'Publish Reel'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ReelUploadModal;
