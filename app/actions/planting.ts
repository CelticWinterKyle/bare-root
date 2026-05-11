"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { SunLevel, PlantingStatus } from "@/lib/generated/prisma/enums";

async function resolveCell(cellId: string, userId: string) {
  const cell = await db.cell.findFirst({
    where: { id: cellId, bed: { garden: { userId } } },
    include: { bed: true },
  });
  if (!cell) throw new Error("Cell not found");
  return cell;
}

export async function assignPlant(cellId: string, plantId: string, seasonId: string) {
  const user = await requireUser();
  const cell = await resolveCell(cellId, user.id);

  await db.planting.create({
    data: { cellId, seasonId, plantId, status: "PLANNED", quantityPerCell: 1 },
  });

  revalidatePath(`/garden/${cell.bed.gardenId}/beds/${cell.bedId}`);
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
