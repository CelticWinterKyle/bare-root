// Bare Root service worker.
//
// Responsibilities:
//   1. Handle `push` events — render notifications for reminders sent
//      by the dispatch-reminders cron via web-push.
//   2. Handle `notificationclick` — open or focus the deep-link URL
//      carried in the push payload.
//   3. Offline support: cache the /offline app document (which renders the
//      user's beds from IndexedDB) + immutable /_next/static assets, and
//      fall back to it for any failed navigation (then the static
//      offline.html). Authed app pages and API responses are otherwise
//      deliberately NOT cached.
//
// Notes:
//   - Kept dependency-free so it works in any browser that supports
//     the Push API. No build step touches this file.
//   - skipWaiting + clients.claim let activated workers take over open
//     tabs immediately on first install, so the next push doesn't have
//     to wait for the user to reload.
//   - Bump OFFLINE_CACHE when offline.html changes so activate cleans
//     up the stale copy.

const OFFLINE_CACHE = "bareroot-offline-v2";
const ASSET_CACHE = "bareroot-assets-v1";
const OFFLINE_URL = "/offline.html";
const OFFLINE_APP_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(OFFLINE_CACHE);
      // `cache: "reload"` bypasses the HTTP cache so each new SW version
      // precaches a fresh copy of the fallback page.
      await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([OFFLINE_CACHE, ASSET_CACHE]);
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Hashed Next.js build assets are immutable — cache-first with runtime
  // fill so the /offline app shell's JS/CSS loads with no network.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        const res = await fetch(event.request);
        if (res.ok) {
          const cache = await caches.open(ASSET_CACHE);
          cache.put(event.request, res.clone());
        }
        return res;
      })()
    );
    return;
  }

  // The /offline document: cache the full-HTML copy on real navigations and
  // on OfflineSync's explicit prime fetch (x-offline-prime header). RSC
  // payload requests for the same path are deliberately NOT cached — they'd
  // overwrite the document with a flight payload.
  const isOfflineDoc =
    url.pathname === OFFLINE_APP_URL &&
    event.request.method === "GET" &&
    (event.request.mode === "navigate" || event.request.headers.get("x-offline-prime") === "1");

  if (isOfflineDoc) {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(event.request);
          if (res.ok) {
            const cache = await caches.open(OFFLINE_CACHE);
            cache.put(OFFLINE_APP_URL, res.clone());
          }
          return res;
        } catch {
          const offlineApp = await caches.match(OFFLINE_APP_URL);
          if (offlineApp) return offlineApp;
          const cached = await caches.match(OFFLINE_URL);
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // Other top-level navigations: network-first; any failure falls back to
  // the cached /offline app (IndexedDB-rendered beds), then the static
  // offline.html. API calls and server actions are untouched.
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    (async () => {
      try {
        return await fetch(event.request);
      } catch {
        const offlineApp = await caches.match(OFFLINE_APP_URL);
        if (offlineApp) return offlineApp;
        const cached = await caches.match(OFFLINE_URL);
        return cached || Response.error();
      }
    })()
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    // Some browsers deliver string payloads; surface them as a body-only
    // notification rather than dropping the event.
    payload = { title: "Bare Root", body: event.data.text(), url: "/reminders" };
  }

  const title = payload.title || "Bare Root";
  const options = {
    body: payload.body || "",
    icon: "/icon",
    badge: "/icon",
    tag: payload.tag || undefined,
    data: { url: payload.url || "/reminders" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/reminders";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // If the app is already open in a tab, focus that and navigate.
      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(targetUrl);
            } catch {
              // navigation can fail across origins; ignore and let the
              // focused tab handle it via the message below.
            }
          }
          client.postMessage({ type: "navigate", url: targetUrl });
          return;
        }
      }
      // Otherwise open a new window.
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});
