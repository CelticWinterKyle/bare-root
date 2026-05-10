import { headers } from "next/headers";
import { Webhook } from "svix";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

type ClerkUserCreatedEvent = {
  type: "user.created";
  data: {
    id: string;
    email_addresses: Array<{ email_address: string; id: string }>;
    primary_email_address_id: string;
    first_name: string | null;
    last_name: string | null;
    image_url: string;
    public_metadata: Record<string, unknown>;
  };
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
    const { id, email_addresses, primary_email_address_id, first_name, last_name, image_url } = event.data;

    const primaryEmail = email_addresses.find(
      (e) => e.id === primary_email_address_id
    )?.email_address;

    if (!primaryEmail) {
      return new Response("No primary email", { status: 400 });
    }

    const fullName =
      [first_name, last_name].filter(Boolean).join(" ") || null;

    // Create Stripe customer
    const stripeCustomer = await stripe.customers.create({
      email: primaryEmail,
      name: fullName ?? undefined,
      metadata: { clerkUserId: id },
    });

    // Create user in DB
    await db.user.create({
      data: {
        id,
        email: primaryEmail,
        name: fullName,
        avatarUrl: image_url || null,
        stripeCustomerId: stripeCustomer.id,
        timezone: "America/New_York", // default — updated when user sets location
      },
    });

    // Check for pending garden invitations
    const pendingInvitations = await db.gardenInvitation.findMany({
      where: {
        email: primaryEmail,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (pendingInvitations.length > 0) {
      await db.$transaction(
        pendingInvitations.map((inv: (typeof pendingInvitations)[number]) =>
          db.gardenCollaborator.upsert({
            where: { gardenId_userId: { gardenId: inv.gardenId, userId: id } },
            create: {
              gardenId: inv.gardenId,
              userId: id,
              role: inv.role,
              acceptedAt: new Date(),
            },
            update: { acceptedAt: new Date() },
          })
        )
      );

      await db.gardenInvitation.updateMany({
        where: { email: primaryEmail, acceptedAt: null },
        data: { acceptedAt: new Date() },
      });
    }
  }

  return new Response("OK", { status: 200 });
}
