import type { PlantCategory } from "@/lib/generated/prisma/enums";

/**
 * Conservative, category-based grow-cycle estimates. Used when a plant is
 * imported from an external source (Perenual) that doesn't supply timing
 * data, so the calendar and reminders still produce something instead of
 * staying empty. Values are deliberately rough — the plant is flagged
 * `timingEstimated` so the UI labels them and the user can correct them.
 *
 * indoorStartWeeks / transplantWeeks drive frost-relative calendar events
 * (start-seeds, transplant). daysToMaturity drives the harvest estimate
 * once a planted date is set. Perennial categories (TREE/SHRUB) get no
 * frost-relative timing since annual seed-starting doesn't apply.
 */
const ESTIMATES: Record<
  PlantCategory,
  { daysToMaturity?: number; indoorStartWeeks?: number; transplantWeeks?: number }
> = {
  VEGETABLE: { daysToMaturity: 60, indoorStartWeeks: 6, transplantWeeks: 2 },
  HERB: { daysToMaturity: 60, indoorStartWeeks: 8, transplantWeeks: 2 },
  FLOWER: { daysToMaturity: 70, indoorStartWeeks: 8, transplantWeeks: 2 },
  FRUIT: { daysToMaturity: 100 },
  TREE: {},
  SHRUB: {},
  OTHER: { daysToMaturity: 60 },
};

export type EstimatedTiming = {
  daysToMaturity?: number;
  indoorStartWeeks?: number;
  transplantWeeks?: number;
};

/** Returns the category's estimated timing (may be empty for perennials). */
export function estimatedTimingFor(category: PlantCategory): EstimatedTiming {
  return ESTIMATES[category] ?? ESTIMATES.OTHER;
}

/**
 * Given a plant's current (possibly null) timing fields and its category,
 * returns the fields to fill from estimates plus whether any were filled.
 * Only fills fields that are currently null/undefined so existing real data
 * is never overwritten.
 */
export function applyEstimatedTiming(
  category: PlantCategory,
  current: {
    daysToMaturity?: number | null;
    indoorStartWeeks?: number | null;
    transplantWeeks?: number | null;
  }
): { data: EstimatedTiming; estimated: boolean } {
  const est = estimatedTimingFor(category);
  const data: EstimatedTiming = {};
  if (current.daysToMaturity == null && est.daysToMaturity != null)
    data.daysToMaturity = est.daysToMaturity;
  if (current.indoorStartWeeks == null && est.indoorStartWeeks != null)
    data.indoorStartWeeks = est.indoorStartWeeks;
  if (current.transplantWeeks == null && est.transplantWeeks != null)
    data.transplantWeeks = est.transplantWeeks;
  return { data, estimated: Object.keys(data).length > 0 };
}
