const CACHE_NAME = 'levelup-v12';

// Only same-origin assets are precached; external URLs (Google Fonts, etc.)
// are cached opportunistically by the fetch handler. `addAll` is all-or-nothing,
// so including any URL that can fail (CORS, offline, blocked CDN) would break
// the entire install step.
const SHELL_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/main.js',
  './js/training.js',
  './js/storage.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

// Network-first with cache fallback. Only GET requests are handled;
// successful responses are written back into the cache so subsequent
// offline requests resolve from cache.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache valid (non-opaque, ok) responses to avoid polluting
        // the cache with error pages or non-cacheable cross-origin garbage.
        if (response && response.ok && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((hit) => hit || Response.error()))
  );
});
