import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { ensureDbUser } from "@/lib/ensure-user";
import { redirect } from "next/navigation";

export async function getCurrentUser() {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (user) return user;

  // No DB row yet — the Clerk webhook may have lagged or failed. Create it
  // lazily so the user isn't bounced to /sign-in while actually signed in.
  try {
    return await ensureDbUser(userId);
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

export async function getClerkUser() {
  return currentUser();
}

export { auth };
