import { headers } from "next/headers";
import { Webhook } from "svix";
import { ensureDbUser } from "@/lib/ensure-user";
import { db } from "@/lib/db";
import { cleanupBeforeUserDelete } from "@/lib/account-cleanup";

type ClerkEmailAddress = { id: string; email_address: string };
type ClerkUserData = {
  id: string;
  email_addresses?: ClerkEmailAddress[];
  primary_email_address_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
};

type ClerkEvent =
  | { type: "user.created"; data: { id: string } }
  | { type: "user.updated"; data: ClerkUserData }
  | { type: "user.deleted"; data: { id: string; deleted?: boolean } };

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    return new Response("Missing CLERK_WEBHOOK_SECRET", { status: 500 });
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const payload = await req.text();

  let event: ClerkEvent;
  try {
    const wh = new Webhook(WEBHOOK_SECRET);
    event = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as ClerkEvent;
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  switch (event.type) {
    case "user.created":
      // Single creation path shared with the lazy fallback in getCurrentUser:
      // creates the DB row + Stripe customer and attaches pending invites.
      await ensureDbUser(event.data.id);
      break;

    case "user.updated": {
      // Keep email/name/avatar in sync with Clerk. updateMany is a no-op if
      // the row doesn't exist yet (creation may not have landed).
      const d = event.data;
      const primaryEmail =
        d.email_addresses?.find((e) => e.id === d.primary_email_address_id)?.email_address ??
        d.email_addresses?.[0]?.email_address;
      const name = [d.first_name, d.last_name].filter(Boolean).join(" ") || null;
      await db.user.updateMany({
        where: { id: d.id },
        data: {
          ...(primaryEmail ? { email: primaryEmail } : {}),
          name,
          avatarUrl: d.image_url || null,
        },
      });
      break;
    }

    case "user.deleted":
      // Cancel billing + delete Blob photos first — neither cascades with
      // the DB delete, and the subscription id is destroyed by it. No-ops
      // when the row is already gone (e.g. deleteMyAccount ran first).
      await cleanupBeforeUserDelete(event.data.id);
      // Cascade-deletes the user's gardens, reminders, push subscriptions,
      // etc. (all relations are onDelete: Cascade). Without this, deleted
      // Clerk users linger and keep receiving reminder emails/pushes.
      // deleteMany is a graceful no-op if the row was never created.
      await db.user.deleteMany({ where: { id: event.data.id } });
      break;
  }

  return new Response("OK", { status: 200 });
}
