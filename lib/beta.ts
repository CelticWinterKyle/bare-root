// Self-serve beta access. A shared `/beta?code=...` link sets this cookie
// when the code matches BETA_CODE; the redeem route then grants the new
// account Pro. Rotate by changing BETA_CODE in env (invalidates pending
// cookies too, since redeem re-checks the value).
export const BETA_COOKIE = "bareroot:beta";

export function isValidBetaCode(code: string | null | undefined): boolean {
  const expected = process.env.BETA_CODE;
  return !!expected && !!code && code === expected;
}
