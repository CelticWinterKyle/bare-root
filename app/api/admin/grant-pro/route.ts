import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const OWNER_EMAIL = "kyle@celticwinter.com";

/**
 * Owner-only manual comp: grant or revoke Pro for a tester by email.
 *   POST /api/admin/grant-pro?email=tester@example.com        → PRO
 *   POST /api/admin/grant-pro?email=tester@example.com&revoke=1 → FREE
 * POST-only on purpose: a state-changing GET authenticated by the session
 * cookie (SameSite=Lax) is CSRF-able via a crafted link. Trigger from a
 * terminal: curl -X POST -H "Cookie: ..." or from the browser devtools
 * console with fetch(url, { method: "POST" }).
 * The tester must have signed up first (so the account exists). Revoking is
 * graceful — over-limit gardens/beds become read-only, nothing is deleted.
 */
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me || me.email.toLowerCase() !== OWNER_EMAIL) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const email = (searchParams.get("email") ?? "").trim();
  const revoke = searchParams.get("revoke") === "1";
  if (!email) {
    return NextResponse.json({ error: "Pass ?email=" }, { status: 400 });
  }

  const target = await db.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true },
  });
  if (!target) {
    return NextResponse.json(
      { error: "No account with that email — have them sign up first." },
      { status: 404 }
    );
  }

  await db.user.update({
    where: { id: target.id },
    data: { subscriptionTier: revoke ? "FREE" : "PRO" },
  });

  return NextResponse.json({ email: target.email, tier: revoke ? "FREE" : "PRO", ok: true });
}
