"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { gardenEditFilter } from "@/lib/permissions";
import { assignPlant } from "@/app/actions/planting";
import { generateBedLayout, type LayoutAssignment } from "@/lib/services/smart-layout";
import { MAX_BULK_CELLS } from "@/lib/validation";

export async function generateLayoutAction(
  bedId: string,
  seasonId: string,
  wishlistPlantIds: string[]
): Promise<{ assignments: LayoutAssignment[]; error?: string }> {
  const user = await requireUser();
  if (user.subscriptionTier !== "PRO") {
    return { assignments: [], error: "UPGRADE_REQUIRED" };
  }

  const bed = await db.bed.findFirst({
    where: { id: bedId, garden: gardenEditFilter(user.id) },
    include: {
      garden: { select: { usdaZone: true, lastFrostDate: true } },
      cells: {
        include: {
          plantings: { where: { seasonId }, select: { id: true } },
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
          isOccupied: c.plantings.length > 0,
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
): Promise<{ planted: number }> {
  const user = await requireUser();

  // Client-supplied list; each accepted assignment runs the full
  // assignPlant path (queries + transaction + reminders) serially.
  if (assignments.length > MAX_BULK_CELLS) {
    throw new Error(`Too many assignments (max ${MAX_BULK_CELLS})`);
  }

  const bed = await db.bed.findFirst({
    where: { id: bedId, garden: gardenEditFilter(user.id) },
    select: { id: true, gardenId: true },
  });
  if (!bed) throw new Error("Bed not found");

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
  for (const a of assignments) {
    if (!allowedIds.has(a.plantId)) continue;
    const cellId = cellByPos.get(`${a.row},${a.col}`);
    if (!cellId) continue;
    try {
      await assignPlant(cellId, a.plantId, seasonId);
      planted++;
    } catch {
      // Cell already occupied (footprint overlap or pre-existing) — skip.
    }
  }

  revalidatePath(`/garden/${bed.gardenId}/beds/${bedId}`);
  revalidatePath(`/garden/${bed.gardenId}`);
  revalidatePath(`/dashboard`);
  return { planted };
}
