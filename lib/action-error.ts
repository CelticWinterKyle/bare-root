/**
 * Errors thrown from server actions that the client is meant to act on.
 *
 * Next.js strips the message of any error thrown inside a server action
 * before it reaches the browser in production — only a generic sentence
 * arrives — but it preserves a `digest` the error already carries
 * (next/dist/server/app-render/create-error-handler.js: "If the error
 * already has a digest, respect the original digest"). So the code and the
 * user-facing copy ride on `digest`, and `actionErrorMessage()` on the
 * client reads them back. Before this, every `toast.error(err.message)` in
 * production showed Next's placeholder and `msg === "UPGRADE_REQUIRED"`
 * never matched.
 *
 * Only put copy written FOR the user in the message — never internal
 * detail. This module has no server-only imports so both sides can use it.
 */

export const ACTION_ERROR_COPY = {
  UPGRADE_REQUIRED: "That needs Bare Root Pro.",
  NOT_FOUND: "That no longer exists. Refresh and try again.",
  INVALID_INPUT: "Please check the form and try again.",
  PERMISSION_DENIED: "You don't have permission to do that.",
  CELL_OCCUPIED: "This cell is already occupied. Try another.",
  NO_ROOM: "Not enough room here for that plant.",
  NO_ACTIVE_SEASON: "Create an active season first.",
  COLLABORATOR_LIMIT_REACHED: "You've reached the 5-collaborator limit.",
  CANNOT_INVITE_SELF: "You're already here — no need to invite yourself.",
  ALREADY_ACCEPTED: "That invitation was already accepted.",
  EMAIL_MISMATCH: "That invitation was sent to a different email address.",
  EXPIRED: "That invitation has expired.",
  INVALID_TOKEN: "That link isn't valid.",
} as const;

export type ActionErrorCode = keyof typeof ACTION_ERROR_COPY;

const DIGEST_PREFIX = "BR_ACTION|";

export class ActionError extends Error {
  readonly code: ActionErrorCode;
  readonly digest: string;

  constructor(code: ActionErrorCode, message?: string) {
    const copy = message ?? ACTION_ERROR_COPY[code];
    super(copy);
    this.name = "ActionError";
    this.code = code;
    this.digest = `${DIGEST_PREFIX}${code}|${copy}`;
  }
}

/**
 * Code + copy of an ActionError, whether it was thrown locally or crossed
 * the server→client boundary (where only `digest` survives in production).
 */
export function parseActionError(
  err: unknown
): { code: ActionErrorCode; message: string } | null {
  if (!err || typeof err !== "object") return null;
  const digest = (err as { digest?: unknown }).digest;
  if (typeof digest !== "string" || !digest.startsWith(DIGEST_PREFIX)) return null;
  const rest = digest.slice(DIGEST_PREFIX.length);
  const sep = rest.indexOf("|");
  const code = (sep === -1 ? rest : rest.slice(0, sep)) as ActionErrorCode;
  if (!(code in ACTION_ERROR_COPY)) return null;
  const message = sep === -1 ? "" : rest.slice(sep + 1);
  return { code, message: message || ACTION_ERROR_COPY[code] };
}

export function actionErrorCode(err: unknown): ActionErrorCode | null {
  return parseActionError(err)?.code ?? null;
}

/** User-facing copy for a failed action, or `fallback` when the error isn't one of ours. */
export function actionErrorMessage(err: unknown, fallback: string): string {
  return parseActionError(err)?.message ?? fallback;
}

/** `redirect()` inside a server action throws; callers that catch must let it through. */
export function isNextRedirect(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const digest = (err as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}
