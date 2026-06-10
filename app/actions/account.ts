"use server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { clerkClient } from "@clerk/nextjs/server";
import { cleanupBeforeUserDelete } from "@/lib/account-cleanup";

// Data export lives at GET /api/export (a zip of data.json + photo files,
// streamed) — the gather logic is shared via lib/export-data.ts.

/**
 * Permanently delete the user's account: removes all app data (cascades
 * gardens/beds/plantings/etc.) and the Clerk identity. Irreversible. Backs
 * the "Delete account" right promised in the privacy policy.
 */
export async function deleteMyAccount(): Promise<void> {
  const user = await requireUser();
  // Cancel billing and remove Blob photos while the rows still exist —
  // the cascade below destroys the subscription id and photo URLs.
  await cleanupBeforeUserDelete(user.id);
  // App data next (cascades through gardens and collaborations).
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
