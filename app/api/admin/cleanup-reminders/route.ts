import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ReminderType } from "@/lib/generated/prisma/enums";
import { getCurrentUser } from "@/lib/auth";

// The account allowed to trigger this from the browser (Clerk session).
const OWNER_EMAIL = "kyle@celticwinter.com";

/**
 * One-time cleanup for reminder cruft created before the per-cell dedupe
 * fix: collapses duplicate reminders (one per user/garden/type/title/day)
 * and deletes stale frost alerts whose 72h window has long passed.
 * Idempotent — safe to run more than once.
 *
 * Two ways to trigger:
 *   - GET in a browser while signed in as the owner (no secret needed).
 *   - POST with `x-admin-secret: $CRON_SECRET` (for scripted/cron use).
 */
async function runCleanup() {
  // 1) Delete stale frost alerts — the forecast window they referenced is
  //    long gone, so they're just noise lingering on the dashboard.
  const frostCutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const staleFrost = await db.reminder.deleteMany({
    where: { type: ReminderType.FROST_ALERT, scheduledAt: { lt: frostCutoff } },
  });

  // 2) Collapse duplicates: keep one reminder per (user, garden, type,
  //    title, day), delete the rest.
  const all = await db.reminder.findMany({
    select: {
      id: true,
      userId: true,
      gardenId: true,
      type: true,
      title: true,
      scheduledAt: true,
      dismissed: true,
      sentAt: true,
    },
    orderBy: { id: "asc" },
  });

  const groups = new Map<string, typeof all>();
  for (const r of all) {
    const day = r.scheduledAt.toISOString().slice(0, 10);
    const key = `${r.userId}|${r.gardenId ?? ""}|${r.type}|${r.title}|${day}`;
    const arr = groups.get(key) ?? [];
    arr.push(r);
    groups.set(key, arr);
  }

  const toDelete: string[] = [];
  for (const arr of groups.values()) {
    if (arr.length <= 1) continue;
    // Keep the most useful row: a live (not dismissed, not yet sent) one if
    // present, else any not-dismissed one, else the first. Delete the rest.
    const keeper =
      arr.find((r) => !r.dismissed && !r.sentAt) ??
      arr.find((r) => !r.dismissed) ??
      arr[0];
    for (const r of arr) if (r.id !== keeper.id) toDelete.push(r.id);
  }

  let duplicatesDeleted = 0;
  for (let i = 0; i < toDelete.length; i += 500) {
    const chunk = toDelete.slice(i, i + 500);
    const res = await db.reminder.deleteMany({ where: { id: { in: chunk } } });
    duplicatesDeleted += res.count;
  }

  return {
    ok: true,
    staleFrostDeleted: staleFrost.count,
    duplicatesDeleted,
    groupsScanned: groups.size,
  };
}

export async function POST(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  return NextResponse.json(await runCleanup());
}

export async function GET() {
  // Owner-only browser trigger — uses the Clerk session, so no secret is
  // needed (the CRON_SECRET is a write-only Vercel var and can't be read back).
  const user = await getCurrentUser();
  if (!user || user.email.toLowerCase() !== OWNER_EMAIL) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  return NextResponse.json(await runCleanup());
}
