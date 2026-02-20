const CACHE_NAME = 'deposito-cache-v4';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    '/logo.png'
];

// Install Event
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Caching shell assets');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Activate Event
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
    // Only fetch GET requests
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request)
            .then((fetchRes) => {
                return caches.open(CACHE_NAME).then((cache) => {
                    const url = event.request.url;
                    if (url.startsWith(self.location.origin) &&
                        !url.includes('firestore') &&
                        !url.includes('googleapis')) {
                        cache.put(event.request, fetchRes.clone());
                    }
                    return fetchRes;
                });
            })
            .catch(() => {
                return caches.match(event.request).then((cacheRes) => {
                    if (cacheRes) return cacheRes;
                    if (event.request.mode === 'navigate') {
                        return caches.match('/index.html');
                    }
                });
            })
    );
});

