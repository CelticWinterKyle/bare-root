import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * THE single home for occupancy-window logic. Every interval is half-open:
 * [occupiesFrom, occupiesUntil), with occupiesUntil null meaning +infinity
 * (in-flight annuals, live perennials).
 *
 * THE OCCUPANCY RULE (the invariant the whole time model hangs on):
 * a placement with window [newFrom, newUntil) into a set of cells is valid
 * iff NO cell in the set has a PlantingCell whose planting q satisfies
 *   (a) q is a live perennial (isPerennial AND clearedAt IS NULL) with
 *       q.occupiesFrom < newUntil   — perennials block EVERY season; OR
 *   (b) q.seasonId = the placement's season AND the intervals overlap:
 *       q.occupiesFrom < newUntil AND (q.occupiesUntil IS NULL OR newFrom < q.occupiesUntil).
 * Annual occupancy is deliberately season-scoped (two seasons are two
 * alternative plans); live perennials are the only cross-season occupants.
 */

export type OccupancyWindow = { from: Date; until: Date | null };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Window for a brand-new planting: starts now (or at its planned month),
 *  ends a maturity-run later when the plant has one, else open-ended. */
export function windowForNewPlanting(
  daysToMaturity: number | null | undefined,
  options?: { plannedFor?: Date | null; isPerennial?: boolean }
): OccupancyWindow {
  const from = options?.plannedFor ?? new Date();
  if (options?.isPerennial) return { from, until: null }; // alive until cleared
  const until = daysToMaturity ? new Date(from.getTime() + daysToMaturity * DAY_MS) : null;
  return { from, until };
}

/** Window recomputed from user-edited dates (the Dates section). */
export function windowFromDates(
  plantedDate: Date | null,
  expectedHarvestDate: Date | null,
  fallbackFrom: Date,
  isPerennial: boolean
): OccupancyWindow {
  const from = plantedDate ?? fallbackFrom;
  return { from, until: isPerennial ? null : expectedHarvestDate };
}

/**
 * Prisma where-fragment for "this planting's window blocks [from, until)
 * in `seasonId`". Compose under `planting:` in a PlantingCell query.
 * `excludePlantingId` lets a move ignore its own footprint.
 */
export function overlapFilter(
  seasonId: string,
  window: OccupancyWindow,
  excludePlantingId?: string
): Prisma.PlantingWhereInput {
  // occupiesFrom < until — omitted entirely when until is +infinity.
  const startsBeforeEnd: Prisma.PlantingWhereInput =
    window.until === null ? {} : { occupiesFrom: { lt: window.until } };

  return {
    ...(excludePlantingId ? { id: { not: excludePlantingId } } : {}),
    OR: [
      // (a) live perennial — blocks in every season
      { isPerennial: true, clearedAt: null, ...startsBeforeEnd },
      // (b) same-season window overlap
      {
        seasonId,
        ...startsBeforeEnd,
        OR: [{ occupiesUntil: null }, { occupiesUntil: { gt: window.from } }],
      },
    ],
  };
}
