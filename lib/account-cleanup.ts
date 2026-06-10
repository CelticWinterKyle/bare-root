import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

/**
 * Pre-delete cleanup for an account: cancel any active Stripe subscription
 * and remove uploaded photo files from Blob storage. Must run BEFORE the
 * user row is deleted — the subscription id and photo URLs are destroyed by
 * the cascade. Both steps are best-effort: a provider hiccup must never
 * block the user's right to delete their account, but failures are logged
 * so they can be reconciled by hand.
 */
export async function cleanupBeforeUserDelete(userId: string): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { stripeSubscriptionId: true },
  });
  if (!user) return;

  if (user.stripeSubscriptionId) {
    try {
      await stripe.subscriptions.cancel(user.stripeSubscriptionId);
    } catch (err) {
      console.error(`Stripe cancel failed for user ${userId}:`, err);
    }
  }

  // Photo files live in public Blob storage and do NOT cascade with the DB
  // delete; without this they'd be orphaned (and publicly reachable) forever.
  const photos = await db.plantingPhoto.findMany({
    where: { planting: { cell: { bed: { garden: { userId } } } } },
    select: { url: true },
  });
  if (photos.length > 0) {
    try {
      const { del } = await import("@vercel/blob");
      await del(photos.map((p) => p.url));
    } catch (err) {
      console.error(`Blob cleanup failed for user ${userId}:`, err);
    }
  }
}
