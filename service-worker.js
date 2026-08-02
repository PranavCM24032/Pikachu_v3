const CACHE_NAME = 'pykachu-hunt-v11';
const ASSETS = [
    'index.html',
    'css/bundle.min.css',
    'js/bundle.min.js',
    'manifest.json',
    'service-worker.js',
    'assets/img/ash.png',
    'assets/img/ash-2.png',
    'assets/img/ash-3.png',
    'assets/img/brock.png',
    'assets/img/jenny.png',
    'assets/img/joy.png',
    'assets/img/oak.png',
    'assets/img/officer-jenny.png',
    'assets/img/poketropy.png'
];

const DATA_URLS = [
    '/data/puzzle.json',
    '/data/teams.json',
    '/data/meme.json'
];

function isDataUrl(pathname) {
    return DATA_URLS.some((entry) => pathname.endsWith(entry));
}

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME) {
                        return caches.delete(name);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
        return;
    }

    if (isDataUrl(url.pathname)) {
        event.respondWith(networkFirst(event.request));
        return;
    }

    event.respondWith(
        caches.match(event.request).then((response) => {
            if (response && (response.ok || response.status === 0)) {
                return response;
            }
            return fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.ok) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
                }
                return networkResponse;
            }).catch(() => response);
        })
    );
});

function networkFirst(request) {
    return fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }
        return networkResponse;
    }).catch(() => caches.match(request));
}
