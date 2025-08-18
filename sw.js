// sw.js — Q'Bocao turbo cache (CSV + imágenes)
const STATIC = 'qbocao-static-v2';
const DATA   = 'qbocao-data-v2';   // CSV / datos
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
      names.filter(n => ![STATIC, DATA, IMGS].includes(n)).map(n => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // 1) CSV de Google Sheets (publicado): stale-while-revalidate
  const isCSV =
    url.hostname === 'docs.google.com' &&
    url.pathname.includes('/spreadsheets/') &&
    (url.search.includes('output=csv') || url.search.includes('format=csv') || url.search.includes('tqx=out:csv'));

  if (isCSV) {
    e.respondWith((async () => {
      const cache = await caches.open(DATA);
      const cached = await cache.match(e.request);
      const fetchAndUpdate = fetch(e.request, { cache: 'no-store' }).then(async (res) => {
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

  // 3) Navegación: Network-First con fallback a index
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
