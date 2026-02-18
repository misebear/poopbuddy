const CACHE_NAME = 'poopbuddy-v3';
const ASSETS = [
    '/',
    '/index.html',
    '/index.css',
    '/index.js',
    '/manifest.json',
    '/favicon.svg',
    '/firebase-config.js',
];

// Install — skip waiting immediately
self.addEventListener('install', e => {
    self.skipWaiting();
});

// Activate — clean ALL old caches immediately
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

// Fetch — NETWORK FIRST, fall back to cache only if offline
self.addEventListener('fetch', e => {
    e.respondWith(
        fetch(e.request).then(resp => {
            if (resp.ok && e.request.method === 'GET') {
                const clone = resp.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
            }
            return resp;
        }).catch(() => {
            return caches.match(e.request).then(cached => {
                if (cached) return cached;
                if (e.request.destination === 'document') {
                    return caches.match('/index.html');
                }
            });
        })
    );
});
