"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { gardenEditFilter } from "@/lib/permissions";
import { assertBedWritable } from "@/lib/tier";
import type { SunLevel, PlantingStatus, PlantStartMethod } from "@/lib/generated/prisma/enums";
import { getSpacingWarnings, type SpacingWarning } from "@/lib/services/spacing";
import { createRemindersForPlanting, upsertHarvestReminder, syncRemindersToStatus } from "@/lib/services/reminders";
import { getStartOptions } from "@/lib/services/planting-feasibility";
import { MAX_BULK_CELLS } from "@/lib/validation";

async function resolveCell(cellId: string, userId: string) {
  const cell = await db.cell.findFirst({
    where: { id: cellId, bed: { garden: gardenEditFilter(userId) } },
    include: { bed: true },
  });
  if (!cell) throw new Error("Cell not found");
  return cell;
}

export type FootprintPlacement = {
  /** Cells (relative to anchor) that the plant will occupy. Each entry is
   *  a real Cell.id in the bed. The entry with isPrimary=true is the
   *  anchor cell — the one the user tapped. */
  cells: { cellId: string; row: number; col: number; isPrimary: boolean }[];
  /** Footprint that the plant SHOULD have had based on its spacing. */
  desiredFootprint: number;
  /** True iff the bed itself is too small for the full footprint (the only
   *  remaining reduction cause — occupied cells now BLOCK, never shrink). */
  footprintReduced: boolean;
  /** Footprint edge length in cells (e.g. 2 for a 2×2 tomato). */
  sideCells: number;
  /** Set (>0) when placement was REJECTED because that many footprint cells
   *  are already occupied — `cells` will be empty. Footprints must stay
   *  rectangles: silently shrinking around neighbors produced L-shapes whose
   *  bounding-box render painted over other plantings ("stacking"). */
  blockedCells?: number;
};

/**
 * Computes which cells a plant would occupy when anchored at the given
 * row/col, using the "anchor at tap, extend LEFT and DOWN" convention.
 * The block slides to stay inside the bed; it only shrinks when the bed
 * itself is smaller than the footprint (still a rectangle). If ANY cell of
 * the resolved rectangle is occupied by another planting this season, the
 * whole placement is rejected (blockedCells set, cells empty) — callers
 * surface a "needs an N×N area" error.
 */
