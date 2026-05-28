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

/**
 * How many of a plant fit in a bed of the given dimensions, using the same
 * footprint rule as planting placement: each plant occupies a
 * ceil(spacing / cellSize) square of cells. Returns whole plants.
 */
export function plantsPerArea(
  spacingInches: number | null,
  widthFt: number,
  heightFt: number,
  cellSizeIn: number
): number {
  const spacing = spacingInches ?? cellSizeIn;
  const sideCells = Math.max(1, Math.ceil(spacing / cellSizeIn));
  const cols = Math.floor((widthFt * 12) / cellSizeIn);
  const rows = Math.floor((heightFt * 12) / cellSizeIn);
  const fitCols = Math.floor(cols / sideCells);
  const fitRows = Math.floor(rows / sideCells);
  return Math.max(0, fitCols * fitRows);
}

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
