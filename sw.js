// The deploy workflow replaces __BUILD__ with the commit id, so every deploy ships a changed
// worker: the browser installs it, refreshes all cached files and the page offers a reload.
const BUILD='__BUILD__';
const CACHE='shot-timer-'+BUILD;
const CORE=['./','./index.html','./manifest.webmanifest','./icon-180.png','./icon-192.png','./icon-512.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys()
    .then(keys=>Promise.all(keys.filter(k=>k.startsWith('shot-timer-')&&k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim()));
});

// Page: try network briefly (fresh version when online), otherwise cached copy.
async function pageFirst(req){
  const cache=await caches.open(CACHE);
  const net=fetch(req).then(res=>{
    if(res&&res.ok)cache.put('./index.html',res.clone());
    return res;
  });
  net.catch(()=>{});
  const timeout=new Promise(resolve=>setTimeout(resolve,2500,null));
  try{
    const res=await Promise.race([net,timeout]);
    // An error page (e.g. 404 while the site is unpublished) must not replace a working cached app.
    if(res&&res.ok)return res;
  }catch(e){}
  const cached=await cache.match('./index.html');
  return cached||net;
}
async function cacheFirst(req){
  const cache=await caches.open(CACHE);
  const hit=await cache.match(req,{ignoreSearch:true});
  if(hit)return hit;
  const res=await fetch(req);
  if(res&&(res.ok||res.type==='opaque'))cache.put(req,res.clone());
  return res;
}
async function staleWhileRevalidate(req){
  const cache=await caches.open(CACHE);
  const hit=await cache.match(req);
  const net=fetch(req).then(res=>{
    if(res&&(res.ok||res.type==='opaque'))cache.put(req,res.clone());
    return res;
  }).catch(()=>hit);
  return hit||net;
}

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(req.mode==='navigate'){e.respondWith(pageFirst(req));return;}
  if(url.origin===self.location.origin){e.respondWith(cacheFirst(req));return;}
  if(url.hostname==='fonts.googleapis.com'||url.hostname==='fonts.gstatic.com'){e.respondWith(staleWhileRevalidate(req));}
});
