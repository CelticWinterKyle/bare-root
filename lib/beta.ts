// Self-serve beta access. A shared `/beta?code=...` link sets this cookie
// when the code matches BETA_CODE; getCurrentUser then grants the new
// account Pro. Rotate by changing BETA_CODE in env (invalidates pending
// cookies too, since the grant re-checks the value).
//
// Guardrails (both optional env vars):
//   BETA_CODE_EXPIRES_AT — ISO date; the link stops working after it.
//   BETA_MAX_USES        — total Pro grants allowed (default 50). Counted
//                          via User.betaGrantedAt, so it survives restarts.
export const BETA_COOKIE = "bareroot:beta";

export const BETA_MAX_USES = (() => {
  const n = Number(process.env.BETA_MAX_USES);
  return Number.isFinite(n) && n > 0 ? n : 50;
})();

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
