import { db } from "@/lib/db";
import { ReminderType, CollabRole } from "@/lib/generated/prisma/enums";
import type { ForecastDay } from "@/lib/api/weather";

const FROST_TEMP_F = 35;
const FROST_WINDOW_HOURS = 72;

function hasFrostInWindow(forecast: ForecastDay[]): boolean {
  const cutoff = new Date(Date.now() + FROST_WINDOW_HOURS * 60 * 60 * 1000);
  return forecast.some((day) => {
    // Parse the date-only string at local noon so the 72h window isn't
    // skewed by a UTC-midnight offset dropping a borderline frost day.
    const dayDate = new Date(day.date + "T12:00:00");
    return dayDate <= cutoff && day.minTemp <= FROST_TEMP_F;
  });
}

export async function GET(req: Request) {
  // Bearer-only: Vercel auto-attaches `Authorization: Bearer $CRON_SECRET`
  // to cron invocations. The `x-vercel-cron` header is a plain request
  // header, not a security boundary, so don't accept it as auth.
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const caches = await db.weatherCache.findMany({
    where: {},
    include: {
      garden: {
        select: {
          id: true,
          name: true,
          userId: true,
          collaborators: {
            where: { role: CollabRole.EDITOR, acceptedAt: { not: null } },
            select: { userId: true },
          },
        },
      },
    },
  });

  const now = new Date();

  const frosty = caches.filter((cache) => {
    const forecast = cache.forecast as ForecastDay[] | null;
    return forecast != null && hasFrostInWindow(forecast);
  });

  // One batched dup-check for all frost-risk gardens (was a findFirst per
  // garden): skip any garden that already has an active alert from the
  // last 24h.
  const existing = frosty.length
    ? await db.reminder.findMany({
        where: {
          gardenId: { in: frosty.map((c) => c.gardenId) },
          type: ReminderType.FROST_ALERT,
          dismissed: false,
          scheduledAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        },
        select: { gardenId: true },
      })
    : [];
  const alreadyAlerted = new Set(existing.map((e) => e.gardenId));

  const rows = frosty
    .filter((cache) => !alreadyAlerted.has(cache.gardenId))
    .flatMap((cache) =>
      [cache.garden.userId, ...cache.garden.collaborators.map((c) => c.userId)].map(
        (userId) => ({
          userId,
          gardenId: cache.gardenId,
          type: ReminderType.FROST_ALERT,
          title: `Frost risk at ${cache.garden.name}`,
          body: "Temperatures near or below freezing are forecast in the next 72 hours. Consider protecting sensitive plants.",
          scheduledAt: now,
        })
      )
    );

  const created = rows.length ? await db.reminder.createMany({ data: rows }) : { count: 0 };

  // Daily housekeeping piggybacked on this cron: processed Stripe webhook
  // event rows only matter for retry-window dedup; prune anything old so
  // the table doesn't grow forever.
  const pruned = await db.webhookEvent.deleteMany({
    where: { processedAt: { lt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) } },
  });

  return Response.json({ ok: true, alertsCreated: created.count, webhookEventsPruned: pruned.count });
}
