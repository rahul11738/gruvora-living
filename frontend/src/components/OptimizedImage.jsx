import React, { useMemo, useState } from 'react';

const CLOUD_NAME = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || 'dalkm3nih';
const DEFAULT_SIZES = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw';
const RESPONSIVE_WIDTHS = [320, 500, 640, 768, 1024, 1280, 1536];

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

    const cloudinaryPublicId = extractPublicIdFromCloudinaryUrl(safeValue);
    const transform = buildCloudinaryBase(width);

    if (cloudinaryPublicId) {
        return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transform}/${cloudinaryPublicId}`;
    }

    if (/^https?:\/\//i.test(safeValue)) {
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
