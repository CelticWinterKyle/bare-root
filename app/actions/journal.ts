"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { gardenEditFilter } from "@/lib/permissions";
import { gardenNoteSchema } from "@/lib/validation";

/**
 * Garden-level journal note — a GrowthNote with gardenId set and no
 * plantingId ("aphids on the east bed"). Planting-level notes live in
 * app/actions/tracking.ts (addGrowthNote); the two are mutually exclusive
 * per row (see the GrowthNote schema comment).
 */
export async function addGardenNote(gardenId: string, body: string) {
  const user = await requireUser();

  const parsed = gardenNoteSchema.safeParse({ gardenId, body });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid note");
  }

  const garden = await db.garden.findFirst({
    where: { id: parsed.data.gardenId, ...gardenEditFilter(user.id) },
    select: { id: true },
  });
  if (!garden) throw new Error("Garden not found");

  await db.growthNote.create({
    data: { gardenId: garden.id, body: parsed.data.body },
  });

  revalidatePath(`/garden/${garden.id}`);
  revalidatePath(`/garden/${garden.id}/journal`);
}
