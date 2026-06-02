import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BETA_COOKIE, isValidBetaCode } from "@/lib/beta";

/**
 * Post-auth landing for sign-up (and sign-in). If the visitor arrived via a
 * valid beta link (the cookie set by /beta), grant their account Pro, then
 * forward to onboarding (new user) or the dashboard (returning). Non-beta
 * users just pass straight through — no cookie, no grant.
 */
export async function GET(req: Request) {
  const { origin } = new URL(req.url);

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/sign-in", origin));
  }

  const store = await cookies();
  const beta = store.get(BETA_COOKIE)?.value ?? null;

  if (isValidBetaCode(beta) && user.subscriptionTier !== "PRO") {
    await db.user.update({
      where: { id: user.id },
      data: { subscriptionTier: "PRO" },
    });
  }

  const dest = user.onboardingComplete ? "/dashboard" : "/onboarding";
  const res = NextResponse.redirect(new URL(dest, origin));
  if (beta) res.cookies.delete(BETA_COOKIE);
  return res;
}
