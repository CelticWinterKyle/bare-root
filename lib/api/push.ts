import webpush from "web-push";

webpush.setVapidDetails(
  `mailto:${process.env.VAPID_CONTACT_EMAIL ?? "hello@bareroot.garden"}`,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

// "gone" = the subscription is permanently dead and should be deleted.
// "transient" = the push service hiccuped (timeout, 429, 5xx); the
// subscription is still valid and must NOT be deleted, or one provider
// outage during a big dispatch silently unsubscribes every device.
export type PushSendResult = "sent" | "gone" | "transient";

export async function sendPushNotification(
  subscription: { endpoint: string; p256dhKey: string; authKey: string },
  payload: PushPayload
): Promise<PushSendResult> {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dhKey, auth: subscription.authKey },
      },
      JSON.stringify(payload)
    );
    return "sent";
  } catch (err: unknown) {
    const statusCode =
      err && typeof err === "object" && "statusCode" in err
        ? (err as { statusCode: number }).statusCode
        : undefined;
    // 410 Gone / 404 = subscription expired or unsubscribed at the push service.
    if (statusCode === 410 || statusCode === 404) return "gone";
    console.error("Push send error:", err);
    return "transient";
  }
}
