import React, { useState, useEffect } from 'react';
import { Image as LucideImage } from 'lucide-react';

/**
 * OptimizedImage Component
 * 
 * Automatically transforms images through Cloudinary with:
 * - Auto format (f_auto): Delivers WebP for modern browsers, JPEG for older
 * - Auto quality (q_auto): Balances quality vs file size (~80%)
 * - Responsive widths: Scales image to device resolution
 * - Lazy loading: Loads images on demand
 * - Placeholder: BlurHash while loading
 * 
 * USE THIS INSTEAD OF <img> TAGS EVERYWHERE
 * 
 * @example
 * <OptimizedImage 
 *   src="https://res.cloudinary.com/myapp/image/upload/v1234/photo.jpg"
 *   alt="Property"
 *   width={400}
 *   height={300}
 *   sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
 * />
 */
export const OptimizedImage = React.memo(({
    src,
    alt = 'Image',
    width = 400,
    height = 300,
    className = '',
    sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
    priority = false,
    onLoad,
    objectFit = 'cover',
}) => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);

    // Handle Unsplash URLs - convert to Cloudinary-friendly format if needed
    let optimizedSrc = src;

    // If it's already a Cloudinary URL, add optimization params
    if (src?.includes('res.cloudinary.com')) {
        optimizedSrc = addCloudinaryOptimizations(src);
    }
    // For other image sources, we'll handle them as-is but with lazy loading

    const handleLoad = () => {
        setIsLoading(false);
        onLoad?.();
    };

    const handleError = () => {
        setError(true);
        setIsLoading(false);
    };

    if (error) {
        return (
            <div
                className={`bg-gray-200 flex items-center justify-center ${className}`}
                style={{ width: `${width}px`, height: `${height}px` }}
            >
                <LucideImage className="w-8 h-8 text-gray-400" />
            </div>
        );
    }

    return (
        <div className={`relative overflow-hidden ${className}`}>
            {/* Placeholder while loading */}
            {isLoading && (
                <div
                    className="absolute inset-0 bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200 animate-pulse"
                    style={{ width: `${width}px`, height: `${height}px` }}
                />
            )}

            {/* Main image */}
            <img
                src={optimizedSrc}
                alt={alt}
                width={width}
                height={height}
                loading={priority ? 'eager' : 'lazy'}
                decoding="async"
                onLoad={handleLoad}
                onError={handleError}
                className={`
          w-full h-full transition-opacity duration-300
          ${isLoading ? 'opacity-0' : 'opacity-100'}
        `}
                style={{
                    objectFit: objectFit,
                    objectPosition: 'center'
                }}
                sizes={sizes}
            />
        </div>
    );
});

OptimizedImage.displayName = 'OptimizedImage';

/**
 * Add Cloudinary optimization parameters to URLs
 * - f_auto: Delivers optimal format (WebP for modern browsers)
 * - q_auto: Automatically adjusts quality (default 80)
 * - c_fill: Crop to fill dimensions
 * - g_auto: Smart gravity for cropping
 */
export function addCloudinaryOptimizations(url, options = {}) {
    if (!url || !url.includes('res.cloudinary.com')) {
        return url;
    }

    const {
        quality = 'auto',
        format = 'auto',
        width,
        gravity = 'auto',
    } = options;

    // Extract upload path from URL
    // Format: https://res.cloudinary.com/{cloud}/image/upload/{transformations}/{public_id}.{ext}
    const urlParts = url.split('/upload/');

    if (urlParts.length !== 2) return url;

    const baseUrl = urlParts[0];
    const filePath = urlParts[1];

    // Build transformation string
    let transformations = [];

    if (width) {
        transformations.push(`w_${width}`);
    }

    transformations.push(`q_${quality}`);
    transformations.push(`f_${format}`);
    transformations.push(`c_fill`);
    transformations.push(`g_${gravity}`);

    const transformPath = transformations.join(',');

    return `${baseUrl}/upload/${transformPath}/${filePath}`;
}

/**
 * Legacy Unsplash Optimizer (for development only)
 * Convert Unsplash URLs to use responsive parameters
 * 
 * @deprecated Use Cloudinary URLs instead for production
 */
export function optimizeUnsplashUrl(url, width = 400) {
    if (!url?.includes('unsplash.com')) return url;

    // Add width parameter to Unsplash
    return url.includes('?')
        ? `${url}&w=${width}&q=80&auto=format&fit=crop`
        : `${url}?w=${width}&q=80&auto=format&fit=crop`;
}

/**
 * Responsive Image Component
 * Handles srcSet for automatic resolution selection
 */
export const ResponsiveImage = React.memo(({
    src,
    alt = 'Image',
    className = '',
    sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
    priority = false,
    onLoad,
}) => {
    const [isLoading, setIsLoading] = useState(true);

    const handleLoad = () => {
        setIsLoading(false);
        onLoad?.();
    };

    // Generate responsive widths for srcSet
    const widths = [300, 500, 800, 1200, 1600];

    let srcSet = '';
    if (src?.includes('res.cloudinary.com') || src?.includes('unsplash.com')) {
        srcSet = widths
            .map(w => {
                const optimized = src.includes('res.cloudinary.com')
                    ? addCloudinaryOptimizations(src, { width: w })
                    : optimizeUnsplashUrl(src, w);
                return `${optimized} ${w}w`;
            })
            .join(', ');
    }

    return (
        <img
            src={src}
            alt={alt}
            srcSet={srcSet}
            sizes={sizes}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            onLoad={handleLoad}
            className={`w-full h-full ${className} ${isLoading ? 'animate-pulse' : ''}`}
            style={{ objectFit: 'cover', objectPosition: 'center' }}
        />
    );
});

ResponsiveImage.displayName = 'ResponsiveImage';
