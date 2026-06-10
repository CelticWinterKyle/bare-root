import { createHmac, timingSafeEqual } from "crypto";

// Signing secret for one-click unsubscribe tokens. UNSUBSCRIBE_SECRET is
// optional — we fall back to CRON_SECRET, which is already required in
// production, so unsubscribe links work without any new env var. Set
// UNSUBSCRIBE_SECRET if you ever need to rotate CRON_SECRET without
// invalidating unsubscribe links already sitting in inboxes.
function getSecret(): string | undefined {
  return process.env.UNSUBSCRIBE_SECRET ?? process.env.CRON_SECRET;
}

function sign(userId: string, secret: string): string {
  return createHmac("sha256", secret).update(userId).digest("hex");
}

/** Token format: `${userId}.${hexsig}`. Returns null if no secret is configured. */
export function createUnsubscribeToken(userId: string): string | null {
  const secret = getSecret();
  if (!secret) return null;
  return `${userId}.${sign(userId, secret)}`;
}

/** Verifies a token (constant-time) and returns the userId, or null if invalid. */
export function verifyUnsubscribeToken(token: string): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const userId = token.slice(0, dot);
  const provided = Buffer.from(token.slice(dot + 1), "hex");
  const expected = Buffer.from(sign(userId, secret), "hex");
  if (provided.length !== expected.length) return null;
  return timingSafeEqual(provided, expected) ? userId : null;
}

/** Absolute one-click unsubscribe URL for a user, or null if env isn't configured. */
export function buildUnsubscribeUrl(userId: string): string | null {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const token = createUnsubscribeToken(userId);
  if (!appUrl || !token) return null;
  return `${appUrl}/api/email/unsubscribe?token=${encodeURIComponent(token)}`;
}
