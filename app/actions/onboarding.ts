"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkCanCreateGarden } from "@/lib/tier";

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

export async function completeOnboarding(input: OnboardingInput): Promise<string> {
  const user = await requireUser();
  await checkCanCreateGarden(user.id, user.subscriptionTier);

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
        name: input.gardenName,
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

    if (input.bed) {
      const { name, widthFt, heightFt, cellSizeIn } = input.bed;
      const gridCols = Math.max(1, Math.floor(widthFt * (12 / cellSizeIn)));
      const gridRows = Math.max(1, Math.floor(heightFt * (12 / cellSizeIn)));

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
  return gardenId;
}
