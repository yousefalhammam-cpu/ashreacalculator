// AirCalc Pro — Service Worker
// Cache strategy:
//   Network-first for index.html
//   Cache-first for static assets

const CACHE_NAME = 'aircalcpro-v28-audit-integrity';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './landing.css',
  './app/',
  './app/index.html',
  './styles.css',
  './assets/equipment-types/split.png',
  './assets/equipment-types/cassette.png',
  './assets/equipment-types/ducted.png',
  './assets/equipment-types/package.png',
  './assets/equipment-types/chiller.png',
  './assets/equipment-types/ahu.png',
  './assets/equipment-types/fcu.png',
  './assets/equipment-types/vrf.png',
  './assets/equipment-types/window.jpg',
  './assets/equipment-types/floor.webp',
  './app.js',
  './main.js',
  './data.bootstrap.js',
  './modules/hvac-design-copilot.js',
  './modules/equipment-selector.js',
  './modules/equipment-database.js',
  './modules/engineering-agent.js',
  './modules/rooms.js',
  './js/copilot/copilot-review-store.js',
  './js/copilot/copilot-ai-adapter.js',
  './js/copilot/copilot-health-engine.js',
  './js/copilot/copilot-state-adapter.js',
  './data/equipment-records.sample.js',
  './data/equipment-records.real.js',
  './data/equipment-manufacturers.js',
  './js/reports/professional-report-data-builder.js',
  './js/ai/ai-explanation-client.js',
  './js/ai/ai-config.js',
  './js/equipment/equipment-selection-engine.js',
  './js/equipment/equipment-import.js',
  './js/equipment/equipment-catalogue.js',
  './js/equipment/equipment-schema.js',
  './js/knowledge/engineering-knowledge-base.js',
  './js/core/engineering-calculation-engine.js',
  './js/firebase-auth.js',
  './data.json',
  './data/equipment-source-evidence.js',
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
  './assets/icons/apple-touch-icon.png',
  './assets/icons/favicon.ico',
  './assets/icons/favicon-16.png',
  './assets/icons/favicon-32.png',
  './assets/icons/favicon-48.png',
  './assets/icons/icon-48.png',
  './assets/icons/icon-72.png',
  './assets/icons/icon-96.png',
  './assets/icons/icon-120.png',
  './assets/icons/icon-128.png',
  './assets/icons/icon-144.png',
  './assets/icons/icon-152.png',
  './assets/icons/icon-167.png',
  './assets/icons/icon-180.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-256.png',
  './assets/icons/icon-384.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-1024.png',
  './assets/logo/logo-navbar.png',
  './assets/logo/logo-header.png',
  './assets/logo/logo-header@2x.png',
  './assets/logo/logo-mobile.png',
  './assets/logo/logo-splash.png',
  './assets/logo/logo-wide.png',
  './assets/logo/transparent-logo-navbar.png',
  './assets/logo/transparent-logo-header.png',
  './assets/logo/transparent-logo-header@2x.png',
  './assets/logo/transparent-logo-mobile.png',
  './assets/logo/transparent-logo-splash.png',
  './assets/logo/transparent-logo-wide.png',
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

// Cache each resource under its own URL. A script must never overwrite HTML.
self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const pathname = url.pathname;
  const isHTML = event.request.mode === 'navigate' || event.request.destination === 'document' ||
    pathname.endsWith('.html') || pathname.endsWith('/') || pathname.endsWith('/app');
  const isCodeOrData = /\.(?:js|css|json|webmanifest)$/.test(pathname);

  async function cachedResponse() {
    var cached = await caches.match(event.request);
    if (!cached) cached = await caches.match(event.request, { ignoreSearch:true });
    if (cached || !isHTML) return cached;
    var appPage = pathname.endsWith('/app') || pathname.indexOf('/app/') !== -1;
    return (await caches.match(appPage ? './app/index.html' : './index.html')) ||
      (await caches.match(appPage ? './app/' : './'));
  }

  async function fromNetwork() {
    var response = await fetch(event.request);
    if (response && response.status === 200) {
      var copy = response.clone();
      event.waitUntil(caches.open(CACHE_NAME).then(function(cache){ return cache.put(event.request, copy); }));
    }
    return response;
  }

  if (isHTML || isCodeOrData) {
    event.respondWith((async function(){
      try {
        var response = await fromNetwork();
        if (response && response.ok) return response;
        return (await cachedResponse()) || response;
      } catch (_err) {
        return (await cachedResponse()) || new Response('Offline resource unavailable', { status:503 });
      }
    })());
    return;
  }
  event.respondWith((async function(){
    return (await cachedResponse()) || fromNetwork();
  })());
});
