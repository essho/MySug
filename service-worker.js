const CACHE_NAME = 'diabetes-app-cache-v4';
const urlsToCache = [
  "./",
  "./index.html",
  "./day.html",
  "./alerts.html",
  "./analytics.html",
  "./main.js",
  "./analytics.js",
  "./alerts.js",
  "./manifest.json",
  "./icons/icon-192x192.png",
  "./icons/icon-512x512.png"
];

// install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)).catch(err => {
      console.log('Failed to cache files:', err);
    })
  );
  self.skipWaiting();
});

// fetch
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});

// activate - clean old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names.map((n) => cacheWhitelist.includes(n) ? null : caches.delete(n))
    ))
  );
  self.clients.claim();
});
