"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function updateBedPosition(bedId: string, xPosition: number, yPosition: number) {
  const user = await requireUser();

  const bed = await db.bed.findFirst({
    where: { id: bedId, garden: { userId: user.id } },
  });
  if (!bed) throw new Error("Bed not found");

  await db.bed.update({ where: { id: bedId }, data: { xPosition, yPosition } });
  revalidatePath(`/garden/${bed.gardenId}`);
}
