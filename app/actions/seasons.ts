"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function createSeason(
  gardenId: string,
  data: { name: string; startDate: string; endDate?: string; setActive: boolean }
) {
  const user = await requireUser();

  const garden = await db.garden.findFirst({ where: { id: gardenId, userId: user.id } });
  if (!garden) throw new Error("Garden not found");

  await db.$transaction(async (tx) => {
    if (data.setActive) {
      await tx.season.updateMany({ where: { gardenId }, data: { isActive: false } });
    }
    await tx.season.create({
      data: {
        gardenId,
        name: data.name,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        isActive: data.setActive,
      },
    });
  });

  revalidatePath(`/garden/${gardenId}`);
  revalidatePath(`/garden/${gardenId}/seasons`);
}

export async function setActiveSeason(seasonId: string) {
  const user = await requireUser();

  const season = await db.season.findFirst({
    where: { id: seasonId, garden: { userId: user.id } },
  });
  if (!season) throw new Error("Season not found");

  await db.$transaction([
    db.season.updateMany({ where: { gardenId: season.gardenId }, data: { isActive: false } }),
    db.season.update({ where: { id: seasonId }, data: { isActive: true } }),
  ]);

  revalidatePath(`/garden/${season.gardenId}`);
  revalidatePath(`/garden/${season.gardenId}/seasons`);
}

export async function archiveSeason(seasonId: string) {
  const user = await requireUser();

  const season = await db.season.findFirst({
    where: { id: seasonId, garden: { userId: user.id } },
  });
  if (!season) throw new Error("Season not found");

  await db.season.update({ where: { id: seasonId }, data: { isActive: false, endDate: new Date() } });

  revalidatePath(`/garden/${season.gardenId}`);
  revalidatePath(`/garden/${season.gardenId}/seasons`);
}

export async function ratePlanting(
  plantingId: string,
  data: { rating: number | null; growAgain: boolean | null }
) {
  const user = await requireUser();

  const planting = await db.planting.findFirst({
    where: { id: plantingId, cell: { bed: { garden: { userId: user.id } } } },
    include: { cell: { include: { bed: true } } },
  });
  if (!planting) throw new Error("Planting not found");

  await db.planting.update({ where: { id: plantingId }, data });

  revalidatePath(`/garden/${planting.cell.bed.gardenId}/seasons`);
}
