import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { gardenAccessFilter } from "@/lib/permissions";

export const ACTIVE_GARDEN_COOKIE = "bareroot:gardenId";

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365, // 1 year
};

/**
 * Resolve which garden is "active" for the user. Reads the active-garden
 * cookie and validates it's still accessible (so a deleted or no-longer-shared
 * garden self-heals); otherwise falls back to the user's oldest accessible
 * garden. Returns null only when the user has no gardens at all.
 *
 * Read-only — safe to call from Server Components (the `/garden` redirect,
 * layout, etc.). The cookie is written by setActiveGarden / createGarden and
 * cleared by deleteGarden, which are Server Actions.
 */
export async function resolveActiveGardenId(userId: string): Promise<string | null> {
  const cookieStore = await cookies();
  const stored = cookieStore.get(ACTIVE_GARDEN_COOKIE)?.value;

  if (stored) {
    const ok = await db.garden.findFirst({
      where: { id: stored, ...gardenAccessFilter(userId) },
      select: { id: true },
    });
    if (ok) return ok.id;
  }

  const oldest = await db.garden.findFirst({
    where: gardenAccessFilter(userId),
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return oldest?.id ?? null;
}

/** Persist the active garden. Call only from a Server Action / Route Handler. */
export async function writeActiveGarden(gardenId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_GARDEN_COOKIE, gardenId, COOKIE_OPTS);
}

/** Clear the active garden (e.g. after deleting it). Server Action only. */
export async function clearActiveGarden(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_GARDEN_COOKIE);
}

/** Read the raw stored cookie value without validation (e.g. to compare on delete). */
export async function getActiveGardenCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_GARDEN_COOKIE)?.value ?? null;
}
