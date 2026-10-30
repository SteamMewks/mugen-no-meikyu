 'use strict';
// 公開更新時は VERSION とHTML内の ?v= を更新してください。
const VERSION = "2026.10.30-2";
const PREFIX = 'mugen-pwa-' + encodeURIComponent(self.registration.scope) + '-';
const CACHE = PREFIX + VERSION;
const FILES = [
  "./assets/update-history.js?v=2026.10.30-2",
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/00-language-data.js?v=2026.10.30-2",
  "./assets/01-word-filter.js?v=2026.10.30-2",
  "./assets/02-game.js?v=2026.10.30-2",
  "./assets/03-enemy-symbols.js?v=2026.10.30-2",
  "./assets/04-viewport.js?v=2026.10.30-2",
  "./assets/05-living-dungeon.js?v=2026.10.30-2",
  "./assets/06-living-followers.js?v=2026.10.30-2",
  "./assets/07-living-events.js?v=2026.10.30-2",
  "./assets/08-audio.js?v=2026.10.30-2",
  "./assets/pwa.js?v=2026.10.30-2",
  "./assets/style.css?v=2026.10.30-2",
  "./icons/gate-v3-192.png",
  "./icons/gate-v3-512.png",
  "./icons/gate-v3-apple-touch.png",
  "./icons/gate-v3-maskable.png",
  "./icons/gate.svg"
];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(FILES.map(path => new Request(path, {cache:'reload'})));
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'GET_VERSION') {
    event.ports[0]?.postMessage({type:'VERSION', version:VERSION});
  }
  if (event.data?.type === 'ACTIVATE_IF_SINGLE_CLIENT') {
    event.waitUntil((async () => {
      const clients = await self.clients.matchAll({type:'window', includeUncontrolled:true});
      if (clients.length === 1 && clients[0].id === event.source?.id) await self.skipWaiting();
    })());
  }
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  const root = new URL(self.registration.scope);
  const isEntry = event.request.mode === 'navigate' &&
    (url.pathname === root.pathname || url.pathname === new URL('index.html', root).pathname);
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    return await cache.match(isEntry ? './index.html' : event.request) || fetch(event.request);
  })());
});
