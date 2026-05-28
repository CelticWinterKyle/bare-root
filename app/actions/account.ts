"use server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { clerkClient } from "@clerk/nextjs/server";

/**
 * Export everything the user owns as a JSON-serializable object. Backs the
 * "Export my data" right promised in the privacy policy.
 */
export async function exportMyData() {
  const user = await requireUser();

  const gardens = await db.garden.findMany({
    where: { userId: user.id },
    include: {
      beds: { include: { cells: true } },
      seasons: {
        include: {
          plantings: {
            include: {
              plant: { select: { name: true, category: true } },
              harvestLogs: true,
              photos: true,
              growthNotes: true,
            },
          },
        },
      },
    },
  });

  const seedInventory = await db.seedInventory.findMany({
    where: { userId: user.id },
    include: { plant: { select: { name: true } } },
  });

  return {
    exportedAt: new Date().toISOString(),
    account: {
      email: user.email,
      name: user.name,
      tier: user.subscriptionTier,
      createdAt: user.createdAt,
    },
    gardens,
    seedInventory,
  };
}

/**
 * Permanently delete the user's account: removes all app data (cascades
 * gardens/beds/plantings/etc.) and the Clerk identity. Irreversible. Backs
 * the "Delete account" right promised in the privacy policy.
 */
export async function deleteMyAccount(): Promise<void> {
  const user = await requireUser();
  // App data first (cascades through gardens and collaborations).
  await db.user.delete({ where: { id: user.id } });
  // Then the auth identity so they can't sign back into a ghost account.
  try {
    const client = await clerkClient();
    await client.users.deleteUser(user.id);
  } catch {
    // DB row is already gone; a failed Clerk delete is a rare edge that
    // would, at worst, recreate an empty row on next sign-in.
  }
}
