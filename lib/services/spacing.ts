export type SpacingWarning = {
  neighborPlantName: string;
  distanceIn: number;
  requiredIn: number;
};

type NeighborCell = {
  row: number;
  col: number;
  plantName: string;
  spacingInches: number | null;
};

export function getSpacingWarnings(
  target: { row: number; col: number; spacingInches: number | null },
  neighbors: NeighborCell[],
  cellSizeIn: number
): SpacingWarning[] {
  if (!target.spacingInches) return [];

  const warnings: SpacingWarning[] = [];
  for (const n of neighbors) {
    const dRow = Math.abs(target.row - n.row);
    const dCol = Math.abs(target.col - n.col);
    const distanceIn = Math.round(Math.sqrt(dRow ** 2 + dCol ** 2) * cellSizeIn);
    const requiredIn = Math.max(target.spacingInches, n.spacingInches ?? 0);
    if (distanceIn < requiredIn) {
      warnings.push({ neighborPlantName: n.plantName, distanceIn, requiredIn });
    }
  }
  return warnings;
}
