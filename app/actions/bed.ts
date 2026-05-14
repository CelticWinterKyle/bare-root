"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { gardenEditFilter } from "@/lib/permissions";
import { checkCanCreateBed } from "@/lib/tier";

type CreateBedInput = {
  gardenId: string;
  name: string;
  widthFt: number;
  heightFt: number;
  cellSizeIn: 12 | 6;
};

export async function createBed(input: CreateBedInput): Promise<string> {
  const user = await requireUser();

  const garden = await db.garden.findFirst({
    where: { id: input.gardenId, ...gardenEditFilter(user.id) },
  });
  if (!garden) throw new Error("Garden not found");

  await checkCanCreateBed(input.gardenId, user.subscriptionTier);

  const gridCols = Math.max(1, Math.floor(input.widthFt * (12 / input.cellSizeIn)));
  const gridRows = Math.max(1, Math.floor(input.heightFt * (12 / input.cellSizeIn)));

  const existingCount = await db.bed.count({ where: { gardenId: input.gardenId } });

  let bedId = "";

  await db.$transaction(async (tx) => {
    const bed = await tx.bed.create({
      data: {
        gardenId: input.gardenId,
        name: input.name,
        xPosition: (existingCount % 3) * (input.widthFt + 1),
        yPosition: Math.floor(existingCount / 3) * (input.heightFt + 1),
        widthFt: input.widthFt,
        heightFt: input.heightFt,
        gridCols,
        gridRows,
        cellSizeIn: input.cellSizeIn,
      },
    });
    bedId = bed.id;

    const cells: { bedId: string; row: number; col: number }[] = [];
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        cells.push({ bedId: bed.id, row, col });
      }
    }
    if (cells.length > 0) {
      await tx.cell.createMany({ data: cells });
    }
  });

  revalidatePath(`/garden/${input.gardenId}`);
  return bedId;
}

export async function deleteBed(bedId: string): Promise<void> {
  const user = await requireUser();

  const bed = await db.bed.findFirst({
    where: { id: bedId, garden: gardenEditFilter(user.id) },
  });
  if (!bed) throw new Error("Bed not found");

  await db.bed.delete({ where: { id: bedId } });
  revalidatePath(`/garden/${bed.gardenId}`);
}

type UpdateBedInput = {
  name?: string;
  widthFt?: number;
  heightFt?: number;
  cellSizeIn?: 12 | 6;
};

export async function updateBed(bedId: string, input: UpdateBedInput): Promise<void> {
  const user = await requireUser();

  const bed = await db.bed.findFirst({
    where: { id: bedId, garden: gardenEditFilter(user.id) },
  });
  if (!bed) throw new Error("Bed not found");

  const nextWidthFt = input.widthFt ?? bed.widthFt;
  const nextHeightFt = input.heightFt ?? bed.heightFt;
  const nextCellSizeIn = input.cellSizeIn ?? bed.cellSizeIn;

  if (nextWidthFt <= 0 || nextHeightFt <= 0) {
    throw new Error("Dimensions must be greater than 0");
  }

  const nextGridCols = Math.max(1, Math.floor(nextWidthFt * (12 / nextCellSizeIn)));
  const nextGridRows = Math.max(1, Math.floor(nextHeightFt * (12 / nextCellSizeIn)));

  const dimensionsChanged =
    nextGridCols !== bed.gridCols || nextGridRows !== bed.gridRows;

  await db.$transaction(async (tx) => {
    if (dimensionsChanged) {
      // Cell layout is changing — wipe existing cells (cascades to plantings)
      // and rebuild the grid from scratch. This is destructive but
      // deterministic and avoids edge cases around mismatched cell-size
      // resampling (e.g. 12" → 6" doubles density and old row/col coords
      // no longer line up).
      await tx.cell.deleteMany({ where: { bedId } });
      const cells: { bedId: string; row: number; col: number }[] = [];
      for (let row = 0; row < nextGridRows; row++) {
        for (let col = 0; col < nextGridCols; col++) {
          cells.push({ bedId, row, col });
        }
      }
      if (cells.length > 0) {
        await tx.cell.createMany({ data: cells });
      }
    }

    await tx.bed.update({
      where: { id: bedId },
      data: {
        name: input.name?.trim() || bed.name,
        widthFt: nextWidthFt,
        heightFt: nextHeightFt,
        cellSizeIn: nextCellSizeIn,
        gridCols: nextGridCols,
        gridRows: nextGridRows,
      },
    });
  });

  revalidatePath(`/garden/${bed.gardenId}`);
  revalidatePath(`/garden/${bed.gardenId}/beds/${bedId}`);
}