async function resolveFootprint(args: {
  anchorCell: { id: string; row: number; col: number; bedId: string };
  bed: { gridRows: number; gridCols: number; cellSizeIn: number };
  spacingInches: number | null;
  seasonId: string;
  /** When moving an existing planting, exclude its own cells from the
   *  "occupied" check so we don't refuse to place it on top of itself. */
  excludePlantingId?: string;
}): Promise<FootprintPlacement> {
  const { anchorCell, bed, spacingInches, seasonId, excludePlantingId } = args;
  const spacing = spacingInches ?? bed.cellSizeIn;
  const sideCells = Math.max(1, Math.ceil(spacing / bed.cellSizeIn));

  // The footprint is a sideCells×sideCells block. The tapped cell anchors it
  // at the top-right (extends down + left). Shift the block to stay in-bounds
  // so tapping near the top/left edge doesn't silently shrink the plant —
  // the block slides to keep the tapped cell inside it. We only reduce the
  // footprint when the bed itself is too small to hold it. The tapped cell
  // always remains the primary (it must match Planting.cellId).
  const rowStart = Math.max(0, Math.min(anchorCell.row, bed.gridRows - sideCells));
  const colStart = Math.max(0, Math.min(anchorCell.col - sideCells + 1, bed.gridCols - sideCells));
  const desired: { row: number; col: number; isPrimary: boolean }[] = [];
  for (let dr = 0; dr < sideCells; dr++) {
    for (let dc = 0; dc < sideCells; dc++) {
      const row = rowStart + dr;
      const col = colStart + dc;
      if (row < 0 || row >= bed.gridRows || col < 0 || col >= bed.gridCols) continue;
      desired.push({
        row,
        col,
        isPrimary: row === anchorCell.row && col === anchorCell.col,
      });
    }
  }

  // Look up the actual Cell ids for those positions.
  const cellsInBed = await db.cell.findMany({
    where: {
      bedId: anchorCell.bedId,
      OR: desired.map((d) => ({ row: d.row, col: d.col })),
    },
    select: { id: true, row: true, col: true },
  });
  const cellByPos = new Map(cellsInBed.map((c) => [`${c.row},${c.col}`, c.id]));

  // Occupancy check across the whole rectangle — ignoring the moving
  // planting's own cells when present, so it can re-anchor onto itself.
  const candidateIds = cellsInBed.map((c) => c.id);
  const occupied = await db.plantingCell.findMany({
    where: {
      cellId: { in: candidateIds },
      planting: {
        seasonId,
        ...(excludePlantingId ? { id: { not: excludePlantingId } } : {}),
      },
    },
    select: { cellId: true },
  });
  const occupiedSet = new Set(occupied.map((o) => o.cellId));

  // ANY occupied cell in the rectangle rejects the placement outright.
  // Shrinking around neighbors created non-rectangular footprints that
  // rendered as overlapping blocks — the grid must never lie.
  const blockedCells = desired.filter((d) => {
    const id = cellByPos.get(`${d.row},${d.col}`);
    return id !== undefined && occupiedSet.has(id);
  }).length;
  if (blockedCells > 0) {
    return {
      cells: [],
      desiredFootprint: sideCells * sideCells,
      footprintReduced: false,
      sideCells,
      blockedCells,
    };
  }

  const placed = desired
    .map((d) => {
      const id = cellByPos.get(`${d.row},${d.col}`);
      if (!id) return null;
      return { cellId: id, row: d.row, col: d.col, isPrimary: d.isPrimary };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return {
    cells: placed,
    desiredFootprint: sideCells * sideCells,
    footprintReduced: placed.length < sideCells * sideCells,
    sideCells,
  };
}

export async function assignPlant(
  cellId: string,
  plantId: string,
  seasonId: string,
  startMethod?: PlantStartMethod
): Promise<{
  spacingWarnings: SpacingWarning[];
  footprintWarning?: string;
}> {
  const user = await requireUser();
  const cell = await resolveCell(cellId, user.id);

  // The cell is access-checked above, but seasonId is client-supplied —
  // verify it belongs to the same garden so a planting can't be attached
  // to another garden's (or another user's) season. Also covers
  // bulkAssignPlant and acceptLayoutAssignments, which funnel through here.
  const season = await db.season.findFirst({
    where: { id: seasonId, gardenId: cell.bed.gardenId },
    select: { id: true },
  });
  if (!season) throw new Error("Season not found");

  await assertBedWritable(user.id, user.subscriptionTier, cell.bed.gardenId, cell.bedId);

  const plant = await db.plantLibrary.findUniqueOrThrow({
    where: { id: plantId },
    select: {
      name: true,
      spacingInches: true,
      indoorStartWeeks: true,
      transplantWeeks: true,
      daysToMaturity: true,
    },
  });

  const garden = await db.garden.findUniqueOrThrow({
    where: { id: cell.bed.gardenId },
    select: { lastFrostDate: true, firstFrostDate: true },
  });

  // Guidance-first: a freshly placed plant defaults to the method we'd
  // recommend for the season (e.g. "buy a start" in June), so the calendar
  // and reminders are right from the start.
  const method =
    startMethod ??
    getStartOptions(plant, {
      lastFrostDate: garden.lastFrostDate,
      firstFrostDate: garden.firstFrostDate,
    }).recommended;

  const placement = await resolveFootprint({
    anchorCell: { id: cell.id, row: cell.row, col: cell.col, bedId: cell.bedId },
    bed: {
      gridRows: cell.bed.gridRows,
      gridCols: cell.bed.gridCols,
      cellSizeIn: cell.bed.cellSizeIn,
    },
    spacingInches: plant.spacingInches,
    seasonId,
  });

  if (placement.blockedCells) {
    throw new Error(
      placement.sideCells > 1
        ? `Not enough room here — ${plant.name} needs a clear ${placement.sideCells}×${placement.sideCells} area.`
        : "This cell is already occupied. Try another."
    );
  }
  const primary = placement.cells.find((c) => c.isPrimary);
  if (!primary) {
    // Anchor cell itself isn't placeable — off-grid (shouldn't happen since
    // we just resolved it). Surface a clear error so the picker can
    // re-render without state drift.
    throw new Error("This cell is already occupied. Try another.");
  }

  // Create the planting + every footprint cell in one transaction.
  const planting = await db.$transaction(async (tx) => {
    const p = await tx.planting.create({
      data: { cellId, seasonId, plantId, status: "PLANNED", quantityPerCell: 1, startMethod: method },
    });
    await tx.plantingCell.createMany({
      data: placement.cells.map((c) => ({
        plantingId: p.id,
        cellId: c.cellId,
        isPrimary: c.isPrimary,
      })),
    });
    return p;
  });

  // Reminders are secondary. The planting is already committed above, so a
  // transient failure here (e.g. a pooled-connection blip from the serverless
  // → Neon path) must not 500 the whole placement — log and carry on.
  try {
    await createRemindersForPlanting({
      plantingId: planting.id,
      gardenId: cell.bed.gardenId,
      userId: user.id,
      plant,
      garden,
      startMethod: method,
    });
  } catch (err) {
    console.error("createRemindersForPlanting failed (non-fatal):", err);
  }

  // Footprint warning — now only fires when the BED is smaller than the
  // plant's recommended area (occupied neighbors reject instead of shrink).
  let footprintWarning: string | undefined;
  if (placement.footprintReduced) {
    footprintWarning = `${plant.name} normally needs a ${placement.sideCells}×${placement.sideCells} area, but this bed only fits ${placement.cells.length} of ${placement.desiredFootprint} cells. Crowded plants may produce less.`;
  }

  // Existing spacing check — distance between plantings within this bed.
  // (Multi-cell-aware refinement happens in lib/services/spacing — for now
  // we still compare anchor positions, which is good enough for v1.)
  const neighbors = await db.planting.findMany({
    where: {
      seasonId,
      cell: { bedId: cell.bedId },
      id: { not: planting.id },
    },
    include: {
      plant: { select: { name: true, spacingInches: true } },
      cell: { select: { row: true, col: true } },
    },
  });

  const spacingWarnings = getSpacingWarnings(
    { row: cell.row, col: cell.col, spacingInches: plant.spacingInches },
    neighbors.map((n) => ({
      row: n.cell.row,
      col: n.cell.col,
      plantName: n.plant.name,
      spacingInches: n.plant.spacingInches,
    })),
    cell.bed.cellSizeIn
  );

  revalidatePath(`/garden/${cell.bed.gardenId}/beds/${cell.bedId}`);
  revalidatePath(`/garden/${cell.bed.gardenId}`);
  revalidatePath(`/dashboard`);
  return { spacingWarnings, footprintWarning };
}

/**
 * Move an existing planting to a different anchor cell (within the same
 * bed). Recomputes the footprint at the new anchor using the plant's
 * spacing, then atomically swaps the PlantingCell rows. The planting
 * record itself (and all its photos/harvest logs/notes/etc) is
 * preserved — only its location changes.
 *
 * Cross-bed moves are not supported in v1 — too many edge cases (different
 * cell sizes, different garden, possibly different season). Tap-to-remove
 * + re-plant in the new bed if you need cross-bed.
 */
export async function movePlanting(
  plantingId: string,
  newAnchorCellId: string
): Promise<{ footprintWarning?: string }> {
  const user = await requireUser();

  const planting = await db.planting.findFirst({
    where: { id: plantingId, cell: { bed: { garden: gardenEditFilter(user.id) } } },
    include: {
      plant: { select: { name: true, spacingInches: true } },
      cell: { select: { bedId: true } },
    },
  });
  if (!planting) throw new Error("Planting not found");

  const newAnchor = await db.cell.findFirst({
    where: { id: newAnchorCellId, bed: { garden: gardenEditFilter(user.id) } },
    include: { bed: true },
  });
  if (!newAnchor) throw new Error("Target cell not found");

  await assertBedWritable(user.id, user.subscriptionTier, newAnchor.bed.gardenId, newAnchor.bedId);

  // Same-bed enforcement — cross-bed moves are out of scope for v1.
  if (planting.cell.bedId !== newAnchor.bedId) {
    throw new Error("Can't move a planting between beds. Remove and replant instead.");
  }

  // No-op if anchoring on the same cell.
  if (newAnchorCellId === planting.cellId) return {};

  const placement = await resolveFootprint({
    anchorCell: {
      id: newAnchor.id,
      row: newAnchor.row,
      col: newAnchor.col,
      bedId: newAnchor.bedId,
    },
    bed: {
      gridRows: newAnchor.bed.gridRows,
      gridCols: newAnchor.bed.gridCols,
      cellSizeIn: newAnchor.bed.cellSizeIn,
    },
    spacingInches: planting.plant.spacingInches,
    seasonId: planting.seasonId,
    excludePlantingId: planting.id,
  });

  if (placement.blockedCells) {
    throw new Error(
      placement.sideCells > 1
        ? `Not enough room there — ${planting.plant.name} needs a clear ${placement.sideCells}×${placement.sideCells} area.`
        : "That cell is already occupied."
    );
  }
  const primary = placement.cells.find((c) => c.isPrimary);
  if (!primary) {
    throw new Error("That cell is already occupied.");
  }

  // Atomically: remove old PlantingCell rows, update anchor pointer,
  // insert new PlantingCell rows. The Planting row itself (and all of
  // its photos/logs/notes/reminders) is untouched.
  await db.$transaction(async (tx) => {
    await tx.plantingCell.deleteMany({ where: { plantingId } });
    await tx.planting.update({
      where: { id: plantingId },
      data: { cellId: newAnchorCellId },
    });
    await tx.plantingCell.createMany({
      data: placement.cells.map((c) => ({
        plantingId,
        cellId: c.cellId,
        isPrimary: c.isPrimary,
      })),
    });
  });

  revalidatePath(`/garden/${newAnchor.bed.gardenId}/beds/${newAnchor.bedId}`);
  revalidatePath(`/garden/${newAnchor.bed.gardenId}`);
  revalidatePath(`/dashboard`);

  if (placement.footprintReduced) {
    return {
      footprintWarning: `${planting.plant.name} normally needs a ${placement.sideCells}×${placement.sideCells} area, but this bed only fits ${placement.cells.length} of ${placement.desiredFootprint} cells.`,
    };
  }
  return {};
}

/**
 * Bulk variant of assignPlant for the multi-select flow. Loops over
 * cellIds and tries to plant the same plant in each, with full footprint
 * logic per anchor.
 *
 * Side effects: each successful placement creates a Planting + its
 * PlantingCell rows and schedules reminders. If a later cell's footprint
 * overlaps an earlier one, the later cell is SKIPPED entirely (footprints
 * never shrink around neighbors — they stay rectangles), and the summary
 * reports it in `skipped`.
 *
 * Returns a summary the UI can use to surface one consolidated toast
 * instead of N separate ones.
 */
export async function bulkAssignPlant(
  cellIds: string[],
  plantId: string,
  seasonId: string
): Promise<{
  planted: number;
  skipped: number;
  reduced: number;
}> {
  if (cellIds.length === 0) return { planted: 0, skipped: 0, reduced: 0 };
  // Each cell is several queries + a transaction, run serially — an
  // unbounded list is a resource-exhaustion vector. The UI can't select
  // more cells than the bed has, and beds cap well below this.
  if (cellIds.length > MAX_BULK_CELLS) {
    throw new Error(`Too many cells selected (max ${MAX_BULK_CELLS})`);
  }

  let planted = 0;
  let skipped = 0;
  let reduced = 0;

  // Serial loop — multi-cell footprints depend on earlier placements
  // having landed (so the next iteration can see them as occupied).
  // Parallelizing would race on overlapping-footprint pairs.
  for (const cellId of cellIds) {
    try {
      const result = await assignPlant(cellId, plantId, seasonId);
      planted++;
      if (result.footprintWarning) reduced++;
    } catch (err) {
      // "This cell is already occupied" — expected if a prior anchor's
      // footprint covered this one. Surface as skipped, not failure.
      skipped++;
      console.warn(`bulkAssignPlant: cell ${cellId} skipped:`, err instanceof Error ? err.message : err);
    }
  }

  return { planted, skipped, reduced };
}

export async function removePlanting(plantingId: string) {
  const user = await requireUser();

  const planting = await db.planting.findFirst({
    where: { id: plantingId, cell: { bed: { garden: gardenEditFilter(user.id) } } },
    include: { cell: { include: { bed: true } } },
  });
  if (!planting) throw new Error("Planting not found");

  // Pending reminders must go with the planting — plantingId is SetNull on
  // delete, so without this the cron keeps nudging about a removed plant.
  // Already-sent ones stay as history.
  await db.$transaction([
    db.reminder.deleteMany({ where: { plantingId, sentAt: null } }),
    db.planting.delete({ where: { id: plantingId } }),
  ]);
  revalidatePath(`/garden/${planting.cell.bed.gardenId}/beds/${planting.cell.bedId}`);
  revalidatePath(`/garden/${planting.cell.bed.gardenId}`);
  revalidatePath(`/dashboard`);
}

export async function updateCellSun(cellId: string, sunLevel: SunLevel) {
  const user = await requireUser();
  const cell = await resolveCell(cellId, user.id);

  await db.cell.update({ where: { id: cellId }, data: { sunLevel } });
  revalidatePath(`/garden/${cell.bed.gardenId}/beds/${cell.bedId}`);
}

export async function updatePlantingStatus(plantingId: string, status: PlantingStatus) {
  const user = await requireUser();

  const planting = await db.planting.findFirst({
    where: { id: plantingId, cell: { bed: { garden: gardenEditFilter(user.id) } } },
    include: { cell: { include: { bed: true } } },
  });
  if (!planting) throw new Error("Planting not found");

  await db.planting.update({
    where: { id: plantingId },
    data: {
      status,
      // Reasonable inference, still editable in the Dates section.
      ...(status === "TRANSPLANTED" && !planting.transplantDate
        ? { transplantDate: new Date() }
        : {}),
    },
  });

  // Doing the task in the bed must clear the nag — otherwise the user
  // reconciles two systems by hand. Non-fatal: the status write stands.
  try {
    await syncRemindersToStatus(plantingId, status);
  } catch (err) {
    console.error("reminder sync failed (non-fatal):", err);
  }

  revalidatePath(`/garden/${planting.cell.bed.gardenId}/beds/${planting.cell.bedId}`);
  revalidatePath("/reminders");
  revalidatePath("/dashboard");
}

export async function updatePlantingStartMethod(
  plantingId: string,
  startMethod: PlantStartMethod
) {
  const user = await requireUser();

  const planting = await db.planting.findFirst({
    where: { id: plantingId, cell: { bed: { garden: gardenEditFilter(user.id) } } },
    include: {
      cell: { include: { bed: true } },
      plant: {
        select: { name: true, indoorStartWeeks: true, transplantWeeks: true, daysToMaturity: true },
      },
    },
  });
  if (!planting) throw new Error("Planting not found");

  await db.planting.update({ where: { id: plantingId }, data: { startMethod } });

  // Reminders depend on the method (no "start seeds" reminder for a bought
  // start, etc.). Clear this planting's reminders and regenerate for the new
  // method, preserving any planted date the user has already entered. The
  // method change above is already committed, so a transient reminder failure
  // must not 500 the action — regeneration is non-fatal.
  try {
    const garden = await db.garden.findUniqueOrThrow({
      where: { id: planting.cell.bed.gardenId },
      select: { lastFrostDate: true },
    });
    await db.reminder.deleteMany({ where: { plantingId } });
    await createRemindersForPlanting({
      plantingId,
      gardenId: planting.cell.bed.gardenId,
      userId: user.id,
      plant: planting.plant,
      garden,
      plantedDate: planting.plantedDate,
      startMethod,
    });
  } catch (err) {
    console.error("reminder regeneration failed (non-fatal):", err);
  }

  revalidatePath(`/garden/${planting.cell.bed.gardenId}/beds/${planting.cell.bedId}`);
  revalidatePath(`/garden/${planting.cell.bed.gardenId}/beds/${planting.cell.bedId}/plantings/${plantingId}`);
}

export async function updatePlantingMeta(
  plantingId: string,
  data: { notes?: string | null; variety?: string | null }
) {
  const user = await requireUser();

  const planting = await db.planting.findFirst({
    where: { id: plantingId, cell: { bed: { garden: gardenEditFilter(user.id) } } },
    include: { cell: { include: { bed: true } } },
  });
  if (!planting) throw new Error("Planting not found");

  const update: { notes?: string | null; variety?: string | null } = {};
  if (data.notes !== undefined) update.notes = data.notes?.trim() || null;
  if (data.variety !== undefined) update.variety = data.variety?.trim() || null;

  await db.planting.update({ where: { id: plantingId }, data: update });
  revalidatePath(`/garden/${planting.cell.bed.gardenId}/beds/${planting.cell.bedId}`);
  revalidatePath(`/garden/${planting.cell.bed.gardenId}/beds/${planting.cell.bedId}/plantings/${plantingId}`);
}

export async function updatePlantingRating(
  plantingId: string,
  data: { rating?: number | null; growAgain?: boolean | null }
) {
  const user = await requireUser();

  const planting = await db.planting.findFirst({
    where: { id: plantingId, cell: { bed: { garden: gardenEditFilter(user.id) } } },
    include: { cell: { include: { bed: true } } },
  });
  if (!planting) throw new Error("Planting not found");

  const update: { rating?: number | null; growAgain?: boolean | null } = {};
  if (data.rating !== undefined) {
    if (data.rating !== null && (data.rating < 1 || data.rating > 5)) {
      throw new Error("Rating must be between 1 and 5");
    }
    update.rating = data.rating;
  }
  if (data.growAgain !== undefined) update.growAgain = data.growAgain;

  await db.planting.update({ where: { id: plantingId }, data: update });
  revalidatePath(`/garden/${planting.cell.bed.gardenId}/beds/${planting.cell.bedId}/plantings/${plantingId}`);
  revalidatePath(`/garden/${planting.cell.bed.gardenId}/seasons`);
}

export async function updatePlantingDates(
  plantingId: string,
  data: { plantedDate?: string | null; transplantDate?: string | null }
) {
  const user = await requireUser();

  const planting = await db.planting.findFirst({
    where: { id: plantingId, cell: { bed: { garden: gardenEditFilter(user.id) } } },
    include: {
      plant: { select: { name: true, daysToMaturity: true } },
      cell: { include: { bed: true } },
    },
  });
  if (!planting) throw new Error("Planting not found");

  const plantedDate =
    data.plantedDate !== undefined
      ? data.plantedDate ? new Date(data.plantedDate) : null
      : planting.plantedDate;

  let expectedHarvestDate: Date | null = planting.expectedHarvestDate;
  if (plantedDate && planting.plant.daysToMaturity) {
    expectedHarvestDate = new Date(plantedDate);
    expectedHarvestDate.setDate(expectedHarvestDate.getDate() + planting.plant.daysToMaturity);
  } else if (!plantedDate) {
    expectedHarvestDate = null;
  }

  const update: Record<string, Date | null> = { expectedHarvestDate };
  if (data.plantedDate !== undefined)
    update.plantedDate = data.plantedDate ? new Date(data.plantedDate) : null;
  if (data.transplantDate !== undefined)
    update.transplantDate = data.transplantDate ? new Date(data.transplantDate) : null;

  await db.planting.update({ where: { id: plantingId }, data: update });

  if (plantedDate && planting.plant.daysToMaturity) {
    await upsertHarvestReminder(
      plantingId,
      plantedDate,
      planting.plant.daysToMaturity,
      user.id,
      planting.cell.bed.gardenId,
      planting.plant.name
    );
  }

  revalidatePath(`/garden/${planting.cell.bed.gardenId}/beds/${planting.cell.bedId}`);
}
