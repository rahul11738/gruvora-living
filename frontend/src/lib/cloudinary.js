/**
 * Cloudinary Media URL Generator
 * BEST PRACTICE: Store only public_id in database, generate full URLs on frontend
 */

const CLOUDINARY_CLOUD_NAME = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || 'dalkm3nih';

/**
 * Generate Cloudinary video URL from public_id
 * @param {string} publicId - The public_id from Cloudinary (e.g., "gharsetu/reels/filename")
 * @param {object} options - Optional transformations
 * @returns {string} Full HTTPS URL
 */
export const generateCloudinaryVideoUrl = (publicId, options = {}) => {
  if (!publicId) return '';

  // Handle both stored formats:
  // 1. publicId directly: "gharsetu/reels/filename"
  // 2. Full URL (fallback): "https://res.cloudinary.com/..."
  if (publicId.startsWith('http://') || publicId.startsWith('https://')) {
    return publicId.replace('http://', 'https://');
  }

  const {
    width = null,
    height = null,
    crop = 'fill',
    quality = 'auto',
    format = 'mp4',
  } = options;

  // Build transformation string
  let transformation = '';
  if (width || height) {
    transformation = `c_${crop}`;
    if (width) transformation += `,w_${width}`;
    if (height) transformation += `,h_${height}`;
    if (quality) transformation += `,q_${quality}`;
  }

  const base = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload`;
  const path = transformation ? `${transformation}/${publicId}` : publicId;
  
  return `${base}/${path}.${format}`;
};

/**
 * Generate Cloudinary image URL from public_id
 */
export const generateCloudinaryImageUrl = (publicId, options = {}) => {
  if (!publicId) return '';

  if (publicId.startsWith('http://') || publicId.startsWith('https://')) {
    return publicId.replace('http://', 'https://');
  }

  const {
    width = 400,
    height = 300,
    crop = 'fill',
    quality = 'auto',
    format = 'jpg',
  } = options;

  const transformation = `c_${crop},w_${width},h_${height},q_${quality}`;
  const base = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload`;
  
  return `${base}/${transformation}/${publicId}.${format}`;
};

/**
 * Normalize any media URL to HTTPS
 */
export const normalizeMediaUrl = (url) => {
  if (!url) return '';
  return url.replace(/^http:\/\//, 'https://');
};

export default {
  generateCloudinaryVideoUrl,
  generateCloudinaryImageUrl,
  normalizeMediaUrl,
};
