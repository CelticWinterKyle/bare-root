import { resolveLastFrostDate } from "./planting-calendar";

export type SuccessionSuggestion = {
  plantName: string;
  plantId: string;
  bedName: string;
  gardenName: string;
  daysToMaturity: number;
  suggestedPlantDate: Date;
  estimatedHarvest: Date;
};

// Plants with daysToMaturity ≤ 60 are fast crops — candidates for succession
const MAX_DAYS_FOR_SUCCESSION = 60;

type ActivePlanting = {
  plant: {
    id: string;
    name: string;
    daysToMaturity: number | null;
    transplantWeeks: number | null;
  };
  plantedDate: Date | null;
  expectedHarvestDate: Date | null;
  bedName: string;
  gardenName: string;
};

export function getSuccessionSuggestions(
  plantings: ActivePlanting[],
  firstFrostDate: string | null,
  lookaheadDays = 90
): SuccessionSuggestion[] {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() + lookaheadDays);

  // Hard stop: first frost date this year
  let frostStop = cutoff;
  if (firstFrostDate) {
    const [m, d] = firstFrostDate.split("-").map(Number);
    const thisYear = now.getFullYear();
    const frost = new Date(thisYear, m - 1, d);
    if (frost > now) frostStop = frost;
  }

  const suggestions: SuccessionSuggestion[] = [];
  const seen = new Set<string>();

  for (const p of plantings) {
    const { plant } = p;
    if (!plant.daysToMaturity || plant.daysToMaturity > MAX_DAYS_FOR_SUCCESSION) continue;

    // Only suggest if we have an expected harvest date — plant is "in progress"
    const harvestDate = p.expectedHarvestDate ?? p.plantedDate;
    if (!harvestDate) continue;

    // Suggest planting a second round 2 weeks after current harvest
    const suggestedPlantDate = new Date(harvestDate);
    suggestedPlantDate.setDate(suggestedPlantDate.getDate() + 14);

    const estimatedHarvest = new Date(suggestedPlantDate);
    estimatedHarvest.setDate(estimatedHarvest.getDate() + plant.daysToMaturity);

    // Skip if estimated harvest would be after first frost
    if (estimatedHarvest > frostStop) continue;
    // Skip if suggested plant date is in the past or too far out
    if (suggestedPlantDate < now || suggestedPlantDate > cutoff) continue;

    const key = `${plant.id}-${p.bedName}`;
    if (seen.has(key)) continue;
    seen.add(key);

    suggestions.push({
      plantName: plant.name,
      plantId: plant.id,
      bedName: p.bedName,
      gardenName: p.gardenName,
      daysToMaturity: plant.daysToMaturity,
      suggestedPlantDate,
      estimatedHarvest,
    });
  }

  return suggestions.sort((a, b) => +a.suggestedPlantDate - +b.suggestedPlantDate);
}
