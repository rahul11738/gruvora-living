import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, MapPin, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const ReelUploadModal = ({ onClose, onSuccess }) => {
  const { token } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('home');
  const [hashtags, setHashtags] = useState('');
  const [location, setLocation] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 100 * 1024 * 1024) {
        toast.error('Video must be less than 100MB');
        return;
      }
      if (!file.type.startsWith('video/')) {
        toast.error('Please select a video file');
        return;
      }
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
    }
  };

  const handleUpload = async () => {
    if (!title || !videoFile) {
      toast.error('Title and video are required');
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
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <button onClick={onClose} className="text-white">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-white font-bold">New Reel</h2>
        <button
          onClick={handleUpload}
          disabled={uploading || !title || !videoFile}
          className="text-blue-500 font-semibold disabled:opacity-50"
        >
          {uploading ? 'Posting...' : 'Share'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex gap-4 mb-6">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="w-32 h-48 bg-gray-800 rounded-xl flex items-center justify-center cursor-pointer overflow-hidden flex-shrink-0"
          >
            {videoPreview ? (
              <video src={videoPreview} className="w-full h-full object-cover" />
            ) : (
              <div className="text-center text-gray-500">
                <Camera className="w-8 h-8 mx-auto mb-1" />
                <span className="text-xs">Add Video</span>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="flex-1">
            <Textarea
              placeholder="Write a caption..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-transparent border-0 text-white resize-none p-0 text-sm h-full"
              maxLength={2200}
            />
          </div>
        </div>

        <div className="mb-4">
          <Input
            placeholder="Title *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-gray-800 border-0 text-white"
          />
        </div>

        <div className="mb-4">
          <p className="text-gray-400 text-xs mb-2">Category</p>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'home', label: 'Property Sale' },
              { id: 'business', label: 'Property Rent' },
              { id: 'services', label: 'Interior Service' },
              { id: 'event', label: 'Construction' },
              { id: 'stay', label: 'Architecture' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                  category === cat.id ? 'bg-white text-black' : 'bg-gray-800 text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <Input
            placeholder="Add hashtags (comma separated)"
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            className="bg-gray-800 border-0 text-white"
          />
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-2 bg-gray-800 rounded-md px-3 py-2">
            <MapPin className="w-4 h-4 text-gray-400" />
            <input
              placeholder="Add location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="bg-transparent border-0 text-white text-sm flex-1 outline-none"
            />
          </div>
        </div>

        {uploading && (
          <div className="mt-4">
            <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${uploadProgress}%` }}
                className="h-full bg-blue-500"
              />
            </div>
            <p className="text-gray-400 text-xs text-center mt-2">{uploadProgress}%</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ReelUploadModal;
