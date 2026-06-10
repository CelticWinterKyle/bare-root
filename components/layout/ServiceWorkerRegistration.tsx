"use client";
import { useEffect } from "react";

/**
 * Registers the service worker on app load. The SW handles push
 * delivery, notification clicks, and falls back to a precached
 * /offline.html for navigations when the network is unreachable
 * (no app pages or API responses are cached). Registration is also
 * what lets the browser treat Bare Root as installable. Idempotent —
 * safe to mount on every render.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
      // SW registration failure isn't user-blocking — the app still
      // works without push. Surface to the console for debugging.
      console.warn("Service worker registration failed:", err);
    });

    // The SW posts a {type:"navigate", url} message after a notification
    // click so the focused tab can route to the right page.
    function onMessage(event: MessageEvent) {
      if (event.data?.type === "navigate" && typeof event.data.url === "string") {
        window.location.assign(event.data.url);
      }
    }
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  return null;
}
