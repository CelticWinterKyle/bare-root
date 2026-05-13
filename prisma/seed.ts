import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const PLANTS = [
  { name: "Tomato", family: "Solanaceae", category: "VEGETABLE", days: 75, spacing: 24, sun: "FULL_SUN", water: "MODERATE", indoorStart: 6, transplant: 2 },
  { name: "Cherry Tomato", family: "Solanaceae", category: "VEGETABLE", days: 65, spacing: 24, sun: "FULL_SUN", water: "MODERATE", indoorStart: 6, transplant: 2 },
  { name: "Roma Tomato", family: "Solanaceae", category: "VEGETABLE", days: 78, spacing: 24, sun: "FULL_SUN", water: "MODERATE", indoorStart: 6, transplant: 2 },
  { name: "Basil", family: "Lamiaceae", category: "HERB", days: 30, spacing: 12, sun: "FULL_SUN", water: "MODERATE", indoorStart: 4, transplant: 1 },
  { name: "Pepper", family: "Solanaceae", category: "VEGETABLE", days: 80, spacing: 18, sun: "FULL_SUN", water: "MODERATE", indoorStart: 8, transplant: 2 },
  { name: "Bell Pepper", family: "Solanaceae", category: "VEGETABLE", days: 75, spacing: 18, sun: "FULL_SUN", water: "MODERATE", indoorStart: 8, transplant: 2 },
  { name: "Jalapeño", family: "Solanaceae", category: "VEGETABLE", days: 75, spacing: 18, sun: "FULL_SUN", water: "MODERATE", indoorStart: 8, transplant: 2 },
  { name: "Serrano Pepper", family: "Solanaceae", category: "VEGETABLE", days: 75, spacing: 18, sun: "FULL_SUN", water: "MODERATE", indoorStart: 8, transplant: 2 },
  { name: "Habanero Pepper", family: "Solanaceae", category: "VEGETABLE", days: 100, spacing: 18, sun: "FULL_SUN", water: "MODERATE", indoorStart: 10, transplant: 2 },
  { name: "Carrot", family: "Apiaceae", category: "VEGETABLE", days: 70, spacing: 3, sun: "FULL_SUN", water: "MODERATE" },
  { name: "Lettuce", family: "Asteraceae", category: "VEGETABLE", days: 45, spacing: 8, sun: "PARTIAL_SUN", water: "MODERATE" },
  { name: "Spinach", family: "Amaranthaceae", category: "VEGETABLE", days: 40, spacing: 6, sun: "PARTIAL_SUN", water: "MODERATE" },
  { name: "Kale", family: "Brassicaceae", category: "VEGETABLE", days: 55, spacing: 18, sun: "FULL_SUN", water: "MODERATE" },
  { name: "Broccoli", family: "Brassicaceae", category: "VEGETABLE", days: 80, spacing: 18, sun: "FULL_SUN", water: "MODERATE", indoorStart: 6, transplant: 2 },
  { name: "Cabbage", family: "Brassicaceae", category: "VEGETABLE", days: 90, spacing: 18, sun: "FULL_SUN", water: "MODERATE", indoorStart: 6, transplant: 2 },
  { name: "Cauliflower", family: "Brassicaceae", category: "VEGETABLE", days: 80, spacing: 18, sun: "FULL_SUN", water: "MODERATE", indoorStart: 6, transplant: 2 },
  { name: "Cucumber", family: "Cucurbitaceae", category: "VEGETABLE", days: 55, spacing: 12, sun: "FULL_SUN", water: "HIGH", indoorStart: 3, transplant: 2 },
  { name: "Zucchini", family: "Cucurbitaceae", category: "VEGETABLE", days: 50, spacing: 24, sun: "FULL_SUN", water: "HIGH", indoorStart: 3, transplant: 2 },
  { name: "Pumpkin", family: "Cucurbitaceae", category: "VEGETABLE", days: 100, spacing: 36, sun: "FULL_SUN", water: "HIGH", indoorStart: 3, transplant: 2 },
  { name: "Bean", family: "Fabaceae", category: "VEGETABLE", days: 55, spacing: 6, sun: "FULL_SUN", water: "MODERATE" },
  { name: "Pea", family: "Fabaceae", category: "VEGETABLE", days: 60, spacing: 3, sun: "PARTIAL_SUN", water: "MODERATE" },
  { name: "Onion", family: "Amaryllidaceae", category: "VEGETABLE", days: 100, spacing: 4, sun: "FULL_SUN", water: "MODERATE" },
  { name: "Garlic", family: "Amaryllidaceae", category: "VEGETABLE", days: 240, spacing: 6, sun: "FULL_SUN", water: "LOW" },
  { name: "Beet", family: "Amaranthaceae", category: "VEGETABLE", days: 55, spacing: 4, sun: "FULL_SUN", water: "MODERATE" },
  { name: "Radish", family: "Brassicaceae", category: "VEGETABLE", days: 25, spacing: 2, sun: "PARTIAL_SUN", water: "MODERATE" },
  { name: "Swiss Chard", family: "Amaranthaceae", category: "VEGETABLE", days: 50, spacing: 12, sun: "PARTIAL_SUN", water: "MODERATE" },
  { name: "Eggplant", family: "Solanaceae", category: "VEGETABLE", days: 80, spacing: 18, sun: "FULL_SUN", water: "MODERATE", indoorStart: 8, transplant: 2 },
  { name: "Corn", family: "Poaceae", category: "VEGETABLE", days: 75, spacing: 12, sun: "FULL_SUN", water: "MODERATE" },
  { name: "Potato", family: "Solanaceae", category: "VEGETABLE", days: 90, spacing: 12, sun: "FULL_SUN", water: "MODERATE" },
  { name: "Sweet Potato", family: "Convolvulaceae", category: "VEGETABLE", days: 110, spacing: 12, sun: "FULL_SUN", water: "LOW" },
  { name: "Butternut Squash", family: "Cucurbitaceae", category: "VEGETABLE", days: 100, spacing: 36, sun: "FULL_SUN", water: "MODERATE", indoorStart: 3, transplant: 2 },
  { name: "Acorn Squash", family: "Cucurbitaceae", category: "VEGETABLE", days: 85, spacing: 36, sun: "FULL_SUN", water: "MODERATE", indoorStart: 3, transplant: 2 },
  { name: "Green Bean", family: "Fabaceae", category: "VEGETABLE", days: 50, spacing: 4, sun: "FULL_SUN", water: "MODERATE" },
  { name: "Snap Pea", family: "Fabaceae", category: "VEGETABLE", days: 60, spacing: 3, sun: "FULL_SUN", water: "MODERATE" },
  { name: "Arugula", family: "Brassicaceae", category: "VEGETABLE", days: 40, spacing: 6, sun: "PARTIAL_SUN", water: "MODERATE" },
  { name: "Bok Choy", family: "Brassicaceae", category: "VEGETABLE", days: 45, spacing: 9, sun: "PARTIAL_SUN", water: "MODERATE" },
  { name: "Celery", family: "Apiaceae", category: "VEGETABLE", days: 100, spacing: 12, sun: "PARTIAL_SUN", water: "HIGH", indoorStart: 10, transplant: 4 },
  { name: "Leek", family: "Amaryllidaceae", category: "VEGETABLE", days: 120, spacing: 6, sun: "FULL_SUN", water: "MODERATE", indoorStart: 10, transplant: 4 },
  { name: "Asparagus", family: "Asparagaceae", category: "VEGETABLE", days: 730, spacing: 18, sun: "FULL_SUN", water: "MODERATE" },
  { name: "Fennel", family: "Apiaceae", category: "HERB", days: 80, spacing: 12, sun: "FULL_SUN", water: "LOW" },
  { name: "Blueberry", family: "Ericaceae", category: "FRUIT", days: 730, spacing: 60, sun: "FULL_SUN", water: "MODERATE" },
  { name: "Strawberry", family: "Rosaceae", category: "FRUIT", days: 90, spacing: 12, sun: "FULL_SUN", water: "MODERATE" },
  { name: "Chamomile", family: "Asteraceae", category: "HERB", days: 60, spacing: 8, sun: "FULL_SUN", water: "LOW" },
  { name: "Chive", family: "Amaryllidaceae", category: "HERB", days: 80, spacing: 6, sun: "FULL_SUN", water: "MODERATE" },
  { name: "Dill", family: "Apiaceae", category: "HERB", days: 40, spacing: 12, sun: "FULL_SUN", water: "LOW" },
  { name: "Parsley", family: "Apiaceae", category: "HERB", days: 70, spacing: 12, sun: "PARTIAL_SUN", water: "MODERATE", indoorStart: 8, transplant: 2 },
  { name: "Cilantro", family: "Apiaceae", category: "HERB", days: 50, spacing: 6, sun: "PARTIAL_SUN", water: "MODERATE" },
  { name: "Oregano", family: "Lamiaceae", category: "HERB", days: 80, spacing: 12, sun: "FULL_SUN", water: "LOW" },
  { name: "Thyme", family: "Lamiaceae", category: "HERB", days: 90, spacing: 12, sun: "FULL_SUN", water: "LOW" },
  { name: "Rosemary", family: "Lamiaceae", category: "HERB", days: 180, spacing: 18, sun: "FULL_SUN", water: "LOW" },
  { name: "Sage", family: "Lamiaceae", category: "HERB", days: 75, spacing: 18, sun: "FULL_SUN", water: "LOW" },
  { name: "Mint", family: "Lamiaceae", category: "HERB", days: 90, spacing: 18, sun: "PARTIAL_SUN", water: "MODERATE" },
  { name: "Lavender", family: "Lamiaceae", category: "FLOWER", days: 90, spacing: 18, sun: "FULL_SUN", water: "LOW" },
  { name: "Marigold", family: "Asteraceae", category: "FLOWER", days: 50, spacing: 12, sun: "FULL_SUN", water: "LOW" },
  { name: "Nasturtium", family: "Tropaeolaceae", category: "FLOWER", days: 55, spacing: 12, sun: "FULL_SUN", water: "LOW" },
  { name: "Borage", family: "Boraginaceae", category: "FLOWER", days: 50, spacing: 12, sun: "FULL_SUN", water: "LOW" },
  { name: "Sunflower", family: "Asteraceae", category: "FLOWER", days: 80, spacing: 24, sun: "FULL_SUN", water: "LOW" },
  { name: "Zinnia", family: "Asteraceae", category: "FLOWER", days: 60, spacing: 12, sun: "FULL_SUN", water: "LOW" },
  { name: "Calendula", family: "Asteraceae", category: "FLOWER", days: 50, spacing: 12, sun: "FULL_SUN", water: "MODERATE" },
  { name: "Sweet Pea", family: "Fabaceae", category: "FLOWER", days: 60, spacing: 6, sun: "FULL_SUN", water: "MODERATE" },
] as const;

