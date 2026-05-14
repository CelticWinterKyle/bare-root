"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { gardenEditFilter } from "@/lib/permissions";
import { getLocationData } from "@/lib/data/location";

export async function updateBedPosition(bedId: string, xPosition: number, yPosition: number) {
  const user = await requireUser();

  const bed = await db.bed.findFirst({
    where: { id: bedId, garden: gardenEditFilter(user.id) },
  });
  if (!bed) throw new Error("Bed not found");

  await db.bed.update({ where: { id: bedId }, data: { xPosition, yPosition } });
  revalidatePath(`/garden/${bed.gardenId}`);
}

type UpdateGardenInput = {
  name?: string;
  description?: string | null;
  widthFt?: number;
  heightFt?: number;
  locationZip?: string | null;
  lastFrostDate?: string | null;
  firstFrostDate?: string | null;
};

export async function updateGarden(gardenId: string, input: UpdateGardenInput): Promise<void> {
  const user = await requireUser();

  const garden = await db.garden.findFirst({
    where: { id: gardenId, ...gardenEditFilter(user.id) },
  });
  if (!garden) throw new Error("Garden not found");

  if (input.widthFt !== undefined && input.widthFt <= 0) {
    throw new Error("Width must be greater than 0");
  }
  if (input.heightFt !== undefined && input.heightFt <= 0) {
    throw new Error("Height must be greater than 0");
  }

  const data: Record<string, unknown> = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new Error("Name is required");
    data.name = name;
  }
  if (input.description !== undefined) data.description = input.description?.trim() || null;
  if (input.widthFt !== undefined) data.widthFt = input.widthFt;
  if (input.heightFt !== undefined) data.heightFt = input.heightFt;

  // Zip code change — re-derive zone and (if user didn't provide explicit
  // overrides) frost dates from the lookup table.
  if (input.locationZip !== undefined) {
    const zip = input.locationZip?.trim() || null;
    data.locationZip = zip;
    if (zip) {
      const loc = getLocationData(zip);
      if (loc) {
        data.usdaZone = loc.zone;
        if (input.lastFrostDate === undefined) data.lastFrostDate = loc.lastFrostDate;
        if (input.firstFrostDate === undefined) data.firstFrostDate = loc.firstFrostDate;
      } else {
        data.usdaZone = null;
      }
    } else {
      data.usdaZone = null;
    }
  }

  // Explicit frost-date overrides (always win over zip-derived values).
  if (input.lastFrostDate !== undefined) data.lastFrostDate = input.lastFrostDate;
  if (input.firstFrostDate !== undefined) data.firstFrostDate = input.firstFrostDate;

  await db.garden.update({ where: { id: gardenId }, data });
  revalidatePath(`/garden/${gardenId}`);
  revalidatePath(`/garden/${gardenId}/settings`);
  revalidatePath("/dashboard");
  revalidatePath("/garden");
  revalidatePath("/calendar");
}

export async function deleteGarden(gardenId: string): Promise<void> {
  const user = await requireUser();

  const garden = await db.garden.findFirst({
    where: { id: gardenId, userId: user.id },
  });
  if (!garden) throw new Error("Garden not found");

  await db.garden.delete({ where: { id: gardenId } });
  revalidatePath("/dashboard");
  revalidatePath("/garden");
  redirect("/garden");
}
