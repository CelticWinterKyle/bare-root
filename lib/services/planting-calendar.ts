// Resolve MM-DD frost date to the next upcoming absolute date
export function resolveLastFrostDate(mmdd: string): Date {
  const [month, day] = mmdd.split("-").map(Number);
  const now = new Date();
  const thisYear = now.getFullYear();
  const candidate = new Date(thisYear, month - 1, day);
  return candidate < now ? new Date(thisYear + 1, month - 1, day) : candidate;
}

// True while this year's frost date is still upcoming — i.e. the spring
// schedule (start seeds indoors, transplant out) still belongs to the
// current growing cycle. False once it has passed: resolveLastFrostDate
// would roll to next year, which is a different season entirely.
export function frostBelongsToCurrentCycle(mmdd: string): boolean {
  const [month, day] = mmdd.split("-").map(Number);
  const now = new Date();
  return new Date(now.getFullYear(), month - 1, day) >= now;
}

export function calculateStartSeedsDate(
  lastFrostDate: string,
  indoorStartWeeks: number
): Date {
  const frost = resolveLastFrostDate(lastFrostDate);
  const d = new Date(frost);
  d.setDate(d.getDate() - indoorStartWeeks * 7);
  return d;
}

export function calculateTransplantDate(
  lastFrostDate: string,
  transplantWeeks: number
): Date {
  const frost = resolveLastFrostDate(lastFrostDate);
  const d = new Date(frost);
  d.setDate(d.getDate() + transplantWeeks * 7);
  return d;
}

export function calculateExpectedHarvest(
  plantedDate: Date,
  daysToMaturity: number
): Date {
  const d = new Date(plantedDate);
  d.setDate(d.getDate() + daysToMaturity);
  return d;
}

export function formatPlantingDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
