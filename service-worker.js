
const CACHE_NAME = 'diabetes-app-cache-v3';
const urlsToCache = [
  "./index.html",
  "./day.html",
  "./alerts.html",
  "./analytics.html",
  "./main.js",
  "./analytics.js",
  "./alerts.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});
self.addEventListener('activate', (event) => {
  const keep=[CACHE_NAME];
  event.waitUntil(
    caches.keys().then(names => Promise.all(names.map(n => !keep.includes(n) && caches.delete(n))))
  );
});
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js')
    .then(registration => {
      console.log('Service Worker registered!');
    })
    .catch(error => {
      console.log('Service Worker registration failed:', error);
    });
}

