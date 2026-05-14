"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { put } from "@vercel/blob";
import { checkCanUploadPhoto } from "@/lib/tier";

async function resolvePlanting(plantingId: string, userId: string) {
  const p = await db.planting.findFirst({
    where: { id: plantingId, cell: { bed: { garden: { userId } } } },
    include: { cell: { include: { bed: true } } },
  });
  if (!p) throw new Error("Planting not found");
  return p;
}

function revalidatePlanting(planting: { cell: { bed: { gardenId: string; id: string } }; id: string }) {
  revalidatePath(`/garden/${planting.cell.bed.gardenId}/beds/${planting.cell.bed.id}/plantings/${planting.id}`);
}

// ─── Harvest Logs ─────────────────────────────────────────────────────────────

export async function addHarvestLog(
  plantingId: string,
  data: { quantity: number; unit: string; notes?: string; harvestedAt?: string }
) {
  const user = await requireUser();
  const planting = await resolvePlanting(plantingId, user.id);

  const harvestedAt = data.harvestedAt ? new Date(data.harvestedAt) : new Date();

  await db.harvestLog.create({
    data: {
      plantingId,
      quantity: data.quantity,
      unit: data.unit,
      notes: data.notes || null,
      harvestedAt,
    },
  });

  // Set actualHarvestDate to the earliest harvest date logged.
  const existing = await db.planting.findUnique({
    where: { id: plantingId },
    select: { actualHarvestDate: true },
  });
  if (!existing?.actualHarvestDate || harvestedAt < existing.actualHarvestDate) {
    await db.planting.update({
      where: { id: plantingId },
      data: { actualHarvestDate: harvestedAt },
    });
  }

  revalidatePlanting(planting);
  revalidatePath(`/garden/${planting.cell.bed.gardenId}/seasons`);
}

export async function deleteHarvestLog(logId: string) {
  const user = await requireUser();
  const log = await db.harvestLog.findFirst({
    where: { id: logId, planting: { cell: { bed: { garden: { userId: user.id } } } } },
    include: { planting: { include: { cell: { include: { bed: true } } } } },
  });
  if (!log) throw new Error("Log not found");

  await db.harvestLog.delete({ where: { id: logId } });
  revalidatePlanting(log.planting);
}

// ─── Photos ───────────────────────────────────────────────────────────────────

export async function uploadPhoto(plantingId: string, formData: FormData) {
  const user = await requireUser();
  const planting = await resolvePlanting(plantingId, user.id);

  await checkCanUploadPhoto(user.id, user.subscriptionTier);

  const file = formData.get("file") as File;
  if (!file || file.size === 0) throw new Error("No file provided");

  const ext = file.name.split(".").pop() ?? "jpg";
  const blob = await put(`plantings/${plantingId}/${Date.now()}.${ext}`, file, {
    access: "public",
  });

  const caption = (formData.get("caption") as string) || null;
  await db.plantingPhoto.create({
    data: { plantingId, url: blob.url, caption },
  });

  revalidatePlanting(planting);
}

export async function deletePhoto(photoId: string) {
  const user = await requireUser();
  const photo = await db.plantingPhoto.findFirst({
    where: { id: photoId, planting: { cell: { bed: { garden: { userId: user.id } } } } },
    include: { planting: { include: { cell: { include: { bed: true } } } } },
  });
  if (!photo) throw new Error("Photo not found");

  const { del } = await import("@vercel/blob");
  await del(photo.url);
  await db.plantingPhoto.delete({ where: { id: photoId } });
  revalidatePlanting(photo.planting);
}

// ─── Growth Notes ─────────────────────────────────────────────────────────────

export async function addGrowthNote(plantingId: string, body: string) {
  const user = await requireUser();
  const planting = await resolvePlanting(plantingId, user.id);

  await db.growthNote.create({ data: { plantingId, body } });
  revalidatePlanting(planting);
}

export async function deleteGrowthNote(noteId: string) {
  const user = await requireUser();
  const note = await db.growthNote.findFirst({
    where: { id: noteId, planting: { cell: { bed: { garden: { userId: user.id } } } } },
    include: { planting: { include: { cell: { include: { bed: true } } } } },
  });
  if (!note) throw new Error("Note not found");

  await db.growthNote.delete({ where: { id: noteId } });
  revalidatePlanting(note.planting);
}

// ─── Seed Inventory ───────────────────────────────────────────────────────────

export async function upsertSeedInventory(data: {
  plantId: string;
  variety: string;
  quantity: number;
  unit: string;
  notes?: string;
}) {
  const user = await requireUser();
  await db.seedInventory.upsert({
    where: { userId_plantId_variety: { userId: user.id, plantId: data.plantId, variety: data.variety } },
    create: { userId: user.id, ...data, notes: data.notes || null },
    update: { quantity: data.quantity, unit: data.unit, notes: data.notes || null },
  });
  revalidatePath("/inventory");
}

export async function deleteSeedInventory(id: string) {
  const user = await requireUser();
  await db.seedInventory.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/inventory");
}
