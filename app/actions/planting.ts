"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { SunLevel, PlantingStatus } from "@/lib/generated/prisma/enums";
import { getSpacingWarnings, type SpacingWarning } from "@/lib/services/spacing";
import { createRemindersForPlanting, upsertHarvestReminder } from "@/lib/services/reminders";

async function resolveCell(cellId: string, userId: string) {
  const cell = await db.cell.findFirst({
    where: { id: cellId, bed: { garden: { userId } } },
    include: { bed: true },
  });
  if (!cell) throw new Error("Cell not found");
  return cell;
}

export async function assignPlant(
  cellId: string,
  plantId: string,
  seasonId: string
): Promise<{ spacingWarnings: SpacingWarning[] }> {
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

  const planting = await db.planting.create({
    data: { cellId, seasonId, plantId, status: "PLANNED", quantityPerCell: 1 },
  });

  await createRemindersForPlanting({
    plantingId: planting.id,
    gardenId: cell.bed.gardenId,
    userId: user.id,
    plant,
    garden,
  });

  // Check spacing against all other planted cells in this bed for this season
  const neighbors = await db.planting.findMany({
    where: {
      seasonId,
      cell: { bedId: cell.bedId },
      cellId: { not: cellId },
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
  return { spacingWarnings };
}

export async function removePlanting(plantingId: string) {
  const user = await requireUser();

  const planting = await db.planting.findFirst({
    where: { id: plantingId, cell: { bed: { garden: { userId: user.id } } } },
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
    where: { id: plantingId, cell: { bed: { garden: { userId: user.id } } } },
    include: { cell: { include: { bed: true } } },
  });
  if (!planting) throw new Error("Planting not found");

  await db.planting.update({ where: { id: plantingId }, data: { status } });
  revalidatePath(`/garden/${planting.cell.bed.gardenId}/beds/${planting.cell.bedId}`);
}

export async function updatePlantingDates(
  plantingId: string,
  data: { plantedDate?: string | null; transplantDate?: string | null }
) {
  const user = await requireUser();

  const planting = await db.planting.findFirst({
    where: { id: plantingId, cell: { bed: { garden: { userId: user.id } } } },
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
