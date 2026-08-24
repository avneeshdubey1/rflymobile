const CACHE = 'field-operations-shell-v3';
const SHELL_URL = '/';

function isPrivateRequest(request, url) {
  return request.method !== 'GET'
    || url.origin !== self.location.origin
    || url.pathname.startsWith('/api/')
    || url.pathname.startsWith('/socket.io/')
    || request.headers.has('Authorization')
    || request.cache === 'no-store';
}

function canCacheResponse(response) {
  if (!response?.ok || response.type !== 'basic') return false;
  const cacheControl = response.headers.get('Cache-Control') || '';
  return !/(?:^|,)\s*(?:private|no-store)\b/i.test(cacheControl)
    && !response.headers.has('Set-Cookie');
}

function isStaticResource(request, url) {
  return url.pathname.startsWith('/assets/')
    || url.pathname.startsWith('/icons/')
    || url.pathname === '/manifest.webmanifest'
    || ['script', 'style', 'font', 'image'].includes(request.destination);
}

async function cacheIfSafe(request, response) {
  if (canCacheResponse(response)) {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    fetch(SHELL_URL, { cache: 'no-store' })
      .then((response) => cacheIfSafe(SHELL_URL, response))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // API, Socket.IO, authenticated, cross-origin, and non-GET requests always
  // use the network. They never receive the cached application shell.
  if (isPrivateRequest(event.request, url)) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => cacheIfSafe(SHELL_URL, response))
        .catch(() => caches.match(SHELL_URL)),
    );
    return;
  }

  if (!isStaticResource(event.request, url)) return;
  event.respondWith(
    caches.match(event.request)
      .then((cached) => cached || fetch(event.request).then((response) => cacheIfSafe(event.request, response))),
  );
});
