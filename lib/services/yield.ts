import type { PlantCategory } from "@/lib/generated/prisma/enums";

/**
 * Rough expected-yield estimates, in pounds per square foot of bed area.
 * There's no real yield data source, so these are conservative
 * category-level heuristics (same spirit as the timing estimates) — always
 * surfaced as "estimated," never presented as exact. Perennial/ornamental
 * categories return null since a per-sqft food-yield figure is meaningless.
 */
const LBS_PER_SQFT: Partial<Record<PlantCategory, number>> = {
  VEGETABLE: 1.0,
  FRUIT: 1.5,
  HERB: 0.4,
  // FLOWER / TREE / SHRUB / OTHER intentionally omitted → null.
};

/**
 * Estimate yield in pounds for a planting occupying `footprintCells` cells
 * of `cellSizeIn`-inch squares. Returns null when the plant's category has
 * no sensible food-yield estimate (flowers, trees, etc.).
 */
export function estimateYieldLbs(
  category: PlantCategory,
  footprintCells: number,
  cellSizeIn: number
): number | null {
  const perSqft = LBS_PER_SQFT[category];
  if (perSqft == null || footprintCells <= 0) return null;
  const sqftPerCell = (cellSizeIn / 12) ** 2;
  const lbs = footprintCells * sqftPerCell * perSqft;
  // Round to one decimal; clamp tiny values up to 0.1 so it never shows 0.
  return Math.max(0.1, Math.round(lbs * 10) / 10);
}

/** True if a category has a yield estimate at all (for conditional UI). */
export function hasYieldEstimate(category: PlantCategory): boolean {
  return LBS_PER_SQFT[category] != null;
}
