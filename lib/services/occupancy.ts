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

// Which of a cell's occupants the grid shows. On the today view a cell can
// legally hold a finished planting, its live successor, and one planned for
// a future month (placed while scrubbed ahead). Latest-occupiesFrom-first
// picked the future one and hid the live plant. Rank: window contains now →
// most recently finished → soonest upcoming. Scrubbed views pass null: the
// query already limited occupants to that month and latest-first is right.
export function pickOccupant<T extends { planting: { occupiesFrom: Date; occupiesUntil: Date | null } }>(
  occupants: T[],
  now: Date | null
): T | null {
  if (occupants.length === 0) return null;
  if (!now) return occupants[0];
  const rank = (o: T) => {
    const { occupiesFrom, occupiesUntil } = o.planting;
    if (occupiesFrom <= now && (!occupiesUntil || occupiesUntil > now)) return 0;
    if (occupiesUntil && occupiesUntil <= now) return 1;
    return 2;
  };
  return [...occupants].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (ra === 1) return b.planting.occupiesUntil!.getTime() - a.planting.occupiesUntil!.getTime();
    if (ra === 2) return a.planting.occupiesFrom.getTime() - b.planting.occupiesFrom.getTime();
    return b.planting.occupiesFrom.getTime() - a.planting.occupiesFrom.getTime();
  })[0];
}
