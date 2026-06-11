import { db } from "@/lib/db";
import { ReminderType, CollabRole, type WaterNeed } from "@/lib/generated/prisma/enums";
import type { ForecastDay } from "@/lib/api/weather";
import { rainExpectedSoon, DRY_DAYS_THRESHOLD } from "@/lib/services/watering";

/**
 * Daily watering decision (clone of the frost-check pattern). For each
 * garden with in-ground plantings: if it's been dry longer than the
 * thirstiest plant's threshold AND no rain is forecast in the next ~36h,
 * fire ONE garden-level WATER reminder naming the plants that want it.
 * Observed rain comes from WeatherCache.lastRainAt (stamped by the 3h
 * refresh cron); the free tier has no rain amounts, so copy hedges.
 */
export async function GET(req: Request) {
  // Bearer-only — same boundary as the other crons.
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const caches = await db.weatherCache.findMany({
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
  if (caches.length === 0) return Response.json({ ok: true, remindersCreated: 0 });

  const now = new Date();
  const gardenIds = caches.map((c) => c.gardenId);

  // In-ground plantings with known water needs, grouped per garden.
  const plantings = await db.planting.findMany({
    where: {
      season: { isActive: true },
      status: { in: ["TRANSPLANTED", "ACTIVE", "HARVESTING"] },
      cell: { bed: { gardenId: { in: gardenIds } } },
      plant: { waterRequirement: { not: null } },
    },
    select: {
      plant: { select: { name: true, waterRequirement: true } },
      cell: { select: { bed: { select: { gardenId: true } } } },
    },
  });
  const byGarden = new Map<string, { name: string; need: WaterNeed }[]>();
  for (const p of plantings) {
    const gid = p.cell.bed.gardenId;
    const list = byGarden.get(gid) ?? [];
    list.push({ name: p.plant.name, need: p.plant.waterRequirement as WaterNeed });
    byGarden.set(gid, list);
  }

  // 24h dedupe across all candidate gardens at once.
  const existing = await db.reminder.findMany({
    where: {
      gardenId: { in: gardenIds },
      type: ReminderType.WATER,
      dismissed: false,
      scheduledAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
    },
    select: { gardenId: true },
  });
  const alreadyReminded = new Set(existing.map((e) => e.gardenId));

  const NEED_ORDER: WaterNeed[] = ["HIGH", "MODERATE", "LOW"];
  const rows: {
    userId: string;
    gardenId: string;
    type: ReminderType;
    title: string;
    body: string;
    scheduledAt: Date;
  }[] = [];

  for (const cache of caches) {
    if (alreadyReminded.has(cache.gardenId)) continue;
    const plants = byGarden.get(cache.gardenId);
    if (!plants || plants.length === 0) continue;

    // Days since rain was last OBSERVED. Never-observed (tracking just
    // started, or a genuinely dry stretch) counts as dry.
    const dryDays = cache.lastRainAt
      ? Math.floor((now.getTime() - cache.lastRainAt.getTime()) / (24 * 60 * 60 * 1000))
      : Infinity;

    // Strictest threshold among the needs actually present in the garden.
    const threshold = Math.min(...plants.map((p) => DRY_DAYS_THRESHOLD[p.need]));
    if (dryDays < threshold) continue;

    const forecast = cache.forecast as ForecastDay[] | null;
    if (rainExpectedSoon(forecast, now)) continue;

    // Name the thirstiest few, highest need first, deduped.
    const thirstiest = [...new Set(
      NEED_ORDER.flatMap((need) => plants.filter((p) => p.need === need).map((p) => p.name))
    )].slice(0, 3);

    const since =
      cache.lastRainAt && Number.isFinite(dryDays)
        ? `no rain seen in ${dryDays} day${dryDays === 1 ? "" : "s"}`
        : "no recent rain on record";

    for (const userId of [cache.garden.userId, ...cache.garden.collaborators.map((c) => c.userId)]) {
      rows.push({
        userId,
        gardenId: cache.gardenId,
        type: ReminderType.WATER,
        title: `Looks dry at ${cache.garden.name}`,
        body: `${since}, and none in the forecast. ${thirstiest.join(", ")} would appreciate a drink.`,
        scheduledAt: now,
      });
    }
  }

  const created = rows.length ? await db.reminder.createMany({ data: rows }) : { count: 0 };
  return Response.json({ ok: true, remindersCreated: created.count });
}
