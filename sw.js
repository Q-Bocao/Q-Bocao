// sw.js — Q'Bocao turbo cache
const STATIC = 'qbocao-static-v1';
const API    = 'qbocao-api-v1';
const IMGS   = 'qbocao-img-v1';

// Ajustá si cambia tu ruta (en GitHub Pages suele ser /<repo>/)
const PRECACHE = [
  './',
  './index.html',
  './product.html'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(STATIC);
    await c.addAll(PRECACHE);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.filter(n => ![STATIC, API, IMGS].includes(n)).map(n => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // 1) API de Apps Script: stale-while-revalidate
  const isAPI = url.hostname === 'script.google.com' && url.pathname.includes('/macros/');
  if (isAPI) {
    e.respondWith((async () => {
      const cache = await caches.open(API);
      const cached = await cache.match(e.request);
      const fetchAndUpdate = fetch(e.request).then(async (res) => {
        try { await cache.put(e.request, res.clone()); } catch {}
        return res;
      }).catch(() => cached);
      return cached || fetchAndUpdate;
    })());
    return;
  }

  // 2) Imágenes: Cache-First
  if (e.request.destination === 'image') {
    e.respondWith((async () => {
      const cache = await caches.open(IMGS);
      const cached = await cache.match(e.request);
      if (cached) return cached;
      try {
        const res = await fetch(e.request, { mode: 'no-cors' });
        try { await cache.put(e.request, res.clone()); } catch {}
        return res;
      } catch {
        return cached || Response.error();
      }
    })());
    return;
  }

  // 3) Navegación: Network-First con fallback
  if (e.request.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const net = await fetch(e.request);
        return net;
      } catch {
        const cache = await caches.open(STATIC);
        return (await cache.match('./index.html')) || Response.error();
      }
    })());
  }
});
