const CACHE = "ashrae170p-pwa-v100";

const ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./data.json",
  "./manifest.webmanifest",
  "./sw.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c)=>c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => (k===CACHE)?null:caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((resp)=>{
      const copy = resp.clone();
      caches.open(CACHE).then(c=>c.put(req, copy)).catch(()=>{});
      return resp;
    }).catch(()=>cached))
  );
});
