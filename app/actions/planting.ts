"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { gardenEditFilter } from "@/lib/permissions";
import type { SunLevel, PlantingStatus } from "@/lib/generated/prisma/enums";
import { getSpacingWarnings, type SpacingWarning } from "@/lib/services/spacing";
import { createRemindersForPlanting, upsertHarvestReminder } from "@/lib/services/reminders";

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
  /** True iff some footprint cells got dropped (edge of bed or occupied). */
  footprintReduced: boolean;
};

/**
 * Computes which cells a plant would occupy when anchored at the given
 * row/col, using the "anchor at tap, extend LEFT and DOWN" convention.
 * Drops cells that fall outside the bed grid or are already occupied
 * by a planting in this season. The returned `cells` array always
 * contains the anchor cell if it itself is in bounds and free —
 * callers should check that before relying on the placement.
 */
async function resolveFootprint(args: {
  anchorCell: { id: string; row: number; col: number; bedId: string };
  bed: { gridRows: number; gridCols: number; cellSizeIn: number };
  spacingInches: number | null;
  seasonId: string;
}): Promise<FootprintPlacement> {
  const { anchorCell, bed, spacingInches, seasonId } = args;
  const spacing = spacingInches ?? bed.cellSizeIn;
  const sideCells = Math.max(1, Math.ceil(spacing / bed.cellSizeIn));

  // Anchor at tap, extend LEFT + DOWN — anchor is the top-right corner.
  // Rows: anchor.row .. anchor.row + sideCells - 1
  // Cols: anchor.col - sideCells + 1 .. anchor.col
  const desired: { row: number; col: number; isPrimary: boolean }[] = [];
  for (let dr = 0; dr < sideCells; dr++) {
    for (let dc = 0; dc < sideCells; dc++) {
      const row = anchorCell.row + dr;
      const col = anchorCell.col - dc;
      if (row >= bed.gridRows || col < 0) continue;
      desired.push({ row, col, isPrimary: dr === 0 && dc === 0 });
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

  // Drop cells already occupied in this season.
  const candidateIds = cellsInBed.map((c) => c.id);
  const occupied = await db.plantingCell.findMany({
    where: {
      cellId: { in: candidateIds },
      planting: { seasonId },
    },
    select: { cellId: true },
  });
  const occupiedSet = new Set(occupied.map((o) => o.cellId));

  const placed = desired
    .map((d) => {
      const id = cellByPos.get(`${d.row},${d.col}`);
      if (!id) return null;
      if (occupiedSet.has(id)) return null;
      return { cellId: id, row: d.row, col: d.col, isPrimary: d.isPrimary };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return {
    cells: placed,
    desiredFootprint: sideCells * sideCells,
    footprintReduced: placed.length < sideCells * sideCells,
  };
}

export async function assignPlant(
  cellId: string,
  plantId: string,
  seasonId: string
): Promise<{
  spacingWarnings: SpacingWarning[];
  footprintWarning?: string;
}> {
  const user = await requireUser();
  const cell = await resolveCell(cellId, user.id);

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
    select: { lastFrostDate: true },
  });

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

  const primary = placement.cells.find((c) => c.isPrimary);
  if (!primary) {
    // Anchor cell itself isn't placeable — either off-grid (shouldn't happen
    // since we just resolved it) or already occupied. Surface a clear error
    // so the picker can re-render without state drift.
    throw new Error("This cell is already occupied. Try another.");
  }

  // Create the planting + every footprint cell in one transaction.
  const planting = await db.$transaction(async (tx) => {
    const p = await tx.planting.create({
      data: { cellId, seasonId, plantId, status: "PLANNED", quantityPerCell: 1 },
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

  await createRemindersForPlanting({
    plantingId: planting.id,
    gardenId: cell.bed.gardenId,
    userId: user.id,
    plant,
    garden,
  });

  // Footprint warning — fired when we couldn't fit the plant's full
  // recommended area (edge of bed or neighbors in the way).
  let footprintWarning: string | undefined;
  if (placement.footprintReduced) {
    const sideCells = Math.ceil(placement.desiredFootprint ** 0.5);
    footprintWarning = `${plant.name} normally needs a ${sideCells}×${sideCells} area — planted in ${placement.cells.length} of ${placement.desiredFootprint} cells. Crowded plants may produce less.`;
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
  return { spacingWarnings, footprintWarning };
}

/**
 * Bulk variant of assignPlant for the multi-select flow. Loops over
 * cellIds and tries to plant the same plant in each, with full footprint
 * logic per anchor.
 *
 * Side effects: each successful placement creates a Planting + its
 * PlantingCell rows and schedules reminders. If a later cell's footprint
 * overlaps an earlier one, the later one still plants — just with a
 * reduced footprint (cells already taken get skipped, footprintReduced
 * fires). That matches the user's expectation when they bulk-select a
 * dense area: "fill what you can."
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

/**
 * Read-only footprint preview used by the picker UI to highlight which
 * cells a plant would occupy before the user commits. Mirrors the logic
 * in assignPlant's resolveFootprint but never writes.
 */
export async function previewFootprint(
  cellId: string,
  plantId: string,
  seasonId: string
): Promise<FootprintPlacement> {
  const user = await requireUser();
  const cell = await resolveCell(cellId, user.id);
  const plant = await db.plantLibrary.findUniqueOrThrow({
    where: { id: plantId },
    select: { spacingInches: true },
  });
  return resolveFootprint({
    anchorCell: { id: cell.id, row: cell.row, col: cell.col, bedId: cell.bedId },
    bed: {
      gridRows: cell.bed.gridRows,
      gridCols: cell.bed.gridCols,
      cellSizeIn: cell.bed.cellSizeIn,
    },
    spacingInches: plant.spacingInches,
    seasonId,
  });
}

export async function removePlanting(plantingId: string) {
  const user = await requireUser();

  const planting = await db.planting.findFirst({
    where: { id: plantingId, cell: { bed: { garden: gardenEditFilter(user.id) } } },
    include: { cell: { include: { bed: true } } },
  });
  if (!planting) throw new Error("Planting not found");

  await db.planting.delete({ where: { id: plantingId } });
  revalidatePath(`/garden/${planting.cell.bed.gardenId}/beds/${planting.cell.bedId}`);
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

  await db.planting.update({ where: { id: plantingId }, data: { status } });
  revalidatePath(`/garden/${planting.cell.bed.gardenId}/beds/${planting.cell.bedId}`);
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
