import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import api from '../lib/api';
import { toast } from 'sonner';
import {
  X,
  Image,
  Video,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import OptimizedImage from './OptimizedImage';

const getSignedUploadParams = async (folder, resourceType) => {
  const response = await api.post('/upload/signature', {
    folder,
    resource_type: resourceType,
  });
  return response.data;
};

const uploadToCloudinary = async (file, { folder = 'listings', resourceType = 'auto' } = {}) => {
  const signed = await getSignedUploadParams(folder, resourceType);

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', signed.api_key);
  formData.append('timestamp', String(signed.timestamp));
  formData.append('signature', signed.signature);
  formData.append('folder', signed.folder);

  const endpoint = `https://api.cloudinary.com/v1_1/${signed.cloud_name}/${signed.resource_type}/upload`;

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData?.error?.message || 'Cloudinary upload failed';
    throw new Error(message);
  }

  return response.json();
};

const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  if (!publicId) return;
  const idempotencyKey = `del-${resourceType}-${publicId}`;
  await api.post('/upload/delete', {
    public_id: publicId,
    resource_type: resourceType,
  }, {
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
  });
};

// Image Upload Component
export const ImageUploader = ({
  images = [],
  onImagesChange,
  maxImages = 10,
  folder = 'listings',
  className = ''
}) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    // Check max images
    if (images.length + files.length > maxImages) {
      toast.error(`Maximum ${maxImages} images allowed`);
      return;
    }

    // Validate files
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image`);
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 10MB)`);
        return false;
      }
      return true;
    });

    if (!validFiles.length) return;

    setUploading(true);

    try {
      const results = await Promise.allSettled(
        validFiles.map(file => uploadToCloudinary(file, { folder, resourceType: 'image' }))
      );

      const uploadedImages = results
        .filter(result => result.status === 'fulfilled')
        .map(result => ({
          url: result.value.secure_url,
          public_id: result.value.public_id,
          filename: result.value.original_filename || result.value.public_id,
          width: result.value.width,
          height: result.value.height,
          format: result.value.format,
        }));

      if (uploadedImages.length > 0) {
        onImagesChange([...images, ...uploadedImages]);
        toast.success(`${uploadedImages.length} image(s) uploaded`);
      }

      const failed = results.filter(result => result.status === 'rejected');
      if (failed.length > 0) {
        toast.error(`${failed.length} image(s) failed to upload`);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Failed to upload images');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeImage = async (index) => {
    const imageToRemove = images[index];
    const nextImages = [...images];
    nextImages.splice(index, 1);
    onImagesChange(nextImages);

    if (imageToRemove?.public_id) {
      try {
        await deleteFromCloudinary(imageToRemove.public_id, 'image');
      } catch (error) {
        console.error('Image delete failed:', error);
        toast.error('Image removed locally, but Cloudinary delete failed');
      }
    }
  };

  return (
    <div className={`space-y-4 ${className}`} data-testid="image-uploader">
      {/* Upload Area */}
      <div
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${uploading ? 'border-primary bg-primary/5' : 'border-stone-200 hover:border-primary hover:bg-stone-50'
          }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Uploading...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <Image className="w-6 h-6 text-primary" />
            </div>
            <p className="font-medium">Click to upload images</p>
            <p className="text-sm text-muted-foreground">
              PNG, JPG up to 10MB each (max {maxImages} images)
            </p>
          </div>
        )}
      </div>

      {/* Image Previews */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((image, index) => (
            <motion.div
              key={image.url || index}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative aspect-square rounded-lg overflow-hidden group"
            >
              <OptimizedImage
                publicId={image.url}
                alt={`Upload ${index + 1}`}
                className="w-full h-full object-cover"
                width={300}
                sizes="(max-width: 768px) 50vw, 25vw"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  onClick={() => removeImage(index)}
                  className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                >
                  <Trash2 className="w-5 h-5 text-white" />
                </button>
              </div>
              {index === 0 && (
                <span className="absolute top-2 left-2 bg-primary text-white text-xs px-2 py-1 rounded">
                  Cover
                </span>
              )}
            </motion.div>
          ))}

          {/* Add More Button */}
          {images.length < maxImages && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="aspect-square rounded-lg border-2 border-dashed border-stone-200 flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-stone-50 transition-colors"
            >
              <Plus className="w-6 h-6 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Add More</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// Video Upload Component
export const VideoUploader = ({
  video = null,
  onVideoChange,
  folder = 'reels',
  className = ''
}) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('video/')) {
      toast.error('Please select a video file');
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      toast.error('Video too large (max 100MB)');
      return;
    }

    setUploading(true);

    try {
      const uploaded = await uploadToCloudinary(file, { folder, resourceType: 'video' });
      const cloudNameMatch = uploaded.secure_url
        ? uploaded.secure_url.match(/res\.cloudinary\.com\/([^/]+)\//)
        : null;
      const cloudName = cloudNameMatch?.[1] || '';
      const thumbnailUrl = cloudName
        ? `https://res.cloudinary.com/${cloudName}/video/upload/so_0/${uploaded.public_id}.jpg`
        : '';

      onVideoChange({
        url: uploaded.secure_url,
        public_id: uploaded.public_id,
        thumbnail_url: thumbnailUrl,
        name: file.name,
        size: file.size,
        duration: uploaded.duration,
        format: uploaded.format,
      });

      toast.success('Video uploaded successfully');
    } catch (error) {
      console.error('Video upload failed:', error);
      toast.error(error.message || 'Failed to upload video');
      onVideoChange(null);
    } finally {
      setUploading(false);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeVideo = async () => {
    const publicId = video?.public_id;
    onVideoChange(null);

    if (publicId) {
      try {
        await deleteFromCloudinary(publicId, 'video');
      } catch (error) {
        console.error('Video delete failed:', error);
        toast.error('Video removed locally, but Cloudinary delete failed');
      }
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={`space-y-4 ${className}`} data-testid="video-uploader">
      {!video ? (
        <div
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${uploading ? 'border-primary bg-primary/5' : 'border-stone-200 hover:border-primary hover:bg-stone-50'
            }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />

          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Video className="w-8 h-8 text-primary" />
            </div>
            <div>
              <p className="font-medium text-lg">Click to upload video</p>
              <p className="text-sm text-muted-foreground mt-1">
                MP4, MOV, WebM up to 100MB
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden bg-stone-900">
          <video
            src={video.previewUrl || video.url}
            className="w-full aspect-video object-contain"
            controls
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />

          <div className="absolute top-3 right-3 flex gap-2">
            <span className="bg-black/70 text-white text-xs px-2 py-1 rounded">
              {video.name || 'Video'} • {video.size ? formatFileSize(video.size) : ''}
            </span>
            <button
              onClick={removeVideo}
              className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Combined Media Upload Component
export const MediaUploader = ({
  images = [],
  video = null,
  onImagesChange,
  onVideoChange,
  showVideo = false,
  maxImages = 10,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState('images');

  return (
    <div className={className}>
      {showVideo && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('images')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${activeTab === 'images'
              ? 'bg-primary text-white'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
          >
            <Image className="w-4 h-4 inline mr-2" />
            Images
          </button>
          <button
            onClick={() => setActiveTab('video')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${activeTab === 'video'
              ? 'bg-primary text-white'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
          >
            <Video className="w-4 h-4 inline mr-2" />
            Video
          </button>
        </div>
      )}

      {activeTab === 'images' ? (
        <ImageUploader
          images={images}
          onImagesChange={onImagesChange}
          maxImages={maxImages}
        />
      ) : (
        <VideoUploader
          video={video}
          onVideoChange={onVideoChange}
        />
      )}
    </div>
  );
};

export default MediaUploader;
