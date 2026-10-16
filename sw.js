// AirCalc Pro — Service Worker
// Cache strategy:
//   Network-first for index.html
//   Cache-first for static assets

const CACHE_NAME = 'aircalcpro-v4';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './main.js',
  './data.json',
  './manifest.webmanifest',
  './js/core/state.js',
  './js/core/helpers.js',
  './js/core/storage.js',
  './js/core/i18n.js',
  './js/core/calc.js',
  './modules/plan.js',
  './modules/devices.js',
  './modules/history.js',
  './modules/duct.js',
  './modules/calc.js',
  './modules/quote.js',
  './modules/pdf.js',
  './modules/projects.js',
  './icon-192.png',
  './icon-512.png',
  './icon-1024.png',
  './home.png',
  './quotation.png'
];

// Install
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) {
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

// Activate
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function (name) { return name !== CACHE_NAME; })
          .map(function (name) { return caches.delete(name); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// Fetch
self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const pathname = url.pathname;
  const isHTML =
    pathname.endsWith('.html') ||
    pathname.endsWith('/') ||
    pathname === '/ashreacalculator/' ||
    pathname === '/ashreacalculator';

  if (isHTML) {
    event.respondWith(
      fetch(event.request)
        .then(function (response) {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(event.request, clone);
              cache.put('./index.html', clone.clone());
            });
          }
          return response;
        })
        .catch(function () {
          return caches.match(event.request)
            .then(function (cached) {
              return cached || caches.match('./index.html') || caches.match('./');
            });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;

      return fetch(event.request).then(function (response) {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    })
  );
});
