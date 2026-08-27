const CACHE_NAME = 'fm-v290';
const STATIC_ASSETS = [
  './index.html',
  './manifest.json',
  './sw.js',
  './dashboard-client.js',
  './calendar-client.js',
  './official-fixtures-seed-2026-27.json'
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
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') return;

  if (
    request.mode === 'navigate' ||
    request.url.endsWith('/index.html') ||
    request.url.endsWith('/dashboard-client.js') ||
    request.url.endsWith('/calendar-client.js') ||
    request.url.endsWith('/official-fixtures-seed-2026-27.json')
  ) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(response => {
          const copy = response.clone();
          const cacheKey = new URL(request.url).pathname.endsWith('/index.html')
            ? './index.html'
            : new URL(request.url).pathname;
          caches.open(CACHE_NAME).then(cache => cache.put(cacheKey, copy));
          return response;
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request))
  );
});
