"use server";
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
import { validateGardenDimensions } from "@/lib/validation";

export async function updateBedPosition(bedId: string, xPosition: number, yPosition: number) {
  const user = await requireUser();

  const bed = await db.bed.findFirst({
    where: { id: bedId, garden: gardenEditFilter(user.id) },
  });
  if (!bed) throw new Error("Bed not found");

  await assertBedWritable(user.id, user.subscriptionTier, bed.gardenId, bedId);

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

  await assertGardenWritable(user.id, user.subscriptionTier, gardenId);

  validateGardenDimensions({
    widthFt: input.widthFt ?? garden.widthFt,
    heightFt: input.heightFt ?? garden.heightFt,
  });

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
  // Validate the MM-DD format and real month/day ranges — an unchecked
  // string like "13-99" silently rolls over into a wrong date downstream
  // (JS Date overflow), producing plausible-but-wrong reminder timing.
  const validFrost = (v: string | null | undefined): string | null => {
    const t = (v ?? "").trim();
    if (!t) return null;
    const m = /^(\d{2})-(\d{2})$/.exec(t);
    const month = m ? Number(m[1]) : 0;
    const day = m ? Number(m[2]) : 0;
    if (!m || month < 1 || month > 12 || day < 1 || day > 31) {
      throw new Error("Frost date must be a valid MM-DD (e.g. 04-15)");
    }
    return t;
  };
  if (input.lastFrostDate !== undefined) data.lastFrostDate = validFrost(input.lastFrostDate);
  if (input.firstFrostDate !== undefined) data.firstFrostDate = validFrost(input.firstFrostDate);

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

  const name = input.gardenName.trim();
  if (!name) throw new Error("Garden name is required");
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
        lastFrostDate: input.lastFrostDate,
        firstFrostDate: input.firstFrostDate,
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
  if (!garden) throw new Error("Garden not found");
  await writeActiveGarden(gardenId);
  revalidatePath("/", "layout");
}
