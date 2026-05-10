import zonesData from "./zones.json";
import frostData from "./frost-dates.json";

const zones = zonesData as Record<string, string>;
const frostDates = frostData as Record<string, { lastFrost: string | null; firstFrost: string | null }>;

export function getZoneByZip(zip: string): string | null {
  const prefix = zip.replace(/\D/g, "").slice(0, 3).padStart(3, "0");
  return zones[prefix] ?? null;
}

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
