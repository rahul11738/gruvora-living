/**
 * SERVICE WORKER REGISTRATION
 * 
 * Register and manage the service worker for PWA caching.
 * Call this from your main index.js file.
 * 
 * Benefits:
 * - Instant load on repeat visits (cached)
 * - Offline support
 * - Background sync
 * - Push notifications (future)
 */

/**
 * Register the service worker
 * 
 * @param {Object} config - Configuration options
 * @param {boolean} config.skipWaiting - Force new SW to activate immediately
 * @param {Function} config.onMount - Callback when SW mounted
 * @param {Function} config.onUpdate - Callback when new SW version available
 * @param {Function} config.onError - Callback on SW error
 */
export function registerServiceWorker(config = {}) {
    if (!('serviceWorker' in navigator)) {
        console.log('Service Workers not supported in this browser');
        return;
    }

    const { skipWaiting = false, onMount, onUpdate, onError } = config;

    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/service-worker.js', {
                scope: '/',
            });

            console.log('Service Worker registered successfully:', registration);

            // Handle updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;

                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New service worker available
                        console.log('New Service Worker version available');
                        onUpdate?.({
                            skipWaiting: () => {
                                newWorker.postMessage({ type: 'SKIP_WAITING' });
                            },
                        });
                    }
                });
            });

            // Mount callback
            if (navigator.serviceWorker.controller) {
                onMount?.({ registration });
            } else {
                onMount?.({ registration, isFirstInstall: true });
            }

            // Force new version to activate immediately (if configured)
            if (skipWaiting && registration.waiting) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
        } catch (error) {
            console.error('Service Worker registration failed:', error);
            onError?.(error);
        }
    });
}

/**
 * Listen for messages from the service worker
 */
export function onServiceWorkerMessage(handler) {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event) => {
            handler(event.data);
        });
    }
}

/**
 * Send message to service worker
 */
export function postToServiceWorker(data) {
    if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage(data);
    }
}

/**
 * Clear all caches
 */
export function clearServiceWorkerCache() {
    return new Promise((resolve, reject) => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.controller?.postMessage(
                { type: 'CLEAR_CACHE' },
                (error) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(true);
                    }
                }
            );
        } else {
            reject(new Error('Service Worker not available'));
        }
    });
}

/**
 * Update service worker
 */
export function updateServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
            registrations.forEach((registration) => {
                registration.update();
            });
        });
    }
}

/**
 * Check if app is running with service worker
 */
export async function isServiceWorkerActive() {
    if (!('serviceWorker' in navigator)) return false;
    try {
        const registration = await navigator.serviceWorker.getRegistration();
        return !!registration;
    } catch {
        return false;
    }
}

/**
 * Unregister service worker (for debugging)
 */
export async function unregisterServiceWorker() {
    if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
            await registration.unregister();
            console.log('Service Worker unregistered');
        }
    }
}

/**
 * INTEGRATION EXAMPLE for index.js:
 * 
 * import { registerServiceWorker } from './serviceWorkerRegistration';
 * 
 * registerServiceWorker({
 *   skipWaiting: false,
 *   onMount: ({ registration, isFirstInstall }) => {
 *     if (isFirstInstall) {
 *       console.log('App is PWA-ready for offline use');
 *     } else {
 *       console.log('Service Worker is running');
 *     }
 *   },
 *   onUpdate: ({ skipWaiting }) => {
 *     // Show toast: "New version available"
 *     // Button: "Update" -> skipWaiting()
 *     console.log('New version available');
 *   },
 *   onError: (error) => {
 *     console.error('SW registration failed:', error);
 *   },
 * });
 * 
 * // Use in components:
 * import { usePrefetchOnIdle } from './hooks/performanceHooks';
 * 
 * // This will load data when browser is idle
 * usePrefetchOnIdle(() => api.getTrendingListings());
 */
