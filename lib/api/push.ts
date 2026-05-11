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

export async function sendPushNotification(
  subscription: { endpoint: string; p256dhKey: string; authKey: string },
  payload: PushPayload
): Promise<boolean> {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dhKey, auth: subscription.authKey },
      },
      JSON.stringify(payload)
    );
    return true;
  } catch (err: unknown) {
    // 410 Gone = subscription expired, caller should delete it
    if (err && typeof err === "object" && "statusCode" in err && (err as { statusCode: number }).statusCode === 410) {
      return false;
    }
    console.error("Push send error:", err);
    return false;
  }
}
