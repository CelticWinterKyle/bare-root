import type { PlantCategory } from "@/lib/generated/prisma/enums";

/**
 * Informational pest/disease reference. There's no regional/seasonal
 * pest-pressure data source, so this is NOT a time-based alert system — it
 * just tells a gardener what to watch for on a given plant. Coverage comes
 * from category defaults (every plant gets something), a name-keyed override
 * for common crops (more specific), and any Perenual `pest_susceptibility`
 * persisted on the plant row.
 */

type PestInfo = { pests: string[]; diseases: string[] };

const CATEGORY_DEFAULTS: Record<PlantCategory, PestInfo> = {
  VEGETABLE: {
    pests: ["Aphids", "Cutworms", "Flea beetles"],
    diseases: ["Powdery mildew", "Root rot"],
  },
  FRUIT: {
    pests: ["Aphids", "Spider mites", "Fruit flies"],
    diseases: ["Powdery mildew", "Anthracnose"],
  },
  HERB: {
    pests: ["Aphids", "Spider mites", "Whiteflies"],
    diseases: ["Powdery mildew", "Root rot"],
  },
  FLOWER: {
    pests: ["Aphids", "Thrips", "Japanese beetles"],
    diseases: ["Powdery mildew", "Botrytis (gray mold)"],
  },
  TREE: {
    pests: ["Scale insects", "Borers", "Aphids"],
    diseases: ["Anthracnose", "Root rot"],
  },
  SHRUB: {
    pests: ["Aphids", "Scale insects", "Spider mites"],
    diseases: ["Powdery mildew", "Leaf spot"],
  },
  OTHER: {
    pests: ["Aphids", "Slugs & snails"],
    diseases: ["Powdery mildew"],
  },
};

// Keyed by a lowercase substring of the plant name; first match wins.
const NAME_OVERRIDES: { match: string; info: PestInfo }[] = [
  { match: "tomato", info: { pests: ["Tomato hornworm", "Aphids", "Whiteflies"], diseases: ["Early blight", "Late blight", "Blossom-end rot"] } },
  { match: "pepper", info: { pests: ["Aphids", "Flea beetles", "Hornworms"], diseases: ["Bacterial leaf spot", "Blossom-end rot"] } },
  { match: "potato", info: { pests: ["Colorado potato beetle", "Aphids"], diseases: ["Late blight", "Scab"] } },
  { match: "lettuce", info: { pests: ["Aphids", "Slugs & snails", "Cutworms"], diseases: ["Downy mildew", "Bottom rot"] } },
  { match: "spinach", info: { pests: ["Leaf miners", "Aphids"], diseases: ["Downy mildew", "Leaf spot"] } },
  { match: "carrot", info: { pests: ["Carrot rust fly", "Aphids", "Nematodes"], diseases: ["Leaf blight", "Cavity spot"] } },
  { match: "bean", info: { pests: ["Mexican bean beetle", "Aphids", "Spider mites"], diseases: ["Bean rust", "Anthracnose", "Mosaic virus"] } },
  { match: "squash", info: { pests: ["Squash bugs", "Squash vine borer", "Cucumber beetles"], diseases: ["Powdery mildew", "Bacterial wilt"] } },
  { match: "zucchini", info: { pests: ["Squash bugs", "Squash vine borer", "Cucumber beetles"], diseases: ["Powdery mildew", "Bacterial wilt"] } },
  { match: "cucumber", info: { pests: ["Cucumber beetles", "Aphids", "Spider mites"], diseases: ["Powdery mildew", "Downy mildew", "Bacterial wilt"] } },
  { match: "cabbage", info: { pests: ["Cabbage worm", "Cabbage looper", "Aphids"], diseases: ["Clubroot", "Black rot"] } },
  { match: "broccoli", info: { pests: ["Cabbage worm", "Cabbage looper", "Aphids"], diseases: ["Clubroot", "Downy mildew"] } },
  { match: "kale", info: { pests: ["Cabbage worm", "Aphids", "Flea beetles"], diseases: ["Clubroot", "Black rot"] } },
  { match: "basil", info: { pests: ["Aphids", "Japanese beetles", "Slugs"], diseases: ["Downy mildew", "Fusarium wilt"] } },
  { match: "strawberr", info: { pests: ["Slugs & snails", "Spider mites", "Aphids"], diseases: ["Gray mold", "Leaf spot"] } },
  { match: "onion", info: { pests: ["Onion thrips", "Onion maggot"], diseases: ["Downy mildew", "White rot"] } },
];

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

function dedupe(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of arr) {
    const v = titleCase(raw);
    const key = v.toLowerCase();
    if (v && !seen.has(key)) {
      seen.add(key);
      out.push(v);
    }
  }
  return out;
}

/**
 * Returns the pests/diseases to display for a plant. Merges (in priority
 * order) persisted Perenual pests, a name override if one matches, and the
 * category defaults — deduped. `persistedDiseases` is included if a future
 * source provides them; today only pests come from Perenual.
 */
export function pestInfoFor(
  category: PlantCategory,
  name: string,
  persistedPests: string[] = [],
  persistedDiseases: string[] = []
): PestInfo {
  const lower = name.toLowerCase();
  const override = NAME_OVERRIDES.find((o) => lower.includes(o.match))?.info;
  const base = CATEGORY_DEFAULTS[category] ?? CATEGORY_DEFAULTS.OTHER;

  const pests = dedupe([
    ...persistedPests,
    ...(override?.pests ?? []),
    ...base.pests,
  ]).slice(0, 6);

  const diseases = dedupe([
    ...persistedDiseases,
    ...(override?.diseases ?? []),
    ...base.diseases,
  ]).slice(0, 6);

  return { pests, diseases };
}
