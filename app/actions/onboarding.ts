"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkCanCreateGarden } from "@/lib/tier";
import { validateBedDimensions, validateGardenDimensions, requiredText, optionalText, validateFrostMmdd, MAX_NAME_CHARS } from "@/lib/validation";

type BedInput = {
  name: string;
  widthFt: number;
  heightFt: number;
  cellSizeIn: 12 | 6;
};

type OnboardingInput = {
  gardenName: string;
  widthFt: number;
  heightFt: number;
  zip: string;
  zone: string;
  lastFrostDate: string | null;
  firstFrostDate: string | null;
  bed?: BedInput;
};

export async function completeOnboarding(
  input: OnboardingInput
): Promise<{ gardenId: string; bedId: string | null }> {
 try {
  const user = await requireUser();
  await checkCanCreateGarden(user.id, user.subscriptionTier);

  validateGardenDimensions(input);
  const gardenName = requiredText(input.gardenName, "Garden name", MAX_NAME_CHARS);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  let seasonName: string;
  if (month >= 2 && month <= 4) seasonName = `Spring ${year}`;
  else if (month >= 5 && month <= 7) seasonName = `Summer ${year}`;
  else if (month >= 8 && month <= 10) seasonName = `Fall ${year}`;
  else seasonName = `Winter ${year}`;

  let gardenId = "";
  let bedId: string | null = null;

  await db.$transaction(async (tx) => {
    const garden = await tx.garden.create({
      data: {
        userId: user.id,
        name: gardenName,
        locationZip: input.zip || null,
        locationDisplay: input.zone ? `Zone ${input.zone}` : null,
        usdaZone: input.zone || null,
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

    if (input.bed) {
      const { widthFt, heightFt, cellSizeIn } = input.bed;
      const name = optionalText(input.bed.name, "Bed name", MAX_NAME_CHARS) ?? "Bed 1";
      const { gridCols, gridRows } = validateBedDimensions(input.bed);

      const bed = await tx.bed.create({
        data: {
          gardenId: garden.id,
          name,
          xPosition: 0,
          yPosition: 0,
          widthFt,
          heightFt,
          gridCols,
          gridRows,
          cellSizeIn,
        },
      });
      bedId = bed.id;

      const cells: { bedId: string; row: number; col: number }[] = [];
      for (let row = 0; row < gridRows; row++) {
        for (let col = 0; col < gridCols; col++) {
          cells.push({ bedId: bed.id, row, col });
        }
      }
      if (cells.length > 0) {
        await tx.cell.createMany({ data: cells });
      }
    }

    await tx.user.update({
      where: { id: user.id },
      data: { onboardingComplete: true },
    });
  });

  revalidatePath("/dashboard");
  return { gardenId, bedId };
 } catch (err) {
    // Surface the real cause in the server logs — production sanitizes the
    // message before it reaches the client, so without this we're blind.
    // Log only the shape-relevant fields, not the full input (it carries
    // the user's zip and would sit in Vercel/Sentry logs).
    console.error(
      `[completeOnboarding] failed | garden ${input.widthFt}x${input.heightFt} | bed: ${
        input.bed ? `${input.bed.widthFt}x${input.bed.heightFt}@${input.bed.cellSizeIn}"` : "none"
      } | error:`,
      err
    );
    throw err;
 }
}
