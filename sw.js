const VERSION = '0f2ac2f35c220f40';
const CACHE_PREFIX = 'glissando:' + self.registration.scope + ':';
const CACHE_NAME = CACHE_PREFIX + VERSION;
const ASSETS = ['index.html', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];
const assetURLs = ASSETS.map(path => new URL(path, self.registration.scope).href);
const indexURL = assetURLs[0];

self.addEventListener('install', event => {
  // Install the whole release atomically; never activate over an open performance.
  event.waitUntil(caches.open(CACHE_NAME).then(cache =>
    cache.addAll(assetURLs.map(url => new Request(url, { cache: 'reload' })))
  ));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'OFFLINE_STATUS' && event.ports[0]) {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE_NAME);
      for (const url of assetURLs) {
        if (!await cache.match(url)) { event.ports[0].postMessage(false); return; }
      }
      event.ports[0].postMessage(true);
    })());
    return;
  }
  if (event.data?.type !== 'ACTIVATE_WHEN_SOLO' || !event.source || !event.ports[0]) return;
  event.waitUntil((async () => {
    const clients = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .filter(client => client.url.startsWith(self.registration.scope));
    const reply = event.ports[0];
    if (clients.length !== 1 || clients[0].id !== event.source.id) {
      reply.postMessage('other-tabs');
    } else if (!Number.isFinite(event.data.expires) || Date.now() > event.data.expires) {
      reply.postMessage('expired');
    } else {
      reply.postMessage('activating');
      await self.skipWaiting();
    }
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin) return;
  const appNavigation = request.mode === 'navigate' &&
    (url.pathname === scope.pathname || url.pathname === new URL(indexURL).pathname);
  // Leave the copy editor, its fresh HTML fetches, analytics, and other Pages sites alone.
  const asset = assetURLs.slice(1).includes(url.href);
  if (!appNavigation && !asset) return;
  event.respondWith((async () => {
    const cached = await (await caches.open(CACHE_NAME)).match(appNavigation ? indexURL : request);
    return cached || fetch(request);
  })());
});
