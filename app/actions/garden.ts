"use server";
import { ActionError } from "@/lib/action-error";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { gardenEditFilter, gardenAccessFilter } from "@/lib/permissions";
import { getLocationData } from "@/lib/data/location";
import { assertGardenWritable, assertBedWritable, checkCanCreateGarden } from "@/lib/tier";
import {
  writeActiveGarden,
  clearActiveGarden,
  getActiveGardenCookie,
} from "@/lib/active-garden";
import { validateGardenDimensions, requiredText, optionalText, validateFrostMmdd, MAX_NAME_CHARS, MAX_NOTES_CHARS } from "@/lib/validation";

export async function updateBedPosition(bedId: string, xPosition: number, yPosition: number) {
  const user = await requireUser();

  const bed = await db.bed.findFirst({
    where: { id: bedId, garden: gardenEditFilter(user.id) },
  });
  if (!bed) throw new ActionError("NOT_FOUND", "Bed not found");

  await assertBedWritable(bed.gardenId, bedId);

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
  if (!garden) throw new ActionError("NOT_FOUND", "Garden not found");

  await assertGardenWritable(gardenId);

  validateGardenDimensions({
    widthFt: input.widthFt ?? garden.widthFt,
    heightFt: input.heightFt ?? garden.heightFt,
  });

  const data: Record<string, unknown> = {};

  if (input.name !== undefined) data.name = requiredText(input.name, "Name", MAX_NAME_CHARS);
  if (input.description !== undefined) {
    data.description = optionalText(input.description, "Description", MAX_NOTES_CHARS);
  }
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
  if (input.lastFrostDate !== undefined) data.lastFrostDate = validateFrostMmdd(input.lastFrostDate);
  if (input.firstFrostDate !== undefined) data.firstFrostDate = validateFrostMmdd(input.firstFrostDate);

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
  if (!garden) throw new ActionError("NOT_FOUND", "Garden not found");

  // Pending reminders tied to this garden (frost/water/custom via gardenId,
  // planting reminders via the bed chain) go with it — both FKs are SetNull,
  // so otherwise the cron keeps sending "Frost risk at <deleted garden>".
  await db.$transaction([
    db.reminder.deleteMany({
      where: {
        sentAt: null,
        OR: [{ gardenId }, { planting: { cell: { bed: { gardenId } } } }],
      },
    }),
    db.garden.delete({ where: { id: gardenId } }),
  ]);
  // If the deleted garden was the active one, clear the cookie so the
  // resolver falls back cleanly instead of pointing at a dead id.
  if ((await getActiveGardenCookie()) === gardenId) {
    await clearActiveGarden();
  }
  revalidatePath("/dashboard");
  revalidatePath("/garden");
  redirect("/garden");
}

type CreateGardenInput = {
  gardenName: string;
  widthFt: number;
  heightFt: number;
  zip: string;
  zone: string;
  lastFrostDate: string | null;
  firstFrostDate: string | null;
};

/**
 * Create an additional garden + its first active season. Mirrors the garden
 * setup in completeOnboarding (app/actions/onboarding.ts) minus the
 * onboardingComplete flag and the optional first bed (beds are added in the
 * editor afterward). Tier-gated: Free is capped at 1 garden. The new garden
 * becomes the active one so the user lands in it.
 */
export async function createGarden(input: CreateGardenInput): Promise<string> {
  const user = await requireUser();
  await checkCanCreateGarden(user.id, user.subscriptionTier);

  const name = requiredText(input.gardenName, "Garden name", MAX_NAME_CHARS);
  validateGardenDimensions(input);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  let seasonName: string;
  if (month >= 2 && month <= 4) seasonName = `Spring ${year}`;
  else if (month >= 5 && month <= 7) seasonName = `Summer ${year}`;
  else if (month >= 8 && month <= 10) seasonName = `Fall ${year}`;
  else seasonName = `Winter ${year}`;

  let gardenId = "";
  await db.$transaction(async (tx) => {
    const garden = await tx.garden.create({
      data: {
        userId: user.id,
        name,
        locationZip: input.zip || null,
        locationDisplay: input.zone ? `Zone ${input.zone}` : null,
        usdaZone: input.zone || null,
        // Validated here too — the wizard path is what every new user hits.
        lastFrostDate: validateFrostMmdd(input.lastFrostDate),
        firstFrostDate: validateFrostMmdd(input.firstFrostDate),
        widthFt: input.widthFt,
        heightFt: input.heightFt,
      },
    });
    gardenId = garden.id;

    await tx.season.create({
      data: {
        gardenId: garden.id,
        name: seasonName,
        startDate: new Date(year, 0, 1),
        isActive: true,
      },
    });
  });

  await writeActiveGarden(gardenId);
  revalidatePath("/dashboard");
  revalidatePath("/garden");
  return gardenId;
}

/**
 * Switch which garden is "active" (drives the /garden map page). Validates the
 * user can access the garden, then persists it to the active-garden cookie.
 */
export async function setActiveGarden(gardenId: string): Promise<void> {
  const user = await requireUser();
  const garden = await db.garden.findFirst({
    where: { id: gardenId, ...gardenAccessFilter(user.id) },
    select: { id: true },
  });
  if (!garden) throw new ActionError("NOT_FOUND", "Garden not found");
  await writeActiveGarden(gardenId);
  revalidatePath("/", "layout");
}
