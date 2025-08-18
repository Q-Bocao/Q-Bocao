// sw.js — Q'Bocao turbo cache
const STATIC = 'qbocao-static-v1';
const API    = 'qbocao-api-v1';
const IMGS   = 'qbocao-img-v1';

const PRECACHE = ['./','./index.html','./product.html'];

self.addEventListener('install',(e)=>{ e.waitUntil((async()=>{ const c=await caches.open(STATIC); await c.addAll(PRECACHE); self.skipWaiting(); })()); });
self.addEventListener('activate',(e)=>{ e.waitUntil((async()=>{ const names=await caches.keys(); await Promise.all(names.filter(n=>![STATIC,API,IMGS].includes(n)).map(n=>caches.delete(n))); await self.clients.claim(); })()); });

self.addEventListener('fetch',(e)=>{
  const url=new URL(e.request.url);

  // CSV de Google Sheets (stale-while-revalidate)
  const isCSV = url.hostname==='docs.google.com' && url.pathname.includes('/spreadsheets/d/e/') && url.search.includes('output=csv');
  if(isCSV){
    e.respondWith((async()=>{ const cache=await caches.open(API); const cached=await cache.match(e.request);
      const refresh=fetch(e.request).then(async r=>{ try{ await cache.put(e.request, r.clone()); }catch{} return r; }).catch(()=>cached);
      return cached || refresh;
    })());
    return;
  }

  // Imágenes: Cache-First
  if(e.request.destination==='image'){
    e.respondWith((async()=>{ const cache=await caches.open(IMGS); const cached=await cache.match(e.request);
      if(cached) return cached;
      try{ const res=await fetch(e.request,{mode:'no-cors'}); try{ await cache.put(e.request,res.clone()); }catch{} return res; }
      catch{ return cached || Response.error(); }
    })());
    return;
  }

  // Navegación: Network-First
  if(e.request.mode==='navigate'){
    e.respondWith((async()=>{ try{ return await fetch(e.request); }catch{ const c=await caches.open(STATIC); return (await c.match('./index.html'))||Response.error(); } })());
  }
});
