// Browser-side helpers for registering the service worker and
// subscribing to web push. Server actions live in lib/api/push.ts.

const SW_PATH = "/sw.js";

export type PushSupport =
  | { kind: "supported" }
  | { kind: "no-window" }
  | { kind: "missing-sw" }
  | { kind: "missing-push" }
  | { kind: "missing-vapid" }
  | { kind: "permission-denied" };

export function checkPushSupport(): PushSupport {
  if (typeof window === "undefined") return { kind: "no-window" };
  if (!("serviceWorker" in navigator)) return { kind: "missing-sw" };
  if (!("PushManager" in window)) return { kind: "missing-push" };
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return { kind: "missing-vapid" };
  if (Notification.permission === "denied") return { kind: "permission-denied" };
  return { kind: "supported" };
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) view[i] = rawData.charCodeAt(i);
  return buffer;
}

async function getOrRegisterWorker(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration(SW_PATH);
  if (existing) return existing;
  return navigator.serviceWorker.register(SW_PATH, { scope: "/" });
}

/**
 * Idempotent: ensures the service worker is registered, prompts for
 * notification permission if needed, subscribes the user via the
 * PushManager, and POSTs the subscription to the server.
 *
 * Throws on permission denial or VAPID misconfiguration so the caller
 * can surface a meaningful toast.
 */
export async function subscribeToPush(): Promise<void> {
  const support = checkPushSupport();
  if (support.kind !== "supported") {
    throw new Error(supportErrorMessage(support));
  }

  const permission =
    Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;

  if (permission !== "granted") {
    throw new Error(
      "Browser notifications are blocked. Enable them in your browser settings to receive push alerts."
    );
  }

  const registration = await getOrRegisterWorker();

  // serviceWorker.ready can hang indefinitely if the SW is stuck in
  // `installing` (parse error, redundant worker, etc). Cap it so the
  // caller can surface a real error instead of a permanent spinner.
  await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Service worker didn't activate. Try refreshing the page.")), 10_000)
    ),
  ]);

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
      ),
    });
  }

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });

  if (!res.ok) {
    throw new Error("Couldn't register this device for push.");
  }
}

function supportErrorMessage(s: PushSupport): string {
  switch (s.kind) {
    case "missing-sw":
    case "missing-push":
      return "Push notifications aren't supported in this browser.";
    case "missing-vapid":
      return "Push isn't configured on the server yet. Try again later.";
    case "permission-denied":
      return "Browser notifications are blocked. Enable them in your browser settings.";
    default:
      return "Push isn't available right now.";
  }
}
