// sw.js — Q'Bocao turbo cache
const STATIC = 'qbocao-static-v2';
const API    = 'qbocao-api-v2';
const IMGS   = 'qbocao-img-v1';

const PRECACHE = ['./','./index.html','./product.html'];

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
    await Promise.all(names.filter(n => ![STATIC, API, IMGS].includes(n)).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // CSV de Google Sheets (stale-while-revalidate)
  const isSheetsCSV = url.hostname === 'docs.google.com' && url.pathname.includes('/spreadsheets/');
  if (isSheetsCSV) {
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

  // Imágenes: Cache-First
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

  // Navegación: Network-First con fallback
  if (e.request.mode === 'navigate') {
    e.respondWith((async () => {
      try { return await fetch(e.request); }
      catch {
        const cache = await caches.open(STATIC);
        return (await cache.match('./index.html')) || Response.error();
      }
    })());
  }
});
