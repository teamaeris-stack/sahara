const CACHE = "sahara-offline-v10-family-edit";
const CORE = ["/","/assets/leaflet-src-DHHFffMY.js","/assets/mobile-BvKjf2_T.js","/assets/mobile-ClzbSsVY.css","/assets/styles-BVPY2r5v.css","/audio/en/README.txt","/audio/hi/README.txt","/favicon.png","/index.html","/maps/README.md","/maps/aluva-context.geojson","/maps/aluva.osm","/robots.txt","/sahara-logo.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.all(CORE.map((url) => cache.add(url).catch(() => undefined)))),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;
  if (event.request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(fetch(event.request).then(response => {
      if(response.ok) caches.open(CACHE).then(cache=>cache.put(event.request,response.clone()));
      return response;
    }).catch(async()=> (await caches.match(event.request)) || (await caches.match('/index.html')) || (await caches.match('/')) || Response.error()));
    return;
  }
  // Connectivity probes must reach the network, never a cached response.
  if (url.searchParams.has("__sahara_probe")) return;
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          if (response.ok)
            caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
          return response;
        }),
    ),
  );
});
