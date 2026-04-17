/*
    Gruvora Living production service worker.

    Strategy overview:
    - Navigation requests use network-first with an offline HTML fallback.
    - Static app shell assets use cache-first for fast repeat loads.
    - Public API responses use stale-while-revalidate.
    - Cloudinary images/videos use cache-first or stale-while-revalidate depending on the asset type.
    - Sensitive authenticated API responses are never cached.
*/

const CACHE_VERSION = 'gruvora-living-v1';
const PRECACHE_NAME = `${CACHE_VERSION}-precache`;
const STATIC_NAME = `${CACHE_VERSION}-static`;
const API_NAME = `${CACHE_VERSION}-api`;
const MEDIA_NAME = `${CACHE_VERSION}-media`;

const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/offline.html',
    '/manifest.json',
    '/icons/icon-192.svg',
    '/icons/icon-512.svg',
];

const OFFLINE_JSON = JSON.stringify({
    error: 'offline',
    message: 'This resource is unavailable while offline.',
});

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(PRECACHE_NAME);
        await cache.addAll(PRECACHE_URLS);
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(
            keys
                .filter((key) => !key.startsWith(CACHE_VERSION))
                .map((key) => caches.delete(key)),
        );
        await self.clients.claim();
    })());
});

self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
        return;
    }

    if (request.mode === 'navigate') {
        event.respondWith(handleNavigationRequest(request));
        return;
    }

    if (isStaticAssetRequest(request, url)) {
        event.respondWith(cacheFirst(request, STATIC_NAME));
        return;
    }

    if (isCloudinaryAsset(url)) {
        event.respondWith(handleMediaRequest(request, url));
        return;
    }

    if (isPublicApiRequest(request, url)) {
        event.respondWith(staleWhileRevalidateApi(request));
    }
});

async function handleNavigationRequest(request) {
    try {
        const networkResponse = await fetch(request);
        const cache = await caches.open(PRECACHE_NAME);
        cache.put('/index.html', networkResponse.clone());
        return networkResponse;
    } catch (_error) {
        const cachedShell = await caches.match('/index.html');
        if (cachedShell) {
            return cachedShell;
        }

        const offlinePage = await caches.match('/offline.html');
        if (offlinePage) {
            return offlinePage;
        }

        return new Response('<!doctype html><title>Offline</title><h1>Offline</h1>', {
            status: 503,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
    }
}

async function cacheFirst(request, cacheName) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }

    try {
        const networkResponse = await fetch(request);
        if (isCacheableResponse(networkResponse)) {
            const cache = await caches.open(cacheName);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (_error) {
        if (request.destination === 'image') {
            return offlineImageResponse();
        }

        return new Response('', { status: 503, statusText: 'Offline' });
    }
}

async function handleMediaRequest(request, url) {
    if (request.destination === 'video' && request.headers.has('range')) {
        return fetch(request);
    }

    const cache = await caches.open(MEDIA_NAME);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
        eventlessRevalidate(request, cache, url);
        return cachedResponse;
    }

    try {
        const networkResponse = await fetch(request);
        const shouldStoreMedia = request.destination !== 'video' || !request.headers.has('range');
        if (isCacheableResponse(networkResponse) && shouldStoreMedia) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (_error) {
        if (request.destination === 'image') {
            return offlineImageResponse();
        }
        return new Response('', { status: 503, statusText: 'Offline' });
    }
}

function eventlessRevalidate(request, cache, url) {
    if (!isCacheableMediaUrl(url) || request.headers.has('range')) {
        return;
    }

    fetch(request)
        .then((response) => {
            if (isCacheableResponse(response)) {
                cache.put(request, response.clone());
            }
        })
        .catch(() => {
            // Cache hits should still work even when revalidation fails.
        });
}

async function staleWhileRevalidateApi(request) {
    const cache = await caches.open(API_NAME);
    const cachedResponse = await cache.match(request);

    const networkPromise = fetch(request)
        .then(async (response) => {
            if (shouldCacheApiResponse(request, response)) {
                await cache.put(request, response.clone());
            }
            return response;
        })
        .catch(() => null);

    if (cachedResponse) {
        networkPromise.catch(() => { });
        return cachedResponse;
    }

    const networkResponse = await networkPromise;
    if (networkResponse) {
        return networkResponse;
    }

    return new Response(OFFLINE_JSON, {
        status: 503,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}

function shouldCacheApiResponse(request, response) {
    if (!isCacheableResponse(response)) {
        return false;
    }

    if (request.headers.has('authorization') || request.headers.has('cookie')) {
        return false;
    }

    const cacheControl = String(response.headers.get('cache-control') || '').toLowerCase();
    if (cacheControl.includes('no-store') || cacheControl.includes('private')) {
        return false;
    }

    return !isSensitiveApiPath(new URL(request.url).pathname);
}

function isSensitiveApiPath(pathname) {
    return [
        '/api/auth',
        '/api/login',
        '/api/register',
        '/api/profile',
        '/api/users/me',
        '/api/settings',
        '/api/admin',
        '/api/notifications',
        '/api/messages',
        '/api/chat',
        '/api/payments',
        '/api/billing',
        '/api/transactions',
        '/api/wallet',
    ].some((segment) => pathname.startsWith(segment));
}

function isPublicApiRequest(request, url) {
    if (request.headers.has('authorization') || request.headers.has('cookie')) {
        return false;
    }

    if (!url.pathname.startsWith('/api/')) {
        return false;
    }

    return !isSensitiveApiPath(url.pathname);
}

function isStaticAssetRequest(request, url) {
    if (request.destination === 'script' || request.destination === 'style' || request.destination === 'font') {
        return true;
    }

    if (request.destination === 'image') {
        return true;
    }

    return url.pathname.startsWith('/static/') || url.pathname.startsWith('/assets/');
}

function isCloudinaryAsset(url) {
    return url.hostname === 'res.cloudinary.com' && (url.pathname.includes('/image/upload/') || url.pathname.includes('/video/upload/'));
}

function isCacheableMediaUrl(url) {
    return isCloudinaryAsset(url);
}

function isCacheableResponse(response) {
    return Boolean(response) && (response.ok || response.type === 'opaque');
}

function offlineImageResponse() {
    return new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><rect width="960" height="540" fill="#0f172a"/><rect x="90" y="90" width="780" height="360" rx="28" fill="#111827"/><path d="M250 350l122-132 82 88 53-58 143 102H250z" fill="#334155"/><circle cx="612" cy="196" r="32" fill="#334155"/><text x="480" y="468" font-family="Arial,sans-serif" font-size="28" text-anchor="middle" fill="#cbd5e1">Offline image unavailable</text></svg>',
        { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' } },
    );
}
