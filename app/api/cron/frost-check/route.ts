import { db } from "@/lib/db";
import { ReminderType, CollabRole } from "@/lib/generated/prisma/enums";
import type { ForecastDay } from "@/lib/api/weather";

const FROST_TEMP_F = 35;
const FROST_WINDOW_HOURS = 72;

function hasFrostInWindow(forecast: ForecastDay[]): boolean {
  const cutoff = new Date(Date.now() + FROST_WINDOW_HOURS * 60 * 60 * 1000);
  return forecast.some((day) => {
    const dayDate = new Date(day.date);
    return dayDate <= cutoff && day.minTemp <= FROST_TEMP_F;
  });
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
  let alertsCreated = 0;

  for (const cache of caches) {
    const forecast = cache.forecast as ForecastDay[] | null;
    if (!forecast || !hasFrostInWindow(forecast)) continue;

    // Don't create duplicate active frost alerts for same garden
    const existing = await db.reminder.findFirst({
      where: {
        gardenId: cache.gardenId,
        type: ReminderType.FROST_ALERT,
        dismissed: false,
        scheduledAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if (existing) continue;

    const recipients = [
      cache.garden.userId,
      ...cache.garden.collaborators.map((c) => c.userId),
    ];

    for (const userId of recipients) {
      await db.reminder.create({
        data: {
          userId,
          gardenId: cache.gardenId,
          type: ReminderType.FROST_ALERT,
          title: `Frost risk at ${cache.garden.name}`,
          body: "Temperatures near or below freezing are forecast in the next 72 hours. Consider protecting sensitive plants.",
          scheduledAt: now,
        },
      });
      alertsCreated++;
    }
  }

  return Response.json({ ok: true, alertsCreated });
}
