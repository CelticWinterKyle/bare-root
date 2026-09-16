// Beta access, two ways in:
//
//  1. The shared link — `/beta?code=<BETA_CODE>` from env. One code for
//     everyone, capped by BETA_MAX_USES and BETA_CODE_EXPIRES_AT. Kept for
//     compatibility; per-person links are the better tool.
//  2. Per-person links — `/beta?code=<BetaInvite.code>`, generated from
//     /admin/users. One use by default, revocable, and every redemption is
//     recorded against the invite so the beta has names on it.
//
// Both set the same cookie; getCurrentUser reads it on first authenticated
// load and grants Pro. The grant re-checks the code, so revoking an invite
// after the link was clicked but before sign-up completes still blocks it.
import { db } from "@/lib/db";

export const BETA_COOKIE = "bareroot:beta";

export const BETA_MAX_USES = (() => {
  const n = Number(process.env.BETA_MAX_USES);
  return Number.isFinite(n) && n > 0 ? n : 50;
})();

/** The shared env code, if any. */
export function isValidBetaCode(code: string | null | undefined): boolean {
  const expected = process.env.BETA_CODE;
  if (!expected || !code || code !== expected) return false;
  const raw = process.env.BETA_CODE_EXPIRES_AT;
  if (raw) {
    const exp = new Date(raw);
    if (!Number.isNaN(exp.getTime()) && Date.now() > exp.getTime()) return false;
  }
  return true;
}

/** A per-person invite that can still be used, or null. Does not consume it. */
export async function findUsableInvite(code: string | null | undefined) {
  if (!code || code.length < 8 || code.length > 64) return null;
  const inv = await db.betaInvite.findUnique({ where: { code } });
  if (!inv || inv.revokedAt) return null;
  if (inv.expiresAt && inv.expiresAt.getTime() < Date.now()) return null;
  if (inv.uses >= inv.maxUses) return null;
  return inv;
}

/**
 * Grants Pro to `userId` through a per-person invite, atomically: the use
 * count is bumped with a guarded update so two sign-ups on a one-use link
 * can't both get in. Returns true when the grant happened.
 */
export async function redeemInvite(code: string, userId: string): Promise<boolean> {
  const inv = await findUsableInvite(code);
  if (!inv) return false;
  const claimed = await db.betaInvite.updateMany({
    where: { id: inv.id, revokedAt: null, uses: { lt: inv.maxUses } },
    data: { uses: { increment: 1 } },
  });
  if (claimed.count !== 1) return false;
  await db.$transaction([
    db.betaRedemption.create({ data: { inviteId: inv.id, userId } }),
    db.user.update({ where: { id: userId }, data: { subscriptionTier: "PRO", betaGrantedAt: new Date() } }),
  ]);
  return true;
}

/** True when either kind of code is currently good. Used by the /beta route to decide whether to set the cookie. */
export async function isRedeemableCode(code: string | null | undefined): Promise<boolean> {
  if (isValidBetaCode(code)) return true;
  return (await findUsableInvite(code)) !== null;
}
