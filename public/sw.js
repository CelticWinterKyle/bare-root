// Bare Root service worker.
//
// Responsibilities:
//   1. Handle `push` events — render notifications for reminders sent
//      by the dispatch-reminders cron via web-push.
//   2. Handle `notificationclick` — open or focus the deep-link URL
//      carried in the push payload.
//
// Notes:
//   - Kept dependency-free so it works in any browser that supports
//     the Push API. No build step touches this file.
//   - skipWaiting + clients.claim let activated workers take over open
//     tabs immediately on first install, so the next push doesn't have
//     to wait for the user to reload.

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
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
