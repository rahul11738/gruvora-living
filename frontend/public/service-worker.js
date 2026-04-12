/*
    Service Worker for Gruvora React App

    Caching strategy summary:
    - App Shell / navigation: Network First with cache fallback to index.html
    - Static assets (js/css/fonts/images): Cache First
    - API calls: Network First with cache fallback

    This improves repeat visits and keeps the app usable offline.
*/

const SW_VERSION = 'gruvora-sw-v2';
const APP_SHELL_CACHE = `${SW_VERSION}-app-shell`;
const STATIC_CACHE = `${SW_VERSION}-static`;
const API_CACHE = `${SW_VERSION}-api`;

const APP_SHELL_FILES = ['/', '/index.html', '/manifest.json'];

const API_CACHE_TTL_MS = 5 * 60 * 1000;

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_FILES)).then(() => self.skipWaiting()),
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(keys.filter((key) => !key.startsWith(SW_VERSION)).map((key) => caches.delete(key))),
            )
            .then(() => self.clients.claim()),
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Do not touch non-GET requests.
    if (request.method !== 'GET') {
        return;
    }

    // Do not handle non-http(s).
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // Navigation requests: keep app working offline.
    if (request.mode === 'navigate') {
        event.respondWith(networkFirstNavigation(request));
        return;
    }

    // API: Network First.
    if (isApiRequest(request, url)) {
        event.respondWith(networkFirstApi(request));
        return;
    }

    // Static assets: Cache First.
    if (isStaticAssetRequest(request, url)) {
        event.respondWith(cacheFirstStatic(request));
        return;
    }
});

self.addEventListener('message', (event) => {
    if (!event.data || typeof event.data.type !== 'string') {
        return;
    }

    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

function isApiRequest(request, url) {
    if (request.destination !== '') {
        return false;
    }

    // Same-origin API or path contains /api/
    return url.pathname.startsWith('/api') || url.pathname.includes('/api/');
}

function isStaticAssetRequest(request, url) {
    if (request.destination === 'script' || request.destination === 'style' || request.destination === 'font') {
        return true;
    }

    if (request.destination === 'image') {
        return true;
    }

    // Handle build artifacts like /static/js/main.hash.js
    return url.pathname.startsWith('/static/');
}

async function networkFirstNavigation(request) {
    try {
        const networkResponse = await fetch(request);

        // Cache latest index/nav response for offline mode.
        const cache = await caches.open(APP_SHELL_CACHE);
        cache.put('/index.html', networkResponse.clone());

        return networkResponse;
    } catch (_error) {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        const offlineShell = await caches.match('/index.html');
        if (offlineShell) {
            return offlineShell;
        }

        return new Response('Offline', { status: 503, statusText: 'Offline' });
    }
}

async function cacheFirstStatic(request) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }

    try {
        const networkResponse = await fetch(request);
        if (isCacheable(networkResponse)) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (_error) {
        if (request.destination === 'image') {
            return new Response(
                '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="100%" height="100%" fill="#f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#6b7280" font-size="14">Offline image</text></svg>',
                { headers: { 'Content-Type': 'image/svg+xml' } },
            );
        }

        return new Response('', { status: 503, statusText: 'Offline' });
    }
}

async function networkFirstApi(request) {
    try {
        const networkResponse = await fetch(request);
        if (isCacheable(networkResponse)) {
            const cache = await caches.open(API_CACHE);
            const stampedResponse = await withTimestamp(networkResponse.clone());
            cache.put(request, stampedResponse);
        }
        return networkResponse;
    } catch (_error) {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            const timestamp = Number(cachedResponse.headers.get('sw-fetched-at') || '0');
            const isFresh = timestamp > 0 && Date.now() - timestamp <= API_CACHE_TTL_MS;
            if (isFresh || timestamp === 0) {
                return stripInternalHeaders(cachedResponse);
            }

            // Offline stale fallback is better than a hard error.
            return stripInternalHeaders(cachedResponse);
        }

        return new Response(JSON.stringify({ error: 'Offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

function isCacheable(response) {
    return !!response && (response.status === 200 || response.type === 'opaque');
}

function withTimestamp(response) {
    const headers = new Headers(response.headers);
    headers.set('sw-fetched-at', String(Date.now()));

    return response.blob().then(
        (body) =>
            new Response(body, {
                status: response.status,
                statusText: response.statusText,
                headers,
            }),
    );
}

function stripInternalHeaders(response) {
    const headers = new Headers(response.headers);
    headers.delete('sw-fetched-at');

    return response.blob().then(
        (body) =>
            new Response(body, {
                status: response.status,
                statusText: response.statusText,
                headers,
            }),
    );
}
