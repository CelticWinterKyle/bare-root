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
  const primaryEmailObj =
    cu.emailAddresses.find((e) => e.id === cu.primaryEmailAddressId) ??
    cu.emailAddresses[0];
  const primaryEmail = primaryEmailObj?.emailAddress;
  if (!primaryEmail) throw new Error("No primary email for user");
  const fullName = [cu.firstName, cu.lastName].filter(Boolean).join(" ") || null;

  // Re-link: `email` is @unique and already belongs to a row under a DIFFERENT
  // Clerk id — i.e. the same person authenticating under a new Clerk identity
  // (a new sign-in method like Google, or an account first created on the dev
  // Clerk instance). Creating a second row would hit the unique-email
  // constraint and throw, which leaves the user bouncing in a /sign-in ↔ app
  // redirect loop. Instead re-point the existing row to the current Clerk id;
  // its FK rows (gardens, collaborators, reminders, inventory, …) follow via
  // ON UPDATE CASCADE, so the account keeps all its data.
  const byEmail = await db.user.findUnique({ where: { email: primaryEmail } });
  if (byEmail && byEmail.id !== clerkUserId) {
    // Hard gate: re-linking hands the ENTIRE existing account to the new
    // Clerk identity, so the email claim must be verified. Clerk normally
    // enforces verification at sign-up, but this must not hinge on that
    // config staying correct (e.g. an OAuth provider returning an
    // unverified address) — an unverified match would be account takeover.
    if (primaryEmailObj.verification?.status !== "verified") {
      throw new Error(
        `Refusing to re-link existing account for ${primaryEmail}: email is not verified on the new Clerk identity`
      );
    }
    return db.user.update({
      where: { id: byEmail.id },
      data: {
        id: clerkUserId,
        name: fullName ?? byEmail.name,
        avatarUrl: cu.imageUrl || byEmail.avatarUrl,
      },
    });
  }

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
