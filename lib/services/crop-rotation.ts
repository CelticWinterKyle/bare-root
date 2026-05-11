import { db } from "@/lib/db";

export type RotationWarning = {
  bedId: string;
  bedName: string;
  plantFamily: string;
  currentPlants: string[];
  previousPlants: string[];
  seasonName: string;
};

export async function getCropRotationWarnings(
  gardenId: string,
  currentSeasonId: string
): Promise<RotationWarning[]> {
  // Get current season's plantings grouped by bed + family
  const currentPlantings = await db.planting.findMany({
    where: { seasonId: currentSeasonId, cell: { bed: { gardenId } } },
    include: {
      plant: { select: { name: true, plantFamily: true } },
      cell: { include: { bed: { select: { id: true, name: true } } } },
    },
  });

  // Get the 2 most recent past seasons for this garden
  const pastSeasons = await db.season.findMany({
    where: { gardenId, id: { not: currentSeasonId }, isActive: false },
    orderBy: { startDate: "desc" },
    take: 2,
    include: {
      plantings: {
        include: {
          plant: { select: { name: true, plantFamily: true } },
          cell: { include: { bed: { select: { id: true } } } },
        },
      },
    },
  });

  if (pastSeasons.length === 0) return [];

  // Build map: bedId → { plantFamily → [plantName, seasonName] }
  type PastEntry = { plantName: string; seasonName: string };
  const pastByBedFamily: Record<string, Record<string, PastEntry[]>> = {};

  for (const season of pastSeasons) {
    for (const p of season.plantings) {
      if (!p.plant.plantFamily) continue;
      const bedId = p.cell.bed.id;
      const family = p.plant.plantFamily;
      if (!pastByBedFamily[bedId]) pastByBedFamily[bedId] = {};
      if (!pastByBedFamily[bedId][family]) pastByBedFamily[bedId][family] = [];
      pastByBedFamily[bedId][family].push({ plantName: p.plant.name, seasonName: season.name });
    }
  }

  // For current plantings, check if same family grew in the same bed recently
  const warnings: RotationWarning[] = [];
  const seen = new Set<string>();

  for (const p of currentPlantings) {
    if (!p.plant.plantFamily) continue;
    const bedId = p.cell.bed.id;
    const family = p.plant.plantFamily;
    const key = `${bedId}-${family}`;
    if (seen.has(key)) continue;

    const past = pastByBedFamily[bedId]?.[family];
    if (!past || past.length === 0) continue;

    seen.add(key);

    const currentPlantsInBed = currentPlantings
      .filter((cp) => cp.cell.bed.id === bedId && cp.plant.plantFamily === family)
      .map((cp) => cp.plant.name);

    const uniquePrevious = [...new Map(past.map((e) => [e.plantName, e])).values()];

    warnings.push({
      bedId,
      bedName: p.cell.bed.name,
      plantFamily: family,
      currentPlants: [...new Set(currentPlantsInBed)],
      previousPlants: uniquePrevious.map((e) => e.plantName),
      seasonName: past[0].seasonName,
    });
  }

  return warnings;
}
