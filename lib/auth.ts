import { auth, currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { ensureDbUser } from "@/lib/ensure-user";
import { BETA_COOKIE, isValidBetaCode } from "@/lib/beta";
import { redirect } from "next/navigation";

export async function getCurrentUser() {
  const { userId } = await auth();
  if (!userId) return null;

  let user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    // No DB row yet — the Clerk webhook may have lagged or failed. Create it
    // lazily so the user isn't bounced to /sign-in while actually signed in.
    try {
      user = await ensureDbUser(userId);
    } catch {
      return null;
    }
  }
  if (!user) return null;

  // Self-serve beta: a Free account that arrived via a valid beta link (the
  // /beta cookie) is upgraded to Pro on first authenticated load. The cookie
  // just expires; the grant is idempotent (skipped once they're Pro). Doing it
  // here makes it independent of the post-signup redirect.
  if (user.subscriptionTier === "FREE") {
    try {
      const beta = (await cookies()).get(BETA_COOKIE)?.value;
      if (isValidBetaCode(beta)) {
        user = await db.user.update({
          where: { id: user.id },
          data: { subscriptionTier: "PRO" },
        });
      }
    } catch {
      // cookies() unavailable or update failed — non-fatal, account stays Free.
    }
  }

  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

export async function getClerkUser() {
  return currentUser();
}

export { auth };