// Companion relations: [plant, companion, type, notes]
const COMPANIONS: [string, string, "BENEFICIAL" | "HARMFUL", string][] = [
  ["Tomato", "Basil", "BENEFICIAL", "Repels aphids and whiteflies; improves tomato flavor"],
  ["Tomato", "Marigold", "BENEFICIAL", "Repels nematodes and aphids"],
  ["Tomato", "Carrot", "BENEFICIAL", "Carrots loosen soil around tomato roots"],
  ["Tomato", "Borage", "BENEFICIAL", "Deters tomato hornworm; attracts pollinators"],
  ["Tomato", "Nasturtium", "BENEFICIAL", "Trap crop for aphids"],
  ["Tomato", "Fennel", "HARMFUL", "Inhibits tomato growth"],
  ["Tomato", "Cabbage", "HARMFUL", "Compete for nutrients"],
  ["Tomato", "Corn", "HARMFUL", "Both attract corn earworm / tomato fruitworm"],
  ["Basil", "Pepper", "BENEFICIAL", "Repels aphids; both thrive in heat"],
  ["Basil", "Chamomile", "BENEFICIAL", "Improves basil flavor and growth"],
  ["Carrot", "Chive", "BENEFICIAL", "Chives repel carrot fly"],
  ["Carrot", "Tomato", "BENEFICIAL", "Tomatoes repel carrot fly"],
  ["Carrot", "Dill", "HARMFUL", "Dill stunts carrot growth when mature"],
  ["Carrot", "Parsley", "HARMFUL", "Cross-pollinate; reduce quality of both"],
  ["Lettuce", "Chive", "BENEFICIAL", "Chives repel aphids from lettuce"],
  ["Lettuce", "Carrot", "BENEFICIAL", "Loose companions; carrots loosen soil"],
  ["Lettuce", "Nasturtium", "BENEFICIAL", "Nasturtium deters aphids"],
  ["Lettuce", "Onion", "BENEFICIAL", "Onions repel slugs and aphids"],
  ["Cucumber", "Bean", "BENEFICIAL", "Beans fix nitrogen for cucumbers"],
  ["Cucumber", "Nasturtium", "BENEFICIAL", "Repels cucumber beetle; trap crop for aphids"],
  ["Cucumber", "Dill", "BENEFICIAL", "Attracts beneficial insects"],
  ["Cucumber", "Sage", "HARMFUL", "Sage inhibits cucumber growth"],
  ["Bean", "Carrot", "BENEFICIAL", "Carrots loosen soil; beans fix nitrogen"],
  ["Bean", "Corn", "BENEFICIAL", "Classic Three Sisters combination"],
  ["Bean", "Cucumber", "BENEFICIAL", "Both benefit; beans fix nitrogen"],
  ["Bean", "Onion", "HARMFUL", "Onions inhibit bean growth"],
  ["Bean", "Garlic", "HARMFUL", "Garlic inhibits bean growth"],
  ["Corn", "Bean", "BENEFICIAL", "Beans fix nitrogen for heavy-feeding corn"],
  ["Corn", "Pumpkin", "BENEFICIAL", "Classic Three Sisters; squash shades weeds"],
  ["Corn", "Zucchini", "BENEFICIAL", "Squash family shades weeds under corn"],
  ["Onion", "Carrot", "BENEFICIAL", "Onions repel carrot fly; carrots repel onion fly"],
  ["Onion", "Beet", "BENEFICIAL", "Compatible companions"],
  ["Onion", "Chamomile", "BENEFICIAL", "Improves onion flavor"],
  ["Onion", "Bean", "HARMFUL", "Onions stunt bean growth"],
  ["Onion", "Pea", "HARMFUL", "Onions inhibit pea growth"],
  ["Garlic", "Tomato", "BENEFICIAL", "Repels aphids and spider mites"],
  ["Garlic", "Carrot", "BENEFICIAL", "Repels carrot fly"],
  ["Garlic", "Strawberry", "BENEFICIAL", "Repels spider mites from strawberries"],
  ["Garlic", "Bean", "HARMFUL", "Inhibits bean growth"],
  ["Garlic", "Pea", "HARMFUL", "Inhibits pea growth"],
  ["Marigold", "Tomato", "BENEFICIAL", "Repels nematodes, aphids, and whiteflies"],
  ["Marigold", "Pepper", "BENEFICIAL", "General pest repellent"],
  ["Marigold", "Cucumber", "BENEFICIAL", "Repels cucumber beetle"],
  ["Nasturtium", "Cucumber", "BENEFICIAL", "Trap crop; repels cucumber beetle"],
  ["Nasturtium", "Cabbage", "BENEFICIAL", "Trap crop for aphids; deters cabbage loopers"],
  ["Nasturtium", "Broccoli", "BENEFICIAL", "Trap crop for aphids"],
  ["Broccoli", "Rosemary", "BENEFICIAL", "Rosemary repels cabbage moth"],
  ["Broccoli", "Dill", "BENEFICIAL", "Attracts beneficial wasps that prey on cabbage worms"],
  ["Broccoli", "Nasturtium", "BENEFICIAL", "Trap crop for aphids"],
  ["Broccoli", "Tomato", "HARMFUL", "Compete and suppress each other"],
  ["Kale", "Nasturtium", "BENEFICIAL", "Trap crop for aphids"],
  ["Kale", "Dill", "BENEFICIAL", "Attracts beneficial insects"],
  ["Pepper", "Carrot", "BENEFICIAL", "Carrots loosen soil around peppers"],
  ["Pepper", "Tomato", "BENEFICIAL", "Similar growing conditions; marigolds repel shared pests"],
  ["Jalapeño", "Basil", "BENEFICIAL", "Repels aphids; both thrive in heat"],
  ["Jalapeño", "Carrot", "BENEFICIAL", "Carrots loosen soil around pepper roots"],
  ["Jalapeño", "Marigold", "BENEFICIAL", "General pest repellent"],
  ["Bell Pepper", "Basil", "BENEFICIAL", "Repels aphids; both thrive in heat"],
  ["Bell Pepper", "Carrot", "BENEFICIAL", "Carrots loosen soil around pepper roots"],
  ["Bell Pepper", "Marigold", "BENEFICIAL", "General pest repellent"],
  ["Radish", "Cucumber", "BENEFICIAL", "Repels cucumber beetles"],
  ["Radish", "Carrot", "BENEFICIAL", "Radishes break soil for carrots; planted together"],
  ["Dill", "Cucumber", "BENEFICIAL", "Attracts beneficial predatory insects"],
  ["Dill", "Cabbage", "BENEFICIAL", "Attracts beneficial insects to fight cabbage worms"],
  ["Dill", "Carrot", "HARMFUL", "When mature, dill cross-pollinates and stunts carrots"],
  ["Chamomile", "Onion", "BENEFICIAL", "Improves onion growth and flavor"],
  ["Borage", "Strawberry", "BENEFICIAL", "Deters pests; attracts pollinators"],
  ["Borage", "Tomato", "BENEFICIAL", "Repels tomato hornworm"],
  ["Chive", "Carrot", "BENEFICIAL", "Repels carrot fly"],
  ["Chive", "Apple", "BENEFICIAL", "Repels apple scab when grown nearby"],
  ["Sunflower", "Cucumber", "BENEFICIAL", "Provides support; attracts pollinators"],
  ["Calendula", "Tomato", "BENEFICIAL", "Repels tomato hornworm and asparagus beetles"],
  ["Calendula", "Asparagus", "BENEFICIAL", "Repels asparagus beetles"],
  ["Mint", "Cabbage", "BENEFICIAL", "Repels cabbage moths and aphids"],
  ["Mint", "Pea", "BENEFICIAL", "Repels aphids"],
  ["Lavender", "Broccoli", "BENEFICIAL", "Repels aphids and moths"],
  ["Rosemary", "Bean", "BENEFICIAL", "Repels bean beetles"],
  ["Rosemary", "Broccoli", "BENEFICIAL", "Repels cabbage moths"],
  ["Sage", "Cabbage", "BENEFICIAL", "Repels cabbage moths and whiteflies"],
  ["Sage", "Carrot", "BENEFICIAL", "Repels carrot fly"],
  ["Pea", "Carrot", "BENEFICIAL", "Compatible companions; peas fix nitrogen"],
  ["Pea", "Corn", "BENEFICIAL", "Peas fix nitrogen for corn"],
  ["Pea", "Radish", "BENEFICIAL", "Radishes deter aphids from peas"],
  ["Pea", "Onion", "HARMFUL", "Onions inhibit pea growth"],
  ["Strawberry", "Borage", "BENEFICIAL", "Borage repels pests and attracts pollinators"],
  ["Strawberry", "Spinach", "BENEFICIAL", "Ground cover benefits; good companions"],
  ["Strawberry", "Garlic", "BENEFICIAL", "Garlic repels spider mites"],
  ["Zinnia", "Tomato", "BENEFICIAL", "Attracts pollinators; trap crop for pests"],
  ["Zinnia", "Cucumber", "BENEFICIAL", "Attracts pollinators"],
];

async function main() {
  console.log("Seeding plant library…");

  // Upsert plants
  const plantMap = new Map<string, string>();

  for (const p of PLANTS) {
    const existing = await db.plantLibrary.findFirst({
      where: { name: p.name, customForUserId: null },
    });

    let id: string;
    if (existing) {
      id = existing.id;
      await db.plantLibrary.update({
        where: { id },
        data: {
          plantFamily: p.family,
          category: p.category as any,
          daysToMaturity: p.days,
          spacingInches: p.spacing,
          sunRequirement: p.sun as any,
          waterRequirement: p.water as any,
          indoorStartWeeks: "indoorStart" in p ? (p as any).indoorStart : null,
          transplantWeeks: "transplant" in p ? (p as any).transplant : null,
          commonNames: [],
          plantingSeasons: [],
          harvestMonths: [],
        },
      });
    } else {
      const created = await db.plantLibrary.create({
        data: {
          name: p.name,
          plantFamily: p.family,
          category: p.category as any,
          daysToMaturity: p.days,
          spacingInches: p.spacing,
          sunRequirement: p.sun as any,
          waterRequirement: p.water as any,
          indoorStartWeeks: "indoorStart" in p ? (p as any).indoorStart : null,
          transplantWeeks: "transplant" in p ? (p as any).transplant : null,
          commonNames: [],
          plantingSeasons: [],
          harvestMonths: [],
          source: "seed",
        },
      });
      id = created.id;
    }
    plantMap.set(p.name, id);
  }

  console.log(`Seeded ${PLANTS.length} plants.`);

  // Seed companion relations
  let added = 0;
  for (const [plant, companion, type, notes] of COMPANIONS) {
    const plantId = plantMap.get(plant);
    const relatedId = plantMap.get(companion);
    if (!plantId || !relatedId) continue;

    await db.companionRelation.upsert({
      where: { plantId_relatedId_type: { plantId, relatedId, type } },
      create: { plantId, relatedId, type, notes },
      update: { notes },
    });
    added++;
  }

  console.log(`Seeded ${added} companion relations.`);
  console.log("Done.");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
