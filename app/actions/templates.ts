"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { gardenEditFilter } from "@/lib/permissions";
import { assertBedWritable, assertGardenWritable, checkCanCreateBed } from "@/lib/tier";
import { MAX_BULK_CELLS } from "@/lib/validation";
import { assignPlant } from "./planting";
import { createBed } from "./bed";

const MAX_USER_TEMPLATES = 50;
const MAX_TEMPLATE_NAME = 60;

/**
 * Snapshot a bed's current-season plantings as a reusable template. Stores
 * anchor positions only — applying replays them through assignPlant, which
 * recomputes footprints, so a template stays correct even if spacing data
 * changes later.
 */
export async function saveBedAsTemplate(bedId: string, seasonId: string, name: string) {
  const user = await requireUser();
  const trimmed = name.trim().slice(0, MAX_TEMPLATE_NAME);
  if (!trimmed) throw new Error("Give the template a name.");

  const bed = await db.bed.findFirst({
    where: { id: bedId, garden: gardenEditFilter(user.id) },
    select: { id: true, gridCols: true, gridRows: true, cellSizeIn: true },
  });
  if (!bed) throw new Error("Bed not found");

  const count = await db.bedTemplate.count({ where: { userId: user.id } });
  if (count >= MAX_USER_TEMPLATES) {
    throw new Error("Template limit reached — delete one first.");
  }

  const plantings = await db.planting.findMany({
    where: { seasonId, cell: { bedId } },
    select: { plantId: true, cell: { select: { row: true, col: true } } },
  });
  if (plantings.length === 0) throw new Error("Nothing planted to save yet.");

  const template = await db.bedTemplate.create({
    data: {
      userId: user.id,
      name: trimmed,
      gridCols: bed.gridCols,
      gridRows: bed.gridRows,
      cellSizeIn: bed.cellSizeIn,
      assignments: {
        create: plantings.map((p) => ({
          row: p.cell.row,
          col: p.cell.col,
          plantId: p.plantId,
        })),
      },
    },
  });
  return { templateId: template.id, plants: plantings.length };
}

export async function deleteTemplate(templateId: string) {
  const user = await requireUser();
  // Only the owner's templates — curated ones (userId null) can't be deleted.
  const deleted = await db.bedTemplate.deleteMany({
    where: { id: templateId, userId: user.id },
  });
  if (deleted.count === 0) throw new Error("Template not found");
}

/**
 * Apply a template to a bed: replay its anchor assignments through the
 * canonical assignPlant path (full footprint + reminders per plant, same as
 * smart-layout's accept). Occupied or out-of-bounds anchors are skipped.
 */
export async function applyTemplate(
  templateId: string,
  bedId: string,
  seasonId: string
): Promise<{ planted: number; skipped: number }> {
  const user = await requireUser();

  const template = await db.bedTemplate.findFirst({
    // Curated (userId null) or the caller's own.
    where: { id: templateId, OR: [{ userId: null }, { userId: user.id }] },
    include: { assignments: true },
  });
  if (!template) throw new Error("Template not found");
  if (template.assignments.length > MAX_BULK_CELLS) {
    throw new Error("Template too large");
  }

  const bed = await db.bed.findFirst({
    where: { id: bedId, garden: gardenEditFilter(user.id) },
    select: { id: true, gardenId: true },
  });
  if (!bed) throw new Error("Bed not found");
  await assertBedWritable(user.id, user.subscriptionTier, bed.gardenId, bedId);

  const cells = await db.cell.findMany({
    where: { bedId, OR: template.assignments.map((a) => ({ row: a.row, col: a.col })) },
    select: { id: true, row: true, col: true },
  });
  const cellByPos = new Map(cells.map((c) => [`${c.row},${c.col}`, c.id]));

  let planted = 0;
  let skipped = 0;
  // Serial, like bulk assign — later footprints must see earlier placements.
  for (const a of template.assignments) {
    const cellId = cellByPos.get(`${a.row},${a.col}`);
    if (!cellId) {
      skipped++; // template larger than this bed
      continue;
    }
    try {
      await assignPlant(cellId, a.plantId, seasonId);
      planted++;
    } catch {
      skipped++; // occupied / footprint blocked
    }
  }

  revalidatePath(`/garden/${bed.gardenId}/beds/${bedId}`);
  revalidatePath(`/garden/${bed.gardenId}`);
  return { planted, skipped };
}

/**
 * Duplicate a bed: same dimensions and (optionally) the same plantings in
 * the active season. The copy is placed by createBed's auto-layout.
 */
export async function duplicateBed(
  bedId: string,
  options?: { withPlantings?: boolean }
): Promise<{ newBedId: string; planted: number }> {
  const user = await requireUser();

  const bed = await db.bed.findFirst({
    where: { id: bedId, garden: gardenEditFilter(user.id) },
    select: {
      id: true,
      gardenId: true,
      name: true,
      widthFt: true,
      heightFt: true,
      cellSizeIn: true,
      garden: { select: { seasons: { where: { isActive: true }, select: { id: true } } } },
    },
  });
  if (!bed) throw new Error("Bed not found");
  await assertGardenWritable(user.id, user.subscriptionTier, bed.gardenId);
  await checkCanCreateBed(bed.gardenId, user.subscriptionTier);

  const newBedId = await createBed({
    gardenId: bed.gardenId,
    name: `${bed.name} copy`.slice(0, 60),
    widthFt: bed.widthFt,
    heightFt: bed.heightFt,
    cellSizeIn: bed.cellSizeIn as 12 | 6,
  });

  let planted = 0;
  const activeSeasonId = bed.garden.seasons[0]?.id;
  if (options?.withPlantings !== false && activeSeasonId) {
    const plantings = await db.planting.findMany({
      where: { seasonId: activeSeasonId, cell: { bedId } },
      select: { plantId: true, variety: true, cell: { select: { row: true, col: true } } },
    });
    const newCells = await db.cell.findMany({
      where: { bedId: newBedId },
      select: { id: true, row: true, col: true },
    });
    const cellByPos = new Map(newCells.map((c) => [`${c.row},${c.col}`, c.id]));
    for (const p of plantings) {
      const cellId = cellByPos.get(`${p.cell.row},${p.cell.col}`);
      if (!cellId) continue;
      try {
        const res = await assignPlant(cellId, p.plantId, activeSeasonId);
        if (p.variety) {
          await db.planting.update({ where: { id: res.plantingId }, data: { variety: p.variety } });
        }
        planted++;
      } catch {
        // skip blocked anchors — footprints replay in order
      }
    }
  }

  revalidatePath(`/garden/${bed.gardenId}`);
  return { newBedId, planted };
}

/** Templates visible to the user: curated built-ins + their own saves. */
export async function listTemplates() {
  const user = await requireUser();
  return db.bedTemplate.findMany({
    where: { OR: [{ userId: null }, { userId: user.id }] },
    include: {
      _count: { select: { assignments: true } },
    },
    orderBy: [{ userId: "asc" }, { createdAt: "desc" }], // curated (null) first
  });
}
