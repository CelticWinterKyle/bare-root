import { after } from "next/server";
import { db } from "@/lib/db";
import { fetchCurrentWeather, fetchForecast } from "@/lib/api/weather";
import type { CurrentWeather, ForecastDay } from "@/lib/api/weather";

const THREE_HOURS = 3 * 60 * 60 * 1000;

type WeatherCacheRow = {
  current: unknown;
  forecast: unknown;
  updatedAt: Date;
} | null;

/**
 * Weather for a garden, stale-while-revalidate: always serve the cached
 * value when one exists (even past the 3h staleness window) and refresh the
 * cache via after() so the OpenWeather round-trip never blocks render. Only
 * the very first view of a garden (no cache row at all) waits on the fetch.
 */
export async function getGardenWeather(
  gardenId: string,
  locationZip: string,
  cache: WeatherCacheRow
): Promise<{ current: CurrentWeather | null; forecast: ForecastDay[] | null }> {
  const refresh = async () => {
    const [current, forecast] = await Promise.all([
      fetchCurrentWeather(locationZip),
      fetchForecast(locationZip),
    ]);
    if (current || forecast) {
      await db.weatherCache.upsert({
        where: { gardenId },
        create: { gardenId, current: current ?? {}, forecast: forecast ?? [] },
        update: { current: current ?? {}, forecast: forecast ?? [] },
      });
    }
    return { current, forecast };
  };

  // First view: nothing to render yet, block on the fetch.
  if (!cache) return refresh();

  if (Date.now() - new Date(cache.updatedAt).getTime() > THREE_HOURS) {
    after(refresh);
  }
  return {
    current: cache.current as CurrentWeather | null,
    forecast: Array.isArray(cache.forecast) ? (cache.forecast as ForecastDay[]) : null,
  };
}
