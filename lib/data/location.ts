import zonesData from "./zones.json";
import frostData from "./frost-dates.json";

const zones = zonesData as Record<string, string>;
const frostDates = frostData as Record<string, { lastFrost: string | null; firstFrost: string | null }>;

export function getZoneByZip(zip: string): string | null {
  const prefix = zip.replace(/\D/g, "").slice(0, 3).padStart(3, "0");
  return zones[prefix] ?? null;
}

/**
 * Average frost dates by USDA half-zone (frost-dates.json). Anchored to
 * NOAA 50%-probability 32°F dates for representative cities in each
 * half-zone (Denver 5b ≈ May 1 / Oct 10, Cincinnati 6a ≈ Apr 20 / Oct 15,
 * NYC 7a ≈ Apr 5 / Oct 30, Austin 8b ≈ Mar 5 / Nov 25), rounded to the
 * nearest sensible calendar point. Zones are winter-minimum bands, so this
 * is an approximation: maritime climates (Pacific Northwest 8b) run two to
 * three weeks later in spring than the table. Before 2026-09-12 the table
 * sat three to five weeks too optimistic on both ends, which put every
 * "start seeds" reminder in cold zones a month early.
 */
export function getFrostDatesByZone(zone: string): { lastFrost: string | null; firstFrost: string | null } | null {
  return frostDates[zone] ?? null;
}

export function getLocationData(zip: string): {
  zone: string;
  lastFrostDate: string | null;
  firstFrostDate: string | null;
} | null {
  const zone = getZoneByZip(zip);
  if (!zone) return null;
  const frost = getFrostDatesByZone(zone);
  return {
    zone,
    lastFrostDate: frost?.lastFrost ?? null,
    firstFrostDate: frost?.firstFrost ?? null,
  };
}
