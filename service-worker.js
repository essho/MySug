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

// **المنطق الجديد للإشعارات من Firebase**
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push Received.');
  const data = event.data.json();
  const title = data.notification.title || 'تنبيه';
  const options = {
    body: data.notification.body || 'حان الوقت الآن.',
    icon: './icons/icon-192x192.png',
    data: {
      url: data.fcmOptions.link || './alerts.html'
    }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// **المنطق الجديد للتعامل مع النقر على الإشعار**
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click received.');
  event.notification.close();
  const urlToOpen = event.notification.data.url;
  event.waitUntil(
    self.clients.openWindow(urlToOpen)
  );
});