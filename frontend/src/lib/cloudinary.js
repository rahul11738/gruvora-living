/**
 * Cloudinary Media URL Generator
 * BEST PRACTICE: Store only public_id in database, generate full URLs on frontend
 */

const CLOUDINARY_CLOUD_NAME = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || 'dalkm3nih';

const parseCloudinaryVideoRef = (value) => {
  if (!value) return { publicId: null, version: null };

  const text = String(value).trim();
  if (!text) return { publicId: null, version: null };

  if (!text.startsWith('http://') && !text.startsWith('https://')) {
    return { publicId: text.replace(/\.[^./?#]+$/, ''), version: null };
  }

  const safeUrl = text.replace('http://', 'https://');
  if (!safeUrl.includes('res.cloudinary.com') || !safeUrl.includes('/video/upload/')) {
    return { publicId: safeUrl, version: null };
  }

  const tail = safeUrl.split('/video/upload/')[1]?.split('?')[0] || '';
  const parts = tail.split('/').filter(Boolean);
  if (!parts.length) return { publicId: safeUrl, version: null };

  let version = null;
  let versionIdx = -1;
  parts.forEach((part, idx) => {
    if (versionIdx === -1 && /^v\d+$/.test(part)) {
      versionIdx = idx;
      version = Number(part.slice(1));
    }
  });

  const publicParts = versionIdx >= 0 ? parts.slice(versionIdx + 1) : parts;
  if (!publicParts.length) return { publicId: safeUrl, version };

  const last = publicParts[publicParts.length - 1].replace(/\.[^./?#]+$/, '');
  publicParts[publicParts.length - 1] = last;
  const publicId = publicParts.join('/');
  return { publicId, version };
};

/**
 * Generate Cloudinary video URL from public_id + optional version
 * @param {string} publicId - The public_id from Cloudinary (e.g., "gharsetu/reels/filename")
 * @param {number|string|null} version - Cloudinary asset version (e.g., 1774361900)
 * @param {object} options - Optional transformations
 * @returns {string} Full HTTPS URL
 */
export const generateCloudinaryVideoUrl = (publicId, version = null, options = {}) => {
  if (!publicId) return '';

  const parsed = parseCloudinaryVideoRef(publicId);
  const resolvedPublicId = parsed.publicId;
  const resolvedVersion = version ?? parsed.version;
  if (!resolvedPublicId) return '';

  if (resolvedPublicId.startsWith('https://') && !resolvedPublicId.includes('res.cloudinary.com')) {
    return resolvedPublicId;
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
  const versionPrefix = resolvedVersion ? `v${resolvedVersion}/` : '';
  const path = transformation
    ? `${transformation}/${versionPrefix}${resolvedPublicId}`
    : `${versionPrefix}${resolvedPublicId}`;

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

const cloudinaryUtils = {
  generateCloudinaryVideoUrl,
  generateCloudinaryImageUrl,
  normalizeMediaUrl,
};

export default cloudinaryUtils;
