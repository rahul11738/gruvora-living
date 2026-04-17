const SERVICE_WORKER_URL = '/service-worker.js';

/**
 * Register the production service worker after the window load event.
 * The callback contract keeps update handling in React while the SW logic
 * stays isolated from UI state.
 */
export function registerServiceWorker(config = {}) {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        return () => { };
    }

    if (process.env.NODE_ENV !== 'production') {
        return () => { };
    }

    const {
        onReady,
        onUpdate,
        onError,
    } = config;

    let isRefreshing = false;

    const handleControllerChange = () => {
        if (isRefreshing) return;
        isRefreshing = true;
        window.location.reload();
    };

    const register = async () => {
        try {
            const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL, {
                scope: '/',
            });

            navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

            const triggerUpdate = () => {
                if (!navigator.serviceWorker.controller) {
                    return;
                }

                onUpdate?.({
                    registration,
                    applyUpdate: () => {
                        if (registration.waiting) {
                            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                        }
                    },
                });
            };

            if (registration.waiting) {
                triggerUpdate();
            }

            registration.addEventListener('updatefound', () => {
                const installingWorker = registration.installing;
                if (!installingWorker) return;

                installingWorker.addEventListener('statechange', () => {
                    if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        triggerUpdate();
                    }
                });
            });

            onReady?.({ registration, isFirstInstall: !navigator.serviceWorker.controller });
            return registration;
        } catch (error) {
            onError?.(error);
            return null;
        }
    };

    const onWindowLoad = () => {
        void register();
    };

    if (document.readyState === 'complete') {
        void register();
    } else {
        window.addEventListener('load', onWindowLoad, { once: true });
    }

    return () => {
        window.removeEventListener('load', onWindowLoad);
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
}

/**
 * Send a message to the active service worker if one is controlling the page.
 */
export function postToServiceWorker(message) {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker?.controller) {
        return false;
    }

    navigator.serviceWorker.controller.postMessage(message);
    return true;
}

/**
 * Ask the browser to re-check for a newer service worker version.
 */
export function updateServiceWorker() {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
        return Promise.resolve(false);
    }

    return navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
            registration.update();
        });
        return true;
    });
}

/**
 * Minimal runtime helper for debugging or admin utilities.
 */
export async function isServiceWorkerActive() {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
        return false;
    }

    try {
        const registration = await navigator.serviceWorker.getRegistration();
        return Boolean(registration?.active);
    } catch (_error) {
        return false;
    }
}
