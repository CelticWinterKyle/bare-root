import "server-only";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

/**
 * The one account that can see /admin and call the maintenance routes.
 * Set OWNER_EMAIL in the environment; the fallback keeps existing deploys
 * working until the variable is added.
 */
export const OWNER_EMAIL = (process.env.OWNER_EMAIL ?? "kyle@celticwinter.com").toLowerCase();

export function isOwnerEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === OWNER_EMAIL;
}

/** True when the signed-in user is the owner. Never throws. */
export async function isOwner(): Promise<boolean> {
  const user = await getCurrentUser();
  return isOwnerEmail(user?.email);
}

/**
 * For owner-only pages: returns the owner's user row, or renders the app's
 * not-found page. 404 rather than 403 on purpose, so the page's existence
 * isn't advertised to anyone who guesses the URL.
 */
export async function requireOwner() {
  const user = await getCurrentUser();
  if (!isOwnerEmail(user?.email)) notFound();
  return user!;
}

/** For owner-only server actions: throws instead of rendering. */
export async function requireOwnerAction() {
  const user = await getCurrentUser();
  if (!isOwnerEmail(user?.email)) throw new Error("Not allowed");
  return user!;
}
