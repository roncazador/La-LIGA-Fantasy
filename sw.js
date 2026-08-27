const CACHE_NAME = 'fm-v252';
// Compatibilidad con el contrato histórico que validaba la migración fm-v251.
const LEGACY_CACHE_MARKER = 'fm-v251';
const STATIC_ASSETS = [
  './index.html',
  './manifest.json',
  './sw.js',
  './dashboard-client.js',
  './calendar-client.js',
  './data-client.js',
  './recording-client.js',
  './official-fixtures-seed-2026-27.json',
  './video-reference-snapshot-2026-08-27.json',
  './recording-data-2026-08-27.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const pathname = new URL(request.url).pathname;
  const freshResources = new Set([
    '/index.html',
    '/dashboard-client.js',
    '/calendar-client.js',
    '/data-client.js',
    '/recording-client.js',
    '/official-fixtures-seed-2026-27.json',
    '/video-reference-snapshot-2026-08-27.json',
    '/recording-data-2026-08-27.json'
  ]);

  if (request.mode === 'navigate' || freshResources.has(pathname)) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(response => {
          const copy = response.clone();
          const key = pathname.endsWith('/index.html') || request.mode === 'navigate' ? './index.html' : pathname;
          caches.open(CACHE_NAME).then(cache => cache.put(key, copy));
          return response;
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
});