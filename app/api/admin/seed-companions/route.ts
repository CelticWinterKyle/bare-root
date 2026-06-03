import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const OWNER_EMAIL = "kyle@celticwinter.com";

type Pair = {
  plant: string;
  companion: string;
  type: "BENEFICIAL" | "HARMFUL";
  notes: string;
};

/**
 * Curated companion pairings for the 15 canonical plants that had zero
 * companion data, drawn from standard companion-planting references (not
 * generated). Names are the exact Title-Case canonical library names so the
 * lookup hits the curated entries, not the lowercase Perenual-import junk.
 * One row per pair — the bed editor reads relationships bidirectionally.
 */
const PAIRS: Pair[] = [
  // Cauliflower (brassica)
  { plant: "Cauliflower", companion: "Celery", type: "BENEFICIAL", notes: "Celery's scent helps mask brassicas from cabbage pests" },
  { plant: "Cauliflower", companion: "Dill", type: "BENEFICIAL", notes: "Attracts wasps that prey on cabbage worms" },
  { plant: "Cauliflower", companion: "Onion", type: "BENEFICIAL", notes: "Onion smell deters brassica pests" },
  { plant: "Cauliflower", companion: "Nasturtium", type: "BENEFICIAL", notes: "Trap crop that lures aphids away" },
  { plant: "Cauliflower", companion: "Tomato", type: "HARMFUL", notes: "Heavy feeders compete — keep apart" },
  { plant: "Cauliflower", companion: "Strawberry", type: "HARMFUL", notes: "Share pests and compete for nutrients" },

  // Swiss Chard
  { plant: "Swiss Chard", companion: "Bean", type: "BENEFICIAL", notes: "Beans fix nitrogen the chard draws on" },
  { plant: "Swiss Chard", companion: "Onion", type: "BENEFICIAL", notes: "Onions deter leaf miners and aphids" },
  { plant: "Swiss Chard", companion: "Cabbage", type: "BENEFICIAL", notes: "Similar needs; grow well side by side" },

  // Potato
  { plant: "Potato", companion: "Bean", type: "BENEFICIAL", notes: "Beans deter Colorado potato beetle and fix nitrogen" },
  { plant: "Potato", companion: "Corn", type: "BENEFICIAL", notes: "Compatible; corn gives light shade" },
  { plant: "Potato", companion: "Marigold", type: "BENEFICIAL", notes: "Repels nematodes and beetles" },
  { plant: "Potato", companion: "Cabbage", type: "BENEFICIAL", notes: "Compatible neighbors" },
  { plant: "Potato", companion: "Tomato", type: "HARMFUL", notes: "Same family — share blight and pests" },
  { plant: "Potato", companion: "Cucumber", type: "HARMFUL", notes: "Raises potato blight risk" },
  { plant: "Potato", companion: "Sunflower", type: "HARMFUL", notes: "Inhibits potato growth" },
  { plant: "Potato", companion: "Fennel", type: "HARMFUL", notes: "Allelopathic to most crops" },

  // Sweet Potato
  { plant: "Sweet Potato", companion: "Bean", type: "BENEFICIAL", notes: "Beans fix nitrogen for the vines" },
  { plant: "Sweet Potato", companion: "Nasturtium", type: "BENEFICIAL", notes: "Repels sweet potato weevils and aphids" },
  { plant: "Sweet Potato", companion: "Dill", type: "BENEFICIAL", notes: "Attracts beneficial insects" },

  // Eggplant (nightshade)
  { plant: "Eggplant", companion: "Bean", type: "BENEFICIAL", notes: "Beans deter Colorado potato beetle" },
  { plant: "Eggplant", companion: "Marigold", type: "BENEFICIAL", notes: "Repels nematodes and aphids" },
  { plant: "Eggplant", companion: "Pepper", type: "BENEFICIAL", notes: "Similar warm-season needs; grow well together" },
  { plant: "Eggplant", companion: "Basil", type: "BENEFICIAL", notes: "Repels thrips, aphids, and flea beetles" },
  { plant: "Eggplant", companion: "Nasturtium", type: "BENEFICIAL", notes: "Trap crop for aphids" },
  { plant: "Eggplant", companion: "Fennel", type: "HARMFUL", notes: "Allelopathic; inhibits growth" },

  // Watermelon (cucurbit)
  { plant: "Watermelon", companion: "Corn", type: "BENEFICIAL", notes: "Corn gives light shade and wind protection" },
  { plant: "Watermelon", companion: "Nasturtium", type: "BENEFICIAL", notes: "Repels cucumber beetles and squash bugs" },
  { plant: "Watermelon", companion: "Marigold", type: "BENEFICIAL", notes: "Deters beetles and nematodes" },
  { plant: "Watermelon", companion: "Radish", type: "BENEFICIAL", notes: "Trap-crops cucumber beetles" },
  { plant: "Watermelon", companion: "Potato", type: "HARMFUL", notes: "Compete and raise disease pressure" },

  // Cilantro (herb)
  { plant: "Cilantro", companion: "Tomato", type: "BENEFICIAL", notes: "Flowering cilantro attracts beneficial insects" },
  { plant: "Cilantro", companion: "Pepper", type: "BENEFICIAL", notes: "Attracts pollinators and predatory insects" },
  { plant: "Cilantro", companion: "Spinach", type: "BENEFICIAL", notes: "Compatible cool-season pairing" },
  { plant: "Cilantro", companion: "Bean", type: "BENEFICIAL", notes: "Draws beneficials that protect beans" },
  { plant: "Cilantro", companion: "Fennel", type: "HARMFUL", notes: "Cross-competes — keep apart" },

  // Thyme (herb)
  { plant: "Thyme", companion: "Cabbage", type: "BENEFICIAL", notes: "Thyme deters cabbage worms" },
  { plant: "Thyme", companion: "Tomato", type: "BENEFICIAL", notes: "Aromatic pest deterrent" },
  { plant: "Thyme", companion: "Strawberry", type: "BENEFICIAL", notes: "Ground-cover thyme deters pests" },
  { plant: "Thyme", companion: "Eggplant", type: "BENEFICIAL", notes: "Repels pests with aromatic foliage" },

  // Oregano (herb)
  { plant: "Oregano", companion: "Pepper", type: "BENEFICIAL", notes: "Aromatic foliage repels aphids" },
  { plant: "Oregano", companion: "Tomato", type: "BENEFICIAL", notes: "Good all-round companion; repels pests" },
  { plant: "Oregano", companion: "Cucumber", type: "BENEFICIAL", notes: "Deters cucumber beetles" },
  { plant: "Oregano", companion: "Bean", type: "BENEFICIAL", notes: "General pest protection" },

  // Celery
  { plant: "Celery", companion: "Bean", type: "BENEFICIAL", notes: "Beans fix nitrogen celery needs" },
  { plant: "Celery", companion: "Cabbage", type: "BENEFICIAL", notes: "Celery deters cabbage moths" },
  { plant: "Celery", companion: "Tomato", type: "BENEFICIAL", notes: "Compatible neighbors" },
  { plant: "Celery", companion: "Leek", type: "BENEFICIAL", notes: "Classic pairing; grow well together" },

  // Leek (allium)
  { plant: "Leek", companion: "Carrot", type: "BENEFICIAL", notes: "Leeks repel carrot fly; carrots repel leek moth" },
  { plant: "Leek", companion: "Celery", type: "BENEFICIAL", notes: "Mutually beneficial" },
  { plant: "Leek", companion: "Onion", type: "BENEFICIAL", notes: "Same family; compatible" },
  { plant: "Leek", companion: "Bean", type: "HARMFUL", notes: "Alliums inhibit legumes" },
  { plant: "Leek", companion: "Pea", type: "HARMFUL", notes: "Alliums stunt peas" },

  // Turnip
  { plant: "Turnip", companion: "Pea", type: "BENEFICIAL", notes: "Peas fix nitrogen for turnips" },
  { plant: "Turnip", companion: "Onion", type: "BENEFICIAL", notes: "Deters turnip aphids and pests" },
  { plant: "Turnip", companion: "Potato", type: "HARMFUL", notes: "Compete; potatoes weaken turnip growth" },

  // Brussels Sprouts (brassica)
  { plant: "Brussels Sprouts", companion: "Dill", type: "BENEFICIAL", notes: "Attracts wasps that prey on cabbage worms" },
  { plant: "Brussels Sprouts", companion: "Onion", type: "BENEFICIAL", notes: "Deters brassica pests" },
  { plant: "Brussels Sprouts", companion: "Nasturtium", type: "BENEFICIAL", notes: "Trap crop for aphids" },
  { plant: "Brussels Sprouts", companion: "Sage", type: "BENEFICIAL", notes: "Repels cabbage moths" },
  { plant: "Brussels Sprouts", companion: "Tomato", type: "HARMFUL", notes: "Heavy feeders — keep apart" },
  { plant: "Brussels Sprouts", companion: "Strawberry", type: "HARMFUL", notes: "Share pests and compete" },

  // Okra
  { plant: "Okra", companion: "Pepper", type: "BENEFICIAL", notes: "Shared warm-season needs; compatible" },
  { plant: "Okra", companion: "Basil", type: "BENEFICIAL", notes: "Repels aphids and flea beetles" },
  { plant: "Okra", companion: "Sunflower", type: "BENEFICIAL", notes: "Attracts pollinators" },
  { plant: "Okra", companion: "Pea", type: "BENEFICIAL", notes: "Peas fix nitrogen" },

  // Arugula
  { plant: "Arugula", companion: "Bean", type: "BENEFICIAL", notes: "Beans enrich soil for leafy growth" },
  { plant: "Arugula", companion: "Lettuce", type: "BENEFICIAL", notes: "Compatible cool-season greens" },
  { plant: "Arugula", companion: "Nasturtium", type: "BENEFICIAL", notes: "Lures flea beetles away" },
  { plant: "Arugula", companion: "Dill", type: "BENEFICIAL", notes: "Attracts beneficial insects" },
];

/**
 * Owner-only one-time seed: adds curated companion relationships for the
 * canonical plants that had none. Idempotent — skips any pair already present
 * in either direction, and any pair whose plant/companion name isn't found.
 *   GET /api/admin/seed-companions
 */
export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.email.toLowerCase() !== OWNER_EMAIL) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Resolve canonical plant ids by exact (case-sensitive) name.
  const names = [...new Set(PAIRS.flatMap((p) => [p.plant, p.companion]))];
  const plants = await db.plantLibrary.findMany({
    where: { name: { in: names } },
    select: { id: true, name: true },
  });
  const idByName = new Map<string, string>();
  for (const p of plants) {
    if (!idByName.has(p.name)) idByName.set(p.name, p.id);
  }

  const result = {
    added: 0,
    skippedExisting: 0,
    skippedMissing: [] as string[],
    addedPairs: [] as string[],
  };

  for (const pair of PAIRS) {
    const a = idByName.get(pair.plant);
    const b = idByName.get(pair.companion);
    if (!a || !b) {
      result.skippedMissing.push(`${pair.plant} + ${pair.companion}`);
      continue;
    }
    const existing = await db.companionRelation.findFirst({
      where: {
        type: pair.type,
        OR: [
          { plantId: a, relatedId: b },
          { plantId: b, relatedId: a },
        ],
      },
      select: { id: true },
    });
    if (existing) {
      result.skippedExisting++;
      continue;
    }
    await db.companionRelation.create({
      data: { plantId: a, relatedId: b, type: pair.type, notes: pair.notes },
    });
    result.added++;
    result.addedPairs.push(`${pair.type === "BENEFICIAL" ? "✓" : "✗"} ${pair.plant} + ${pair.companion}`);
  }

  return NextResponse.json({ ok: true, total: PAIRS.length, ...result });
}
