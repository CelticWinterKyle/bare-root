import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

/**
 * Ensure a DB User row exists for a Clerk user id. The Clerk `user.created`
 * webhook is the primary creation path, but it can lag or fail; without a
 * fallback an authenticated user with no row gets bounced to /sign-in while
 * appearing logged in. This is the idempotent, race-safe lazy fallback,
 * also reused by the webhook so there's a single creation path.
 */
export async function ensureDbUser(clerkUserId: string) {
  const existing = await db.user.findUnique({ where: { id: clerkUserId } });
  if (existing) return existing;

  const client = await clerkClient();
  const cu = await client.users.getUser(clerkUserId);
  const primaryEmail =
    cu.emailAddresses.find((e) => e.id === cu.primaryEmailAddressId)?.emailAddress ??
    cu.emailAddresses[0]?.emailAddress;
  if (!primaryEmail) throw new Error("No primary email for user");
  const fullName = [cu.firstName, cu.lastName].filter(Boolean).join(" ") || null;

  let stripeCustomerId: string | undefined;
  try {
    const customer = await stripe.customers.create({
      email: primaryEmail,
      name: fullName ?? undefined,
      metadata: { clerkUserId },
    });
    stripeCustomerId = customer.id;
  } catch {
    // Non-fatal: the app still works without billing wired up, and the
    // billing page self-heals by looking the customer up by email.
  }

  const user = await db.user.upsert({
    where: { id: clerkUserId },
    create: {
      id: clerkUserId,
      email: primaryEmail,
      name: fullName,
      avatarUrl: cu.imageUrl || null,
      stripeCustomerId,
    },
    update: {},
  });

  // Attach any pending garden invitations addressed to this email.
  const pending = await db.gardenInvitation.findMany({
    where: { email: primaryEmail, acceptedAt: null, expiresAt: { gt: new Date() } },
  });
  if (pending.length > 0) {
    await db.$transaction(
      pending.map((inv) =>
        db.gardenCollaborator.upsert({
          where: { gardenId_userId: { gardenId: inv.gardenId, userId: clerkUserId } },
          create: { gardenId: inv.gardenId, userId: clerkUserId, role: inv.role, acceptedAt: new Date() },
          update: { acceptedAt: new Date() },
        })
      )
    );
    await db.gardenInvitation.updateMany({
      where: { email: primaryEmail, acceptedAt: null },
      data: { acceptedAt: new Date() },
    });
  }

  return user;
}
