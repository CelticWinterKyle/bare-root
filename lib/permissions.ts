import { db } from "@/lib/db";
import { CollabRole } from "@/lib/generated/prisma/enums";

/**
 * Prisma `where` fragment matching gardens the user can VIEW —
 * either they own it or they're an accepted collaborator (any role).
 *
 * Usage:
 *   db.garden.findFirst({ where: { id, ...gardenAccessFilter(userId) } })
 *   db.bed.findFirst({ where: { id, garden: gardenAccessFilter(userId) } })
 *   db.garden.findMany({ where: gardenAccessFilter(userId) })
 */
export function gardenAccessFilter(userId: string) {
  return {
    OR: [
      { userId },
      { collaborators: { some: { userId, acceptedAt: { not: null } } } },
    ],
  };
}

/**
 * Prisma `where` fragment matching gardens the user can EDIT —
 * owner OR accepted collaborator with the EDITOR role.
 * VIEWER collaborators are excluded.
 */
export function gardenEditFilter(userId: string) {
  return {
    OR: [
      { userId },
      {
        collaborators: {
          some: { userId, role: CollabRole.EDITOR, acceptedAt: { not: null } },
        },
      },
    ],
  };
}

/**
 * Resolves the IDs of all gardens the user can VIEW. Use for list-style
 * queries where you need an explicit ID list rather than an inline filter.
 */
export async function getAccessibleGardenIds(userId: string): Promise<string[]> {
  const gardens = await db.garden.findMany({
    where: gardenAccessFilter(userId),
    select: { id: true },
  });
  return gardens.map((g) => g.id);
}

/**
 * Throws if the user is not the OWNER of the garden. Use for sensitive
 * actions (delete garden, manage collaborators) that should never be
 * delegable to editors.
 */
export async function requireGardenOwner(userId: string, gardenId: string): Promise<void> {
  const garden = await db.garden.findFirst({
    where: { id: gardenId, userId },
    select: { id: true },
  });
  if (!garden) throw new Error("You don't have permission to perform this action");
}
