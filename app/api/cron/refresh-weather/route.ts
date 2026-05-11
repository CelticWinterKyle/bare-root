import { db } from "@/lib/db";
import { fetchCurrentWeather, fetchForecast } from "@/lib/api/weather";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const gardens = await db.garden.findMany({
    where: {
      locationZip: { not: null },
      beds: {
        some: {
          cells: {
            some: {
              plantings: {
                some: { season: { isActive: true } },
              },
            },
          },
        },
      },
    },
    select: { id: true, locationZip: true },
  });

  let refreshed = 0;

  for (const garden of gardens) {
    if (!garden.locationZip) continue;
    try {
      const [current, forecast] = await Promise.all([
        fetchCurrentWeather(garden.locationZip),
        fetchForecast(garden.locationZip),
      ]);
      if (!current) continue;

      await db.weatherCache.upsert({
        where: { gardenId: garden.id },
        create: {
          gardenId: garden.id,
          current: current as never,
          forecast: (forecast ?? []) as never,
        },
        update: {
          current: current as never,
          forecast: (forecast ?? []) as never,
        },
      });
      refreshed++;
    } catch (err) {
      console.error(`Weather refresh failed for garden ${garden.id}:`, err);
    }
  }

  return Response.json({ ok: true, refreshed });
}
