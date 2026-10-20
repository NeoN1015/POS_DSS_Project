const CACHE_NAME = 'pos-dss-web-v2';
const PRECACHE = ['./index.html', './offline.html', './assets/css/app.css', './assets/icons/icon-192.png', './assets/icons/image-placeholder.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (new URL(event.request.url).pathname.includes('/api/')) return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request).then((hit) => {
      if (hit) return hit;
      if (event.request.mode === 'navigate') return caches.match('./offline.html');
      return Response.error();
    }))
  );
});
