// AirCalc Pro — Service Worker
// Cache strategy:
//   Network-first for index.html (always get latest shell)
//   Cache-first for all other static assets

const CACHE_NAME = 'aircalcpro-v2';

const PRECACHE_ASSETS = [
  './index.html',
  './styles.css',
  './app.js',
  './data.json',
  './manifest.webmanifest',
  './core/state.js',
  './core/helpers.js',
  './main.js',
  './icon-192.png',
  './icon-512.png',
  './icon-1024.png'
];

// ── INSTALL: precache all static assets ──────────────────────────────────
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(function() {
      return self.skipWaiting(); // activate immediately
    })
  );
});

// ── ACTIVATE: remove stale caches ────────────────────────────────────────
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function(name) { return name !== CACHE_NAME; })
          .map(function(name) { return caches.delete(name); })
      );
    }).then(function() {
      return self.clients.claim(); // take control immediately
    })
  );
});

// ── FETCH: hybrid strategy ────────────────────────────────────────────────
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  // Only handle same-origin GET requests
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  var pathname = url.pathname;
  var isHTML = pathname.endsWith('.html') || pathname.endsWith('/') || pathname === self.location.pathname.replace('/sw.js', '/');

  if (isHTML) {
    // Network-first for HTML: try network, fall back to cache
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          if (response && response.status === 200) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, clone);
            });
          }
          return response;
        })
        .catch(function() {
          return caches.match(event.request).then(function(cached) {
            return cached || caches.match('./index.html');
          });
        })
    );
  } else {
    // Cache-first for all other static assets (CSS, JS, JSON, images)
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        if (cached) return cached;
        return fetch(event.request).then(function(response) {
          if (response && response.status === 200) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, clone);
            });
          }
          return response;
        });
      })
    );
  }
});
