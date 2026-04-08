/**
 * Cloudinary Media URL Generator
 * BEST PRACTICE: Store only public_id in database, generate full URLs on frontend
 */

const CLOUDINARY_CLOUD_NAME = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || 'dalkm3nih';

const KNOWN_REEL_PUBLIC_ID_OVERRIDES = {
  'gharshetu/reels/f83a2271-c448-4c04-99ad-f2c3e4c8a06c': {
    publicId: 'gharshetu/reels/ggqemxl7p6kvyzl92hux',
    version: 1775508039,
  },
};

const normalizeVersionValue = (value) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (/^v\d+$/i.test(text)) return text.slice(1);
  if (/^\d+$/.test(text)) return text;
  return null;
};

const isLikelyTransformationSegment = (segment) => {
  if (!segment) return false;
  // Cloudinary transformation segments are usually comma-delimited directives like c_fill,w_480,h_800
  // and can also appear as chained segments such as t_preset or fl_progressive.
  const tokens = segment.split(',');
  return tokens.every((token) => /^[a-z]{1,5}_.+/i.test(token));
};

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

  const publicParts = versionIdx >= 0 ? parts.slice(versionIdx + 1) : [...parts];

  // If version is absent and URL came from transformed delivery path,
  // remove leading transformation segments so only public_id remains.
  if (versionIdx < 0) {
    while (publicParts.length && isLikelyTransformationSegment(publicParts[0])) {
      publicParts.shift();
    }
  }

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
  const override = parsed.publicId ? KNOWN_REEL_PUBLIC_ID_OVERRIDES[parsed.publicId] : null;
  const resolvedPublicId = override?.publicId || parsed.publicId;
  const resolvedVersion = normalizeVersionValue(version ?? override?.version ?? parsed.version);
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
  let transformation = 'f_auto,q_auto';
  if (width || height) {
    transformation += `,c_${crop}`;
    if (width) transformation += `,w_${width}`;
    if (height) transformation += `,h_${height}`;
  }
  if (quality && quality !== 'auto') {
    transformation += `,q_${quality}`;
  }

  const base = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload`;
  const versionPrefix = resolvedVersion ? `v${resolvedVersion}/` : '';
  const path = transformation
    ? `${transformation}/${versionPrefix}${resolvedPublicId}`
    : `${versionPrefix}${resolvedPublicId}`;

  return `${base}/${path}.${format}`;
};

// Alias for reel/video usage where caller has public_id + version fields.
export const getVideoUrl = (publicId, version = null, options = {}) => (
  generateCloudinaryVideoUrl(publicId, version, options)
);

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
  getVideoUrl,
  generateCloudinaryImageUrl,
  normalizeMediaUrl,
};

export default cloudinaryUtils;
