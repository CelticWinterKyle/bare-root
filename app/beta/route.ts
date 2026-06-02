import { NextResponse } from "next/server";
import { BETA_COOKIE, isValidBetaCode } from "@/lib/beta";

/**
 * Beta entry link: `/beta?code=XYZ`. If the code is valid, drop a short-lived
 * cookie marking this visitor as a beta invitee, then send them to sign up.
 * The redeem route (hit right after sign-up) reads the cookie and grants Pro.
 * Invalid/absent codes just fall through to a normal (Free) sign-up.
 */
export function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");

  const res = NextResponse.redirect(new URL("/sign-up", origin));
  if (isValidBetaCode(code)) {
    res.cookies.set(BETA_COOKIE, code!, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60, // 1 hour — long enough to finish signing up
    });
  }
  return res;
}
