import { db } from "@/lib/db";
import { searchPerenual, getPerenualPlant } from "@/lib/api/perenual";
import type { PlantCategory, SunLevel, WaterNeed } from "@/lib/generated/prisma/enums";

function mapSunlight(sunlight: string[]): SunLevel | null {
  const s = (sunlight[0] ?? "").toLowerCase();
  if (s.includes("full sun")) return "FULL_SUN";
  if (s.includes("part sun") || s.includes("part shade")) return "PARTIAL_SUN";
  if (s.includes("full shade")) return "FULL_SHADE";
  if (s.includes("shade")) return "PARTIAL_SHADE";
  return null;
}

function mapWatering(watering: string | null): WaterNeed | null {
  if (!watering) return null;
  const w = watering.toLowerCase();
  if (w === "frequent") return "HIGH";
  if (w === "average") return "MODERATE";
  if (w === "minimum" || w === "none") return "LOW";
  return null;
}

function mapCategory(type: string | null, plant: { edible_fruit?: boolean | null; flowers?: boolean | null }): PlantCategory {
  if (!type) return "OTHER";
  const t = type.toLowerCase();
  if (t.includes("vegetable")) return "VEGETABLE";
  if (t.includes("fruit") || plant.edible_fruit) return "FRUIT";
  if (t.includes("herb")) return "HERB";
  if (t.includes("flower")) return "FLOWER";
  if (t.includes("tree")) return "TREE";
  if (t.includes("shrub")) return "SHRUB";
  if (plant.flowers) return "FLOWER";
  return "OTHER";
}

export async function searchPlants(query: string, userId: string) {
  // 1. Check cache first
  const cached = await db.plantLibrary.findMany({
    where: {
      AND: [
        {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { commonNames: { has: query.toLowerCase() } },
          ],
        },
        {
          OR: [{ customForUserId: null }, { customForUserId: userId }],
        },
      ],
    },
    take: 20,
    orderBy: { name: "asc" },
  });

  if (cached.length >= 5) return cached;

  // 2. Fetch from API on cache miss
  const result = await searchPerenual(query);
  if (!result?.data?.length) return cached;

  // 3. Upsert fetched plants into cache
  for (const item of result.data.slice(0, 20)) {
    const existing = await db.plantLibrary.findUnique({
      where: { externalId: String(item.id) },
    });
    if (existing) continue;

    await db.plantLibrary.create({
      data: {
        externalId: String(item.id),
        source: "perenual",
        name: item.common_name,
        scientificName: item.scientific_name?.[0] ?? null,
        commonNames: item.other_name ?? [],
        category: mapCategory(null, {}),
        sunRequirement: mapSunlight(item.sunlight ?? []),
        waterRequirement: mapWatering(item.watering),
        imageUrl: item.default_image?.medium_url ?? null,
      },
    });
  }

  // 4. Re-query from cache
  return db.plantLibrary.findMany({
    where: {
      AND: [
        {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
          ],
        },
        {
          OR: [{ customForUserId: null }, { customForUserId: userId }],
        },
      ],
    },
    take: 20,
    orderBy: { name: "asc" },
  });
}

export async function getPlant(plantId: string, userId: string) {
  const cached = await db.plantLibrary.findFirst({
    where: {
      id: plantId,
      OR: [{ customForUserId: null }, { customForUserId: userId }],
    },
    include: {
      companions: { include: { related: true } },
      antagonists: { include: { plant: true } },
    },
  });
  if (!cached) return null;

  // Enrich from API if details are sparse
  if (cached.externalId && !cached.daysToMaturity && !cached.description) {
    const full = await getPerenualPlant(Number(cached.externalId));
    if (full) {
      await db.plantLibrary.update({
        where: { id: plantId },
        data: {
          description: full.description ?? undefined,
          plantFamily: full.family ?? undefined,
          category: mapCategory(full.type, full),
          sunRequirement: mapSunlight(full.sunlight ?? []) ?? undefined,
          waterRequirement: mapWatering(full.watering) ?? undefined,
          spacingInches: full.spacing ?? undefined,
          imageUrl: full.default_image?.medium_url ?? undefined,
          harvestMonths: full.harvest_season ? [full.harvest_season] : [],
        },
      });
      return db.plantLibrary.findFirst({
        where: { id: plantId },
        include: {
          companions: { include: { related: true } },
          antagonists: { include: { plant: true } },
        },
      });
    }
  }

  return cached;
}

export async function getPlantsByCategory(category: PlantCategory, userId: string) {
  return db.plantLibrary.findMany({
    where: {
      category,
      OR: [{ customForUserId: null }, { customForUserId: userId }],
    },
    orderBy: { name: "asc" },
    take: 50,
  });
}
