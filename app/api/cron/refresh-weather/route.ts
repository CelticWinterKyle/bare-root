import { db } from "@/lib/db";
import { fetchCurrentWeather, fetchForecast } from "@/lib/api/weather";

export const maxDuration = 300;

// Zips fetched concurrently. OpenWeather free tier allows 60 calls/min and
// each zip costs 2 calls, so keep the burst modest.
const ZIP_CONCURRENCY = 5;

export async function GET(req: Request) {
  // Bearer-only: Vercel auto-attaches `Authorization: Bearer $CRON_SECRET`
  // to cron invocations. The `x-vercel-cron` header is a plain request
  // header, not a security boundary, so don't accept it as auth.
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
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

  // Weather is per-zip, not per-garden — fetch each zip ONCE and fan the
  // result out to every garden sharing it. Without this the run cost two
  // OpenWeather calls per garden, which blows both the 60/min free tier
  // and the function timeout as gardens grow.
  const byZip = new Map<string, string[]>();
  for (const g of gardens) {
    if (!g.locationZip) continue;
    const ids = byZip.get(g.locationZip) ?? [];
    ids.push(g.id);
    byZip.set(g.locationZip, ids);
  }

  let refreshed = 0;
  const zips = [...byZip.entries()];

  for (let i = 0; i < zips.length; i += ZIP_CONCURRENCY) {
    const results = await Promise.allSettled(
      zips.slice(i, i + ZIP_CONCURRENCY).map(async ([zip, gardenIds]) => {
        const [current, forecast] = await Promise.all([
          fetchCurrentWeather(zip),
          fetchForecast(zip),
        ]);
        if (!current) return 0;

        let updated = 0;
        for (const gardenId of gardenIds) {
          await db.weatherCache.upsert({
            where: { gardenId },
            create: {
              gardenId,
              current: current as never,
              forecast: (forecast ?? []) as never,
            },
            update: {
              current: current as never,
              forecast: (forecast ?? []) as never,
            },
          });
          updated++;
        }
        return updated;
      })
    );
    for (const r of results) {
      if (r.status === "fulfilled") refreshed += r.value;
      else console.error("Weather refresh failed for a zip:", r.reason);
    }
  }

  return Response.json({ ok: true, refreshed, zips: zips.length });
}
