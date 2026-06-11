import type { ForecastDay } from "@/lib/api/weather";
import type { WaterNeed } from "@/lib/generated/prisma/enums";

/**
 * Watering heuristic. The free OpenWeather tier gives weather codes and
 * descriptions but no precipitation amounts, so "rain" here means rain-ish
 * conditions were OBSERVED at a refresh pass (lastRainAt) or appear in the
 * day-level FORECAST. Copy that uses this should hedge accordingly.
 */

// OpenWeather icon prefixes: 09 shower, 10 rain, 11 thunderstorm, 13 snow —
// all of them put water on the bed.
const RAIN_ICON = /^(09|10|11|13)/;
const RAIN_WORDS = /rain|drizzle|shower|thunder|storm|snow|sleet/i;

export function looksLikeRain(icon: string | undefined, description: string | undefined): boolean {
  if (icon && RAIN_ICON.test(icon)) return true;
  if (description && RAIN_WORDS.test(description)) return true;
  return false;
}

/** Is rain in the forecast for today/tomorrow? (Day-granularity data.) */
export function rainExpectedSoon(forecast: ForecastDay[] | null, now = new Date()): boolean {
  if (!forecast) return false;
  const cutoff = new Date(now.getTime() + 36 * 60 * 60 * 1000);
  return forecast.some((day) => {
    const dayDate = new Date(day.date + "T12:00:00");
    return dayDate <= cutoff && looksLikeRain(day.icon, day.description);
  });
}

/** Days without observed rain before a plant of this need wants water. */
export const DRY_DAYS_THRESHOLD: Record<WaterNeed, number> = {
  HIGH: 2,
  MODERATE: 3,
  LOW: 5,
};
