/*
 * spotify-calendar's service worker. One job: an offline page for navigations.
 *
 * It deliberately caches nothing else. The library already lives on the device
 * (IndexedDB, per Spotify account), so caching the view shells and their
 * scripts would make the calendar open offline — but every deploy renames
 * those scripts, and a worker serving last month's shell against this month's
 * server is the kind of bug nobody can see from a phone. That trade was judged
 * not worth it for a self-hosted app reached on the home network
 * (docs/memory/frontend.md, "Installed app"). So pages, API calls and assets
 * all go to the network as if no worker existed; only when a page load gets no
 * response at all (no network, the server down, off the VPN) does the worker
 * answer, with offline.html.
 *
 * Only GET navigations are touched. Everything else — fetch() from the pages,
 * the logout POST, _next/static, covers from Spotify's CDN — is not
 * intercepted, so the browser handles it natively. Redirects (the Sésame gate,
 * the Spotify sign-in round trip) pass through untouched: a navigation's fetch
 * returns the redirect itself, which the browser then follows.
 *
 * Bump VERSION when offline.html changes, so the new copy replaces the old.
 */
const VERSION = "v1";
const CACHE = `sc-offline-${VERSION}`;
const OFFLINE_URL = new URL("offline.html", self.registration.scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("sc-offline-") && k !== CACHE).map((k) => caches.delete(k)));
      // Navigation preload: the page request starts while the worker boots, so
      // intercepting navigations costs no extra latency on a cold start.
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.mode !== "navigate" || request.method !== "GET") return;
  event.respondWith(
    (async () => {
      try {
        const preloaded = await event.preloadResponse;
        if (preloaded) return preloaded;
        return await fetch(request);
      } catch {
        // fetch() rejects only when no response came back at all; a 500 or a
        // 502 from a proxy is a response and is shown as such.
        return (await caches.match(OFFLINE_URL)) ?? Response.error();
      }
    })(),
  );
});
