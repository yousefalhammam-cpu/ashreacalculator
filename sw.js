// AirCalc Pro — Service Worker v3
// Cache strategy:
//   Network-first for index.html (always get latest shell)
//   Cache-first for all other static assets
//
// PRECACHE_ASSETS lists only files that actually exist in the repo.
// core/state.js and core/helpers.js are NOT listed because the app
// loads ./core.js as a single combined file. Listing non-existent
// paths causes cache.addAll() to throw, aborting the install event
// and preventing the SW from registering at all.

const CACHE_NAME = 'aircalcpro-v3';

const PRECACHE_ASSETS = [
  './index.html',
  './styles.css',
  './core.js',
  './app.js',
  './main.js',
  './data.json',
  './manifest.webmanifest',
  './modules/devices.js',
  './modules/history.js',
  './modules/duct.js',
  './modules/calc.js',
  './modules/quote.js',
  './modules/pdf.js',
  './modules/projects.js',
  './icon-192.png',
  './icon-512.png',
  './icon-1024.png'
];

// ── INSTALL: precache all static assets ──────────────────────────────────
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(function() {
        return self.skipWaiting();
      })
  );
});

// ── ACTIVATE: remove stale caches ────────────────────────────────────────
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys()
      .then(function(cacheNames) {
        return Promise.all(
          cacheNames
            .filter(function(name) { return name !== CACHE_NAME; })
            .map(function(name)   { return caches.delete(name);  })
        );
      })
      .then(function() {
        return self.clients.claim();
      })
  );
});

// ── FETCH: hybrid strategy ────────────────────────────────────────────────
self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // Only handle same-origin GET requests
  if (event.request.method !== 'GET') return;
  if (!url.startsWith(self.location.origin)) return;

  var isHTML = url.endsWith('.html') ||
               url.endsWith('/') ||
               url === self.location.origin + '/ashreacalculator/';

  if (isHTML) {
    // Network-first: always try to get the freshest shell
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
          return caches.match(event.request)
            .then(function(cached) {
              return cached || caches.match('./index.html');
            });
        })
    );
  } else {
    // Cache-first: serve instantly from cache, update in background
    event.respondWith(
      caches.match(event.request)
        .then(function(cached) {
          if (cached) return cached;
          return fetch(event.request)
            .then(function(response) {
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