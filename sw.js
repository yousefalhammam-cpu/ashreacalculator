/* Air Calc Pro - Service Worker for Offline Access */
const cacheName = 'aircalc-pro-v3';
const assets = [
  './',
  './index.html',
  './app.js',
  './styles.css',
  './data.json',
  './manifest.webmanifest'
];

// Install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(cacheName).then(cache => cache.addAll(assets))
  );
  self.skipWaiting();
});

// Activate
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== cacheName).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(res => {
          // اختياري: نخزن الملفات المحلية فقط
          const url = new URL(event.request.url);
          if (url.origin === location.origin) {
            const resClone = res.clone();
            caches.open(cacheName).then(cache => cache.put(event.request, resClone));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});