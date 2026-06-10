import { db } from "@/lib/db";

export type RotationWarning = {
  bedId: string;
  bedName: string;
  plantFamily: string;
  currentPlants: string[];
  previousPlants: string[];
  seasonName: string;
};

export type BedFamilyHistory = {
  family: string;
  plantNames: string[];
  /** Most recent past season in which the family grew in this bed. */
  seasonName: string;
};

/**
 * Plant families that grew in a bed during its 2 most recent past seasons —
 * powers the PLACEMENT-TIME rotation hint in the plant picker (warn before
 * planting), whereas getCropRotationWarnings only flags conflicts that
 * already exist among current plantings.
 */
export async function getBedFamilyHistory(
  gardenId: string,
  bedId: string,
  currentSeasonId: string
): Promise<BedFamilyHistory[]> {
  const pastSeasons = await db.season.findMany({
    where: { gardenId, id: { not: currentSeasonId }, isActive: false },
    orderBy: { startDate: "desc" },
    take: 2,
    select: {
      name: true,
      plantings: {
        where: { cell: { bedId } },
        select: { plant: { select: { name: true, plantFamily: true } } },
      },
    },
  });

  // Most-recent season first, so the first hit per family wins seasonName.
  const byFamily = new Map<string, { names: Set<string>; seasonName: string }>();
  for (const season of pastSeasons) {
    for (const p of season.plantings) {
      const family = p.plant.plantFamily;
      if (!family) continue;
      const cur = byFamily.get(family);
      if (cur) cur.names.add(p.plant.name);
      else byFamily.set(family, { names: new Set([p.plant.name]), seasonName: season.name });
    }
  }

  return [...byFamily.entries()].map(([family, v]) => ({
    family,
    plantNames: [...v.names],
    seasonName: v.seasonName,
  }));
}

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
