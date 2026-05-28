import { headers } from "next/headers";
import { Webhook } from "svix";
import { ensureDbUser } from "@/lib/ensure-user";

type ClerkUserCreatedEvent = {
  type: "user.created";
  data: { id: string };
};

type ClerkEvent = ClerkUserCreatedEvent;

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

  if (event.type === "user.created") {
    // Single creation path shared with the lazy fallback in getCurrentUser:
    // creates the DB row + Stripe customer and attaches pending invites.
    await ensureDbUser(event.data.id);
  }

  return new Response("OK", { status: 200 });
}
