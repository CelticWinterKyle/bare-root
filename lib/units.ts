import type { Units } from "@/lib/generated/prisma/enums";

/**
 * Display-unit formatting. Everything is STORED imperial (feet, inches,
 * °F) — these helpers only change what renders. Harvest quantities keep
 * whatever unit the user typed.
 */

export function formatFeet(ft: number, units: Units): string {
  if (units === "IMPERIAL") return `${ft} ft`;
  const m = ft * 0.3048;
  return `${m < 10 ? Number(m.toFixed(1)) : Math.round(m)} m`;
}

/** Bed dims read as "2 × 8 ft" / "0.6 × 2.4 m" — one trailing unit. */
export function formatDims(wFt: number, hFt: number, units: Units): string {
  if (units === "IMPERIAL") return `${wFt} × ${hFt} ft`;
  const f = (ft: number) => Number((ft * 0.3048).toFixed(1));
  return `${f(wFt)} × ${f(hFt)} m`;
}

export function formatInches(inches: number, units: Units): string {
  if (units === "IMPERIAL") return `${inches}"`;
  return `${Math.round(inches * 2.54)} cm`;
}

export function formatTempF(f: number, units: Units): string {
  if (units === "IMPERIAL") return `${Math.round(f)}°F`;
  return `${Math.round(((f - 32) * 5) / 9)}°C`;
}

/** Numeric value only — for sites that render their own ° markup. */
export function tempValue(f: number, units: Units): number {
  return units === "IMPERIAL" ? Math.round(f) : Math.round(((f - 32) * 5) / 9);
}
