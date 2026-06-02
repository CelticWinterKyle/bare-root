import { resolveLastFrostDate, formatPlantingDate } from "./planting-calendar";

// The three ways a plant can get into the ground, each with different timing.
export type StartMethod = "BUY_START" | "DIRECT_SOW" | "SEED_INDOORS";

export type StartOption = {
  method: StartMethod;
  /** Can this method produce a harvest before the upcoming first frost? */
  feasibleThisSeason: boolean;
  /** When to do the action (buy/sow today; start-indoors before next last frost). */
  plantByDate: Date | null;
  /** Estimated harvest date (null if the plant has no days-to-maturity). */
  harvestDate: Date | null;
  /** One-line guidance, e.g. "Buy a start now → harvest ~Aug 30". */
  summary: string;
};

export type Feasibility = {
  options: StartOption[];
  /** The single method to guide the user toward. */
  recommended: StartMethod;
  /** Whether the recommendation produces a harvest this season (vs next spring). */
  recommendedThisSeason: boolean;
  /** The recommended option, for convenience. */
  recommendedOption: StartOption;
};

type PlantTiming = {
  daysToMaturity: number | null;
  indoorStartWeeks: number | null;
  transplantWeeks: number | null;
};

type FrostDates = {
  lastFrostDate: string | null; // "MM-DD"
  firstFrostDate: string | null; // "MM-DD"
};

const DAY = 24 * 60 * 60 * 1000;
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY);

// Days a purchased start has already grown — i.e. the early-growth portion of a
// direct-sow crop's days-to-maturity that you skip by buying a transplant.
const START_HEAD_START_DAYS = 21;

/** The next upcoming first-frost date relative to `today` (rolls to next year if past). */
function resolveFirstFrost(mmdd: string, today: Date): Date {
  const [m, d] = mmdd.split("-").map(Number);
  const y = today.getFullYear();
  const candidate = new Date(y, m - 1, d);
  return candidate < today ? new Date(y + 1, m - 1, d) : candidate;
}

const LABEL: Record<StartMethod, string> = {
  BUY_START: "Buy a start",
  DIRECT_SOW: "Direct sow",
  SEED_INDOORS: "Start seeds indoors",
};

/**
 * Given a plant's timing, the garden's frost dates, and today, work out which
 * of the three start methods can still produce a harvest this season — and
 * which one to recommend. Anchored to TODAY, so it answers "what can I do
 * right now?" rather than only the spring seed schedule.
 *
 * Note: daysToMaturity is measured from sowing for some crops and from
 * transplant for others, and the library doesn't distinguish — so direct-sow
 * vs buy-start dates are estimates. Surfaced as "~" in the summaries.
 */
export function getStartOptions(
  plant: PlantTiming,
  frost: FrostDates,
  today: Date = new Date()
): Feasibility {
  const dtm = plant.daysToMaturity;
  const indoorWeeks = plant.indoorStartWeeks ?? 0;
  const isTransplantCrop = indoorWeeks > 0; // crops normally started indoors
  const firstFrost = frost.firstFrostDate ? resolveFirstFrost(frost.firstFrostDate, today) : null;

  // A harvest is feasible if it lands on/before first frost (or there's no
  // frost data to constrain it).
  const fits = (harvest: Date | null) =>
    harvest != null && (firstFrost == null || harvest <= firstFrost);

  // BUY_START — a transplant-ready start goes in the ground today. days-to-
  // maturity counts from transplant for transplant crops (use it as-is), but
  // from sowing for direct-sow crops — so subtract the early growth a bought
  // start already has.
  const buyDays = dtm != null ? Math.max(dtm - (isTransplantCrop ? 0 : START_HEAD_START_DAYS), 7) : null;
  const buyHarvest = buyDays != null ? addDays(today, buyDays) : null;
  const buyStart: StartOption = {
    method: "BUY_START",
    feasibleThisSeason: fits(buyHarvest),
    plantByDate: today,
    harvestDate: buyHarvest,
    summary: buyHarvest
      ? `Buy a start now → harvest ~${formatPlantingDate(buyHarvest)}`
      : "Buy a start and plant it now",
  };

  // DIRECT_SOW — seed straight in the ground today; add the head-start a
  // transplant would have had (germination + early growth) for slow crops.
  const sowHarvest = dtm != null ? addDays(today, dtm + indoorWeeks * 7) : null;
  const directSow: StartOption = {
    method: "DIRECT_SOW",
    feasibleThisSeason: fits(sowHarvest),
    plantByDate: today,
    harvestDate: sowHarvest,
    summary: sowHarvest
      ? `Direct sow now → harvest ~${formatPlantingDate(sowHarvest)}`
      : "Direct sow seeds now",
  };

  // SEED_INDOORS — the spring schedule; mid-season this resolves to next year.
  let seedPlantBy: Date | null = null;
  let seedHarvest: Date | null = null;
  if (frost.lastFrostDate) {
    const lastFrost = resolveLastFrostDate(frost.lastFrostDate);
    seedPlantBy = addDays(lastFrost, -indoorWeeks * 7);
    const transplant = addDays(lastFrost, (plant.transplantWeeks ?? 0) * 7);
    seedHarvest = dtm != null ? addDays(transplant, dtm) : null;
  }
  const seedIndoors: StartOption = {
    method: "SEED_INDOORS",
    feasibleThisSeason: false, // the indoor-start window is the next spring cycle
    plantByDate: seedPlantBy,
    harvestDate: seedHarvest,
    summary: seedPlantBy
      ? `Start seeds indoors ${formatPlantingDate(seedPlantBy)}`
      : "Start from seed indoors next spring",
  };

  const options = [buyStart, directSow, seedIndoors];

  // Recommendation — the natural method for the plant if it still fits this
  // season; otherwise the spring seed-start path.
  let recommended: StartMethod;
  let recommendedThisSeason: boolean;
  if (isTransplantCrop) {
    if (buyStart.feasibleThisSeason) {
      recommended = "BUY_START";
      recommendedThisSeason = true;
    } else {
      recommended = "SEED_INDOORS";
      recommendedThisSeason = false;
    }
  } else {
    if (directSow.feasibleThisSeason) {
      recommended = "DIRECT_SOW";
      recommendedThisSeason = true;
    } else if (buyStart.feasibleThisSeason) {
      recommended = "BUY_START";
      recommendedThisSeason = true;
    } else {
      recommended = "DIRECT_SOW";
      recommendedThisSeason = false;
    }
  }

  const recommendedOption = options.find((o) => o.method === recommended)!;

  return { options, recommended, recommendedThisSeason, recommendedOption };
}

/** Display label for a method (for selectors / chips). */
export function startMethodLabel(method: StartMethod): string {
  return LABEL[method];
}
