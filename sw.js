/* Livery Ledger service worker: lets the app open without a connection.
   - The site's own files: network first (always fresh when online), the saved copy when offline.
   - Your data from Supabase: network first, the last copy seen on this device when offline (read-only).
   - Photos and the Supabase library: saved once, then served from the device. */
const SHELL = "ll-shell-v1", DATA = "ll-data-v1", MEDIA = "ll-media-v1";
const CORE = ["./", "index.html", "css/styles.css", "js/config.js", "js/data/factions.js", "js/data/emblems.js",
  "js/data/presets.js", "js/art.js", "js/paints.js", "js/store.js", "js/app.js", "img/logo.svg", "manifest.webmanifest"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  const keep = [SHELL, DATA, MEDIA];
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => !keep.includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Logging out clears saved data so the next person on this device can't see it offline.
self.addEventListener("message", e => { if(e.data && e.data.type === "clear-data") caches.delete(DATA); });

async function networkFirst(req, cacheName, fallbackUrl){
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if(res && res.ok && res.type !== "opaque") cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch(err){
    const hit = await cache.match(req) || (fallbackUrl && await cache.match(fallbackUrl));
    if(hit) return hit;
    throw err;
  }
}
async function cacheFirst(req, cacheName){
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if(hit) return hit;
  const res = await fetch(req);
  if(res && (res.ok || res.type === "opaque")) cache.put(req, res.clone()).catch(() => {});
  return res;
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method !== "GET") return;
  const url = new URL(req.url);
  if(url.origin === location.origin){
    e.respondWith(networkFirst(req, SHELL, req.mode === "navigate" ? "index.html" : null));
  } else if(/\/storage\/v1\/object\/public\//.test(url.pathname) || url.hostname === "cdn.jsdelivr.net" || url.hostname === "fonts.gstatic.com"){
    e.respondWith(cacheFirst(req, MEDIA));
  } else if(/\/rest\/v1\//.test(url.pathname) || url.hostname === "fonts.googleapis.com"){
    e.respondWith(networkFirst(req, DATA));
  }
});
