"use server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { gardenEditFilter } from "@/lib/permissions";
import { generateBedLayout, type LayoutAssignment } from "@/lib/services/smart-layout";

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
) {
  const user = await requireUser();

  const bed = await db.bed.findFirst({
    where: { id: bedId, garden: gardenEditFilter(user.id) },
    include: {
      cells: {
        include: {
          plantings: { where: { seasonId }, select: { id: true } },
        },
      },
    },
  });
  if (!bed) throw new Error("Bed not found");

  // Build cell map
  const cellMap = new Map(bed.cells.map((c) => [`${c.row},${c.col}`, c]));

  await db.$transaction(
    assignments
      .filter((a) => {
        const cell = cellMap.get(`${a.row},${a.col}`);
        return cell && cell.plantings.length === 0;
      })
      .map((a) => {
        const cell = cellMap.get(`${a.row},${a.col}`)!;
        return db.planting.create({
          data: {
            cellId: cell.id,
            seasonId,
            plantId: a.plantId,
            status: "PLANNED",
            quantityPerCell: 1,
          },
        });
      })
  );

  const { revalidatePath } = await import("next/cache");
  revalidatePath(`/garden/${bed.gardenId}/beds/${bedId}`);
}
