const CACHE_PREFIX = 'co-ty-phu-shell-';
const CACHE_VERSION = 'v3';
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './game.js',
  './ui.js',
  './gameLogic.js',
  './ai.js',
  './protocol.js',
  './websocket.js',
  './board3d.js',
  './board3d.css',
  './runtime-config.js',
  './manifest.webmanifest',
  './assets/icons/icon-192.svg',
  './assets/icons/icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(APP_SHELL.map(async (path) => {
      try {
        await cache.add(new Request(path, { cache: 'reload' }));
      } catch (error) {
        // A missing optional shell asset must not prevent installation.
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Never cache room creation or realtime game endpoints.
  if (url.pathname === '/ws' || url.pathname.startsWith('/api/')) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    const network = fetch(request).then((response) => {
      if (response && response.ok && response.type === 'basic') cache.put(request, response.clone());
      return response;
    });
    if (cached) {
      event.waitUntil(network.catch(() => undefined));
      return cached;
    }
    try { return await network; }
    catch (error) {
      if (request.mode === 'navigate') {
        const shell = await cache.match('./index.html');
        if (shell) return shell;
      }
      throw error;
    }
  })());
});
