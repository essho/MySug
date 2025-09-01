const CACHE_NAME = 'diabetes-app-cache-v3';
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

// حدث التثبيت: يتم تخزين الملفات مؤقتاً
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache');
      return cache.addAll(urlsToCache);
    }).catch(err => {
      console.log('Failed to cache files:', err);
    })
  );
});

// حدث الجلب: يتم عرض الملفات من الذاكرة المؤقتة أو الشبكة
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(event.request);
    })
  );
});

// حدث التفعيل: يتم حذف أي ذاكرة مؤقتة قديمة
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// حدث الإشعارات: يتم عرض الإشعارات للمستخدم
self.addEventListener('push', (event) => {
  const options = {
    body: event.data.text(),
    icon: './icons/icon-192x192.png',
    badge: './icons/icon-512x512.png'
  };

  event.waitUntil(
    self.registration.showNotification('تطبيق سكري', options)
  );
});