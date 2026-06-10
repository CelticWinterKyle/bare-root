// Bare Root service worker.
//
// Responsibilities:
//   1. Handle `push` events — render notifications for reminders sent
//      by the dispatch-reminders cron via web-push.
//   2. Handle `notificationclick` — open or focus the deep-link URL
//      carried in the push payload.
//   3. Serve a branded offline fallback (/offline.html) for navigation
//      requests when the network is unreachable. App pages and API
//      responses are deliberately NOT cached — the app is auth-sensitive
//      and force-dynamic, so only the precached fallback is served.
//
// Notes:
//   - Kept dependency-free so it works in any browser that supports
//     the Push API. No build step touches this file.
//   - skipWaiting + clients.claim let activated workers take over open
//     tabs immediately on first install, so the next push doesn't have
//     to wait for the user to reload.
//   - Bump OFFLINE_CACHE when offline.html changes so activate cleans
//     up the stale copy.

const OFFLINE_CACHE = "bareroot-offline-v1";
const OFFLINE_URL = "/offline.html";

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
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== OFFLINE_CACHE).map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  // Only intercept top-level navigations; everything else (API calls,
  // assets) goes straight to the network untouched.
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    (async () => {
      try {
        return await fetch(event.request);
      } catch {
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
