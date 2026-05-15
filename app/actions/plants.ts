"use server";
import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { searchPerenual, getPerenualPlant } from "@/lib/api/perenual";
import type { PlantCategory, SunLevel, WaterNeed } from "@/lib/generated/prisma/enums";

function validImage(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.includes("upgrade_access")) return null;
  return url;
}

async function fetchWikipediaImage(name: string): Promise<string | null> {
  try {
    const slug = encodeURIComponent(name.replace(/\s+/g, "_"));
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`,
      { headers: { "User-Agent": "BareRoot/1.0 (bareroot.app)" }, next: { revalidate: 86400 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return (data.thumbnail?.source as string | undefined) ?? null;
  } catch {
    return null;
  }
}

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

function mapCategory(type: string | null, edible?: boolean | null, flowers?: boolean | null): PlantCategory {
  if (!type) return flowers ? "FLOWER" : "OTHER";
  const t = type.toLowerCase();
  if (t.includes("vegetable")) return "VEGETABLE";
  if (t.includes("fruit") || edible) return "FRUIT";
  if (t.includes("herb")) return "HERB";
  if (t.includes("flower")) return "FLOWER";
  if (t.includes("tree")) return "TREE";
  if (t.includes("shrub")) return "SHRUB";
  return flowers ? "FLOWER" : "OTHER";
}

const VEGETABLE_KEYWORDS = ["tomato", "pepper", "jalape", "lettuce", "spinach", "kale", "cabbage", "carrot", "beet", "radish", "cucumber", "zucchini", "squash", "pumpkin", "bean", " pea", "corn", "onion", "garlic", "leek", "broccoli", "cauliflower", "potato", "eggplant", "celery", "chard", "arugula", "turnip", "artichoke", "asparagus", "okra", "collard", "bok choy", "kohlrabi", "brussels"];
const HERB_KEYWORDS = ["basil", "mint", "oregano", "thyme", "rosemary", "sage", "dill", "parsley", "cilantro", "chive", "tarragon", "lavender", "lemongrass", "bay leaf", "chamomile", "borage", "lemon balm", "marjoram", "fennel"];
const FRUIT_KEYWORDS = ["strawberry", "blueberry", "raspberry", "blackberry", "apple", "peach", "cherry", "plum", "melon", "watermelon", "cantaloupe", "grape", "fig", "lemon", "lime", "orange", "mango", "banana", "avocado", "kiwi", "pear", "apricot"];
const FLOWER_KEYWORDS = ["rose", "sunflower", "marigold", "zinnia", "dahlia", "petunia", "pansy", "daisy", "lily", "tulip", "daffodil", "iris", "poppy", "cosmos", "aster", "chrysanthemum", "snapdragon", "nasturtium", "calendula", "lavender"];
const TREE_KEYWORDS = ["oak", "maple", "pine", "cedar", "spruce", "fir", "birch", "elm", "ash tree", "willow", "poplar", "magnolia", "dogwood", "palm", "cypress", "juniper", "sequoia", "redwood", " tree"];
const SHRUB_KEYWORDS = ["boxwood", "holly", "lilac", "hydrangea", "azalea", "rhododendron", "forsythia", "viburnum", "spirea", "privet", "barberry", "shrub", "bush"];

function inferCategoryFromName(name: string): PlantCategory {
  const n = ` ${name.toLowerCase()} `;
  if (VEGETABLE_KEYWORDS.some((k) => n.includes(k))) return "VEGETABLE";
  if (HERB_KEYWORDS.some((k) => n.includes(k))) return "HERB";
  if (FRUIT_KEYWORDS.some((k) => n.includes(k))) return "FRUIT";
  if (FLOWER_KEYWORDS.some((k) => n.includes(k))) return "FLOWER";
  if (TREE_KEYWORDS.some((k) => n.includes(k))) return "TREE";
  if (SHRUB_KEYWORDS.some((k) => n.includes(k))) return "SHRUB";
  return "OTHER";
}

/**
 * Collapse plants that share a lowercase name. Perenual's API returns
 * multiple distinct species under the same common name ("tomato",
 * "sweet pepperbush", etc.) — 5 identical-looking rows in a search
 * result is just noise to a gardener. Rule: when a seed-source entry
 * with the same lowercase name exists, drop the Perenual ones. When
 * only Perenual entries exist for a name, keep the first.
 */
function dedupePlantsByName<T extends { name: string; source: string | null }>(plants: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const p of plants) {
    const key = p.name.toLowerCase().trim();
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, p);
    } else if (p.source === "seed" && existing.source !== "seed") {
      byKey.set(key, p);
    }
  }
  return Array.from(byKey.values());
}

export async function searchPlantsAction(
  query: string,
  category: PlantCategory | null,
  userId: string
) {
  const where = {
    AND: [
      { OR: [{ customForUserId: null }, { customForUserId: userId }] },
      query ? { name: { contains: query, mode: "insensitive" as const } } : {},
      category ? { category } : {},
    ],
  };

  // Over-fetch (96 vs the 48 we'll return) so dedupe doesn't leave a
  // sparse result list when the raw query had heavy Perenual duplicates.
  // Source DESC puts seed plants first so they win the dedupe tie-break.
  const cached = await db.plantLibrary.findMany({
    where,
    orderBy: [{ source: "desc" as const }, { name: "asc" as const }],
    take: 96,
  });

  // Hit API if cache miss and we have a query
  if (query.length >= 2 && cached.length < 5 && !category) {
    const result = await searchPerenual(query);
    if (result?.data?.length) {
      for (const item of result.data.slice(0, 20)) {
        const exists = await db.plantLibrary.findUnique({
          where: { externalId: String(item.id) },
        });
        if (exists) continue;
        try {
          await db.plantLibrary.create({
            data: {
              externalId: String(item.id),
              source: "perenual",
              name: item.common_name,
              scientificName: item.scientific_name?.[0] ?? null,
              commonNames: item.other_name ?? [],
              category: inferCategoryFromName(item.common_name),
              sunRequirement: mapSunlight(item.sunlight ?? []),
              waterRequirement: mapWatering(item.watering),
              imageUrl: validImage(item.default_image?.medium_url),
            },
          });
        } catch {
          // ignore duplicate key on concurrent requests
        }
      }
      const refreshed = await db.plantLibrary.findMany({
        where,
        orderBy: [{ source: "desc" as const }, { name: "asc" as const }],
        take: 96,
      });
      return dedupePlantsByName(refreshed).slice(0, 48);
    }
  }

  return dedupePlantsByName(cached).slice(0, 48);
}

export async function getPlantAction(plantId: string) {
  const user = await requireUser();

  const plant = await db.plantLibrary.findFirst({
    where: {
      id: plantId,
      OR: [{ customForUserId: null }, { customForUserId: user.id }],
    },
    include: {
      companions: { include: { related: true } },
      antagonists: { include: { plant: true } },
    },
  });
  if (!plant) return null;

  // Enrich missing data in the background — doesn't block this response.
  // On first visit the page renders with seed data; second visit gets full details.
  const badImageUrl = plant.imageUrl?.includes("upgrade_access") ?? false;
  const needsSearch = !plant.externalId && plant.source === "seed";
  const needsDetails = !!plant.externalId && !plant.description;
  const needsImageFix = !needsSearch && !needsDetails && (!plant.imageUrl || badImageUrl);

  if (needsSearch) {
    after(async () => {
      const result = await searchPerenual(plant.name);
      const match = result?.data?.[0];
      if (!match) return;
      const perenualImg = validImage(match.default_image?.medium_url);
      const imageUrl = perenualImg ?? await fetchWikipediaImage(plant.name);
      await db.plantLibrary.update({
        where: { id: plantId },
        data: { externalId: String(match.id), imageUrl: imageUrl ?? undefined },
      });
      // Also fetch full details while we have the ID
      const full = await getPerenualPlant(match.id);
      if (full) {
        const fullImg = validImage(full.default_image?.medium_url) ?? imageUrl ?? undefined;
        await db.plantLibrary.update({
          where: { id: plantId },
          data: {
            description: full.description ?? undefined,
            plantFamily: full.family ?? undefined,
            category: mapCategory(full.type, full.edible_fruit, full.flowers),
            sunRequirement: mapSunlight(full.sunlight ?? []) ?? undefined,
            waterRequirement: mapWatering(full.watering) ?? undefined,
            spacingInches: full.spacing ?? undefined,
            imageUrl: fullImg,
            harvestMonths: full.harvest_season ? [full.harvest_season] : [],
          },
        });
      }
    });
  } else if (needsDetails) {
    after(async () => {
      const full = await getPerenualPlant(Number(plant.externalId));
      if (!full) return;
      const perenualImg = validImage(full.default_image?.medium_url);
      const imageUrl = perenualImg ?? (!plant.imageUrl || badImageUrl ? await fetchWikipediaImage(plant.name) : plant.imageUrl);
      await db.plantLibrary.update({
        where: { id: plantId },
        data: {
          description: full.description ?? undefined,
          plantFamily: full.family ?? undefined,
          category: mapCategory(full.type, full.edible_fruit, full.flowers),
          sunRequirement: mapSunlight(full.sunlight ?? []) ?? undefined,
          waterRequirement: mapWatering(full.watering) ?? undefined,
          spacingInches: full.spacing ?? undefined,
          imageUrl: imageUrl ?? undefined,
          harvestMonths: full.harvest_season ? [full.harvest_season] : [],
        },
      });
    });
  } else if (needsImageFix) {
    after(async () => {
      const imageUrl = await fetchWikipediaImage(plant.name);
      if (imageUrl) {
        await db.plantLibrary.update({ where: { id: plantId }, data: { imageUrl } });
      }
    });
  }

  return plant;
}

export async function createCustomPlant(data: {
  name: string;
  category: PlantCategory;
  description?: string;
  daysToMaturity?: number;
  spacingInches?: number;
  sunRequirement?: SunLevel;
  waterRequirement?: WaterNeed;
}) {
  const user = await requireUser();

  return db.plantLibrary.create({
    data: {
      name: data.name,
      category: data.category,
      description: data.description ?? null,
      daysToMaturity: data.daysToMaturity ?? null,
      spacingInches: data.spacingInches ?? null,
      sunRequirement: data.sunRequirement ?? null,
      waterRequirement: data.waterRequirement ?? null,
      commonNames: [],
      plantingSeasons: [],
      harvestMonths: [],
      customForUserId: user.id,
      source: "custom",
    },
  });
}
