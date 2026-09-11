"use server";
import { overlapFilter } from "@/lib/services/occupancy";
import { ActionError } from "@/lib/action-error";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { gardenEditFilter } from "@/lib/permissions";
import { assignPlant } from "@/app/actions/planting";
import { generateBedLayout, type LayoutAssignment } from "@/lib/services/smart-layout";
import { MAX_BULK_CELLS } from "@/lib/validation";

const MAX_AI_WISHLIST = 20;
const AI_RUNS_PER_DAY = 20;

/**
 * Claims one of today's AI runs for the user; false when the cap is hit.
 * Two guarded updateMany calls instead of read-then-write, so concurrent
 * requests can't both slip under the cap.
 */
async function consumeAiRun(userId: string): Promise<boolean> {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  // New day (or never run): the counter restarts at 1.
  const reset = await db.user.updateMany({
    where: { id: userId, OR: [{ aiRunsResetAt: null }, { aiRunsResetAt: { lt: dayStart } }] },
    data: { aiRunsToday: 1, aiRunsResetAt: new Date() },
  });
  if (reset.count === 1) return true;
  // Same day: increment only while under the cap — the where clause is the guard.
  const bump = await db.user.updateMany({
    where: { id: userId, aiRunsToday: { lt: AI_RUNS_PER_DAY } },
    data: { aiRunsToday: { increment: 1 } },
  });
  return bump.count === 1;
}

export async function generateLayoutAction(
  bedId: string,
  seasonId: string,
  wishlistPlantIds: string[]
): Promise<{ assignments: LayoutAssignment[]; error?: string }> {
  const user = await requireUser();
  if (user.subscriptionTier !== "PRO") {
    return { assignments: [], error: "UPGRADE_REQUIRED" };
  }

  // Cost guardrails: each run is a multi-thousand-token Opus call. Without
  // these one account could loop it indefinitely with a huge wishlist.
  if (wishlistPlantIds.length === 0) {
    return { assignments: [], error: "Pick at least one plant first." };
  }
  if (wishlistPlantIds.length > MAX_AI_WISHLIST) {
    return { assignments: [], error: `Pick up to ${MAX_AI_WISHLIST} plants for one layout.` };
  }
  if (!(await consumeAiRun(user.id))) {
    return {
      assignments: [],
      error: `You've used today's ${AI_RUNS_PER_DAY} layout runs. They reset at midnight UTC.`,
    };
  }

  const bed = await db.bed.findFirst({
    where: { id: bedId, garden: gardenEditFilter(user.id) },
    include: {
      garden: { select: { usdaZone: true, lastFrostDate: true } },
      cells: {
        include: {
          // Every current occupant of the cell — footprint cells of
          // multi-cell plants and live perennials from earlier seasons
          // included. The old `plantings` relation only saw primary cells
          // of this season, so the model was handed "free" cells that
          // assignPlant then rejected, and the layout came back short.
          occupiedBy: {
            where: { planting: overlapFilter(seasonId, { from: new Date(), until: null }) },
            select: { plantingId: true },
          },
        },
        orderBy: [{ row: "asc" }, { col: "asc" }],
      },
    },
  });
  if (!bed) return { assignments: [], error: "Bed not found" };

  const season = await db.season.findUnique({
    where: { id: seasonId },
    select: { name: true },
  });

  const wishlistPlants = await db.plantLibrary.findMany({
    where: {
      id: { in: wishlistPlantIds },
      OR: [{ customForUserId: null }, { customForUserId: user.id }],
    },
    select: { id: true, name: true, spacingInches: true, sunRequirement: true, plantFamily: true },
  });

  // Companion relations between wishlist plants
  const companions = await db.companionRelation.findMany({
    where: {
      OR: [
        { plantId: { in: wishlistPlantIds } },
        { relatedId: { in: wishlistPlantIds } },
      ],
    },
    include: {
      plant: { select: { name: true } },
      related: { select: { name: true } },
    },
  });

  try {
    const assignments = await generateBedLayout(
      {
        widthFt: bed.widthFt,
        heightFt: bed.heightFt,
        gridCols: bed.gridCols,
        gridRows: bed.gridRows,
        cellSizeIn: bed.cellSizeIn,
        cells: bed.cells.map((c) => ({
          row: c.row,
          col: c.col,
          sunLevel: c.sunLevel,
          isOccupied: c.occupiedBy.length > 0,
        })),
      },
      wishlistPlants,
      companions.map((c) => ({
        plant1Name: c.plant.name,
        plant2Name: c.related.name,
        type: c.type as "BENEFICIAL" | "HARMFUL",
        notes: c.notes,
      })),
      {
        usdaZone: bed.garden.usdaZone,
        lastFrostDate: bed.garden.lastFrostDate,
        seasonName: season?.name ?? "Current season",
      }
    );
    return { assignments };
  } catch (err) {
    console.error("Smart layout error:", err);
    return { assignments: [], error: "Layout generation failed. Please try again." };
  }
}

export async function acceptLayoutAssignments(
  bedId: string,
  seasonId: string,
  assignments: LayoutAssignment[]
): Promise<{ planted: number; skipped: number }> {
  const user = await requireUser();

  // Client-supplied list; each accepted assignment runs the full
  // assignPlant path (queries + transaction + reminders) serially.
  if (assignments.length > MAX_BULK_CELLS) {
    throw new ActionError("INVALID_INPUT", `Too many assignments (max ${MAX_BULK_CELLS})`);
  }

  const bed = await db.bed.findFirst({
    where: { id: bedId, garden: gardenEditFilter(user.id) },
    select: { id: true, gardenId: true },
  });
  if (!bed) throw new ActionError("NOT_FOUND", "Bed not found");

  // Validate plantIds: only global plants or this user's own custom plants.
  // The client supplies these, so without this check a user could inject
  // another user's private custom plant into their bed.
  const requestedIds = [...new Set(assignments.map((a) => a.plantId))];
  const allowed = await db.plantLibrary.findMany({
    where: {
      id: { in: requestedIds },
      OR: [{ customForUserId: null }, { customForUserId: user.id }],
    },
    select: { id: true },
  });
  const allowedIds = new Set(allowed.map((p) => p.id));

  // Resolve (row,col) → cell id for the assigned positions.
  const cells = await db.cell.findMany({
    where: { bedId, OR: assignments.map((a) => ({ row: a.row, col: a.col })) },
    select: { id: true, row: true, col: true },
  });
  const cellByPos = new Map(cells.map((c) => [`${c.row},${c.col}`, c.id]));

  // Reuse the canonical assignPlant path so each plant gets its full
  // footprint (PlantingCell rows) and reminders — the old code created
  // bare Planting rows with no PlantingCell, so plants were invisible and
  // their cells then rejected manual planting. Occupied cells are skipped.
  let planted = 0;
  let skipped = 0;
  for (const a of assignments) {
    if (!allowedIds.has(a.plantId)) { skipped++; continue; }
    const cellId = cellByPos.get(`${a.row},${a.col}`);
    if (!cellId) { skipped++; continue; }
    try {
      await assignPlant(cellId, a.plantId, seasonId);
      planted++;
    } catch {
      // Cell already occupied (footprint overlap or pre-existing). Counted
      // so the UI can say so instead of reporting a silent partial success.
      skipped++;
    }
  }

  revalidatePath(`/garden/${bed.gardenId}/beds/${bedId}`);
  revalidatePath(`/garden/${bed.gardenId}`);
  revalidatePath(`/dashboard`);
  return { planted, skipped };
}
