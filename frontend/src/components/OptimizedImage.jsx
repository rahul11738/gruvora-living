import React, { useMemo, useState } from 'react';

const CLOUD_NAME = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || 'dalkm3nih';
const ENABLE_CLOUDINARY_FETCH = process.env.REACT_APP_ENABLE_CLOUDINARY_FETCH === 'true';
const DEFAULT_SIZES = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw';
const RESPONSIVE_WIDTHS = [320, 500, 640, 768, 1024, 1280, 1536];
const LEGACY_PLACEHOLDER_IDS = new Set([
    'gharshetu/placeholders/listing-default',
    'gharsetu/placeholders/listing-default',
]);
const FALLBACK_PLACEHOLDER_DATA_URI =
    'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22768%22 height=%22512%22 viewBox=%220 0 768 512%22%3E%3Cdefs%3E%3ClinearGradient id=%22bg%22 x1=%220%22 y1=%220%22 x2=%221%22 y2=%221%22%3E%3Cstop offset=%220%25%22 stop-color=%22%23f1f5f9%22/%3E%3Cstop offset=%22100%25%22 stop-color=%22%23e2e8f0%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width=%22768%22 height=%22512%22 fill=%22url(%23bg)%22/%3E%3Cpath d=%22M120 380l130-150 92 104 70-76 136 122H120z%22 fill=%22%23cbd5e1%22/%3E%3Ccircle cx=%22530%22 cy=%22170%22 r=%2236%22 fill=%22%23cbd5e1%22/%3E%3Ctext x=%22384%22 y=%22466%22 text-anchor=%22middle%22 font-family=%22Arial,sans-serif%22 font-size=%2228%22 fill=%22%2364748b%22%3EImage unavailable%3C/text%3E%3C/svg%3E';

const extractPublicIdFromCloudinaryUrl = (url) => {
    if (!url || !url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) {
        return null;
    }

    const tail = url.split('/image/upload/')[1]?.split('?')[0] || '';
    const parts = tail.split('/').filter(Boolean);
    if (!parts.length) return null;

    const versionIndex = parts.findIndex((part) => /^v\d+$/.test(part));
    const idParts = versionIndex >= 0 ? parts.slice(versionIndex + 1) : parts;
    if (!idParts.length) return null;

    const last = idParts[idParts.length - 1].replace(/\.[^./?#]+$/, '');
    idParts[idParts.length - 1] = last;
    return idParts.join('/');
};

const normalizeUrl = (value) => {
    if (!value) return '';
    return String(value).trim().replace(/^http:\/\//i, 'https://');
};

const buildCloudinaryBase = (width) => `f_auto,q_auto,w_${width}`;

const buildCloudinaryUrl = ({ publicId, width }) => {
    const safeValue = normalizeUrl(publicId);
    if (!safeValue) return '';

    if (LEGACY_PLACEHOLDER_IDS.has(safeValue)) {
        return FALLBACK_PLACEHOLDER_DATA_URI;
    }

    const cloudinaryPublicId = extractPublicIdFromCloudinaryUrl(safeValue);
    const transform = buildCloudinaryBase(width);

    if (cloudinaryPublicId) {
        return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transform}/${cloudinaryPublicId}`;
    }

    if (/^https?:\/\//i.test(safeValue)) {
        if (!ENABLE_CLOUDINARY_FETCH) {
            return safeValue;
        }
        const encoded = encodeURIComponent(safeValue);
        return `https://res.cloudinary.com/${CLOUD_NAME}/image/fetch/${transform}/${encoded}`;
    }

    if (safeValue.startsWith('/')) {
        return safeValue;
    }

    return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transform}/${safeValue}`;
};

export const addCloudinaryOptimizations = (publicId, options = {}) => {
    const width = Number(options.width) || 500;
    return buildCloudinaryUrl({ publicId, width });
};

export const optimizeUnsplashUrl = (url, width = 500) => buildCloudinaryUrl({ publicId: url, width });

export const OptimizedImage = React.memo(({
    publicId,
    alt,
    width = 500,
    sizes = DEFAULT_SIZES,
    className = '',
    style,
    fallback = null,
    onLoad,
    onError,
    ...rest
}) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);

    const src = useMemo(() => buildCloudinaryUrl({ publicId, width }), [publicId, width]);

    const srcSet = useMemo(() => {
        if (!publicId) return undefined;
        const widths = Array.from(new Set([...RESPONSIVE_WIDTHS, Number(width) || 500])).sort((a, b) => a - b);
        return widths
            .map((w) => `${buildCloudinaryUrl({ publicId, width: w })} ${w}w`)
            .join(', ');
    }, [publicId, width]);

    const handleLoad = (event) => {
        setIsLoaded(true);
        onLoad?.(event);
    };

    const handleError = (event) => {
        setHasError(true);
        onError?.(event);
    };

    if (hasError || !src) {
        return fallback || (
            <div className={`w-full h-full bg-stone-200 flex items-center justify-center ${className}`} style={style}>
                <span className="text-xs text-stone-500">Image unavailable</span>
            </div>
        );
    }

    return (
        <div className={`relative overflow-hidden ${className}`} style={style}>
            {!isLoaded && <div className="absolute inset-0 bg-stone-200 animate-pulse" aria-hidden="true" />}
            <img
                src={src}
                srcSet={srcSet}
                sizes={sizes}
                alt={alt}
                loading="lazy"
                decoding="async"
                width={width}
                onLoad={handleLoad}
                onError={handleError}
                className={`w-full h-full object-cover transition-all duration-300 ${isLoaded ? 'opacity-100 blur-0 scale-100' : 'opacity-80 blur-sm scale-105'}`}
                {...rest}
            />
        </div>
    );
});

OptimizedImage.displayName = 'OptimizedImage';

export const ResponsiveImage = React.memo((props) => (
    <OptimizedImage {...props} />
));

ResponsiveImage.displayName = 'ResponsiveImage';

export default OptimizedImage;
