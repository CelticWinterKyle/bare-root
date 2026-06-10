"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { gardenEditFilter } from "@/lib/permissions";
import { put } from "@vercel/blob";
import { checkCanUploadPhoto, isProFeature } from "@/lib/tier";
import { validatePhotoUpload } from "@/lib/validation";

// Parse a date-only input ("YYYY-MM-DD") as LOCAL midnight. `new Date(str)`
// treats a bare date as UTC, which then displays as the previous day for
// anyone west of UTC. Falls back to full parsing for anything else.
function parseHarvestDate(s: string | undefined): Date {
  if (!s) return new Date();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(s);
}

async function resolvePlanting(plantingId: string, userId: string) {
  const p = await db.planting.findFirst({
    where: { id: plantingId, cell: { bed: { garden: gardenEditFilter(userId) } } },
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

  const harvestedAt = parseHarvestDate(data.harvestedAt);

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
    where: { id: logId, planting: { cell: { bed: { garden: gardenEditFilter(user.id) } } } },
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

  // Count photos against the garden OWNER (and their tier), not the
  // uploader — otherwise a collaborator's own count/tier would wrongly
  // govern photos on someone else's garden.
  const owner = await db.garden.findUnique({
    where: { id: planting.cell.bed.gardenId },
    select: { user: { select: { id: true, subscriptionTier: true } } },
  });
  if (owner?.user) {
    await checkCanUploadPhoto(owner.user.id, owner.user.subscriptionTier);
  }

  const file = formData.get("file") as File;
  if (!file || file.size === 0) throw new Error("No file provided");

  // Type/size gate: blobs are PUBLIC, so without this anything (SVG with
  // scripts, HTML, arbitrary files) gets hosted under our store. Extension
  // comes from the validated MIME type, never the client filename.
  const ext = validatePhotoUpload(file);
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
    where: { id: photoId, planting: { cell: { bed: { garden: gardenEditFilter(user.id) } } } },
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
    where: { id: noteId, planting: { cell: { bed: { garden: gardenEditFilter(user.id) } } } },
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
  if (!isProFeature(user.subscriptionTier)) throw new Error("UPGRADE_REQUIRED");
  await db.seedInventory.upsert({
    where: { userId_plantId_variety: { userId: user.id, plantId: data.plantId, variety: data.variety } },
    create: { userId: user.id, ...data, notes: data.notes || null },
    update: { quantity: data.quantity, unit: data.unit, notes: data.notes || null },
  });
  revalidatePath("/inventory");
}

export async function deleteSeedInventory(id: string) {
  const user = await requireUser();
  if (!isProFeature(user.subscriptionTier)) throw new Error("UPGRADE_REQUIRED");
  await db.seedInventory.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/inventory");
}
