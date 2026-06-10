"use server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { searchPerenual, getPerenualPlant } from "@/lib/api/perenual";
import { applyEstimatedTiming } from "@/lib/services/plant-timing";
import { findPexelsImageUrl } from "@/lib/api/pexels";
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
  // Kept for call-site compatibility but intentionally ignored. The acting
  // user is derived from the session below, so a client can't pass another
  // user's id to enumerate their private custom plants (this is a public
  // "use server" RPC endpoint).
  _clientUserId?: string
) {
  const user = await requireUser();
  const where = {
    AND: [
      { OR: [{ customForUserId: null }, { customForUserId: user.id }] },
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
    take: 300,
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
          const cat = inferCategoryFromName(item.common_name);
          // Perenual gives no grow-cycle data, so fill category-based
          // estimates and flag them — otherwise the plant produces no
          // calendar events or reminders at all.
          const { data: est, estimated } = applyEstimatedTiming(cat, {});
          const created = await db.plantLibrary.create({
            data: {
              externalId: String(item.id),
              source: "perenual",
              name: item.common_name,
              scientificName: item.scientific_name?.[0] ?? null,
              commonNames: item.other_name ?? [],
              category: cat,
              sunRequirement: mapSunlight(item.sunlight ?? []),
              waterRequirement: mapWatering(item.watering),
              imageUrl: null,
              ...est,
              timingEstimated: estimated,
            },
          });
          // Fetch a quality Pexels image after the response so search isn't
          // blocked; the plant shows its category tile until it lands.
          after(async () => {
            const img = await findPexelsImageUrl(item.common_name, cat);
            if (img) {
              await db.plantLibrary.update({
                where: { id: created.id },
                data: { imageUrl: img },
              });
            }
          });
        } catch {
          // ignore duplicate key on concurrent requests
        }
      }
      const refreshed = await db.plantLibrary.findMany({
        where,
        orderBy: [{ source: "desc" as const }, { name: "asc" as const }],
        take: 300,
      });
      return dedupePlantsByName(refreshed).slice(0, 300);
    }
  }

  return dedupePlantsByName(cached).slice(0, 300);
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
      const img = await findPexelsImageUrl(plant.name, plant.category);
      await db.plantLibrary.update({
        where: { id: plantId },
        data: { externalId: String(match.id), ...(img ? { imageUrl: img } : {}) },
      });
      // Also fetch full details while we have the ID
      const full = await getPerenualPlant(match.id);
      if (full) {
        await db.plantLibrary.update({
          where: { id: plantId },
          data: {
            description: full.description ?? undefined,
            plantFamily: full.family ?? undefined,
            category: mapCategory(full.type, full.edible_fruit, full.flowers),
            sunRequirement: mapSunlight(full.sunlight ?? []) ?? undefined,
            waterRequirement: mapWatering(full.watering) ?? undefined,
            spacingInches: full.spacing ?? undefined,
            harvestMonths: full.harvest_season ? [full.harvest_season] : [],
            ...(full.pest_susceptibility?.length ? { commonPests: full.pest_susceptibility } : {}),
          },
        });
      }
    });
  } else if (needsDetails) {
    after(async () => {
      const full = await getPerenualPlant(Number(plant.externalId));
      if (!full) return;
      const newCategory = mapCategory(full.type, full.edible_fruit, full.flowers);
      const img =
        !plant.imageUrl || badImageUrl
          ? await findPexelsImageUrl(plant.name, newCategory)
          : null;
      // Backfill estimated timing for non-curated plants still missing it
      // (curated "seed" plants keep their hand-entered, intentional data —
      // e.g. direct-sown beans correctly have no indoor-start week).
      const { data: est, estimated } =
        plant.source === "seed"
          ? { data: {}, estimated: false }
          : applyEstimatedTiming(newCategory, {
              daysToMaturity: plant.daysToMaturity,
              indoorStartWeeks: plant.indoorStartWeeks,
              transplantWeeks: plant.transplantWeeks,
            });
      await db.plantLibrary.update({
        where: { id: plantId },
        data: {
          description: full.description ?? undefined,
          plantFamily: full.family ?? undefined,
          category: newCategory,
          sunRequirement: mapSunlight(full.sunlight ?? []) ?? undefined,
          waterRequirement: mapWatering(full.watering) ?? undefined,
          spacingInches: full.spacing ?? undefined,
          ...(img ? { imageUrl: img } : {}),
          harvestMonths: full.harvest_season ? [full.harvest_season] : [],
          ...est,
          ...(estimated ? { timingEstimated: true } : {}),
          ...(full.pest_susceptibility?.length ? { commonPests: full.pest_susceptibility } : {}),
        },
      });
    });
  } else if (needsImageFix) {
    after(async () => {
      const img = await findPexelsImageUrl(plant.name, plant.category);
      if (img) {
        await db.plantLibrary.update({ where: { id: plantId }, data: { imageUrl: img } });
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

  // Validate client input: name is required and bounded; numeric fields are
  // clamped to sane ranges so a negative/huge value can't poison the
  // footprint/spacing math (spacingInches drives the bed-grid cell loop).
  const name = data.name?.trim();
  if (!name) throw new Error("Plant name is required");
  if (name.length > 100) throw new Error("Plant name is too long");
  const clampOpt = (n: number | undefined, min: number, max: number) =>
    n === undefined || Number.isNaN(n) ? null : Math.min(max, Math.max(min, Math.round(n)));

  return db.plantLibrary.create({
    data: {
      name,
      category: data.category,
      description: data.description?.trim() || null,
      daysToMaturity: clampOpt(data.daysToMaturity, 1, 3650),
      spacingInches: clampOpt(data.spacingInches, 1, 120),
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

/**
 * Update a plant's grow-cycle timing (drives the calendar + reminders).
 * Used to correct category-based estimates. A manual edit clears the
 * `timingEstimated` flag since the values are now authoritative.
 *
 * Own custom plants are edited in place. GLOBAL plants are forked-on-edit:
 * a personal copy gets the new timing and the user's plantings/inventory
 * are repointed at it. Mutating the shared row would let any user rewrite
 * every other user's calendar math (data poisoning at scale).
 *
 * Returns the plant id the edit landed on — the fork's id when one was
 * created, so the UI can navigate to the user's copy.
 */
export async function updatePlantTiming(
  plantId: string,
  data: {
    daysToMaturity?: number | null;
    indoorStartWeeks?: number | null;
    transplantWeeks?: number | null;
  }
): Promise<{ plantId: string }> {
  const user = await requireUser();
  const plant = await db.plantLibrary.findFirst({
    where: { id: plantId, OR: [{ customForUserId: null }, { customForUserId: user.id }] },
  });
  if (!plant) throw new Error("Plant not found");

  const clampInt = (v: number | null | undefined, min: number, max: number) => {
    if (v == null) return null;
    const n = Math.round(v);
    if (Number.isNaN(n) || n < min || n > max) throw new Error("Invalid timing value");
    return n;
  };

  const timing = {
    daysToMaturity: clampInt(data.daysToMaturity, 1, 730),
    indoorStartWeeks: clampInt(data.indoorStartWeeks, 0, 20),
    transplantWeeks: clampInt(data.transplantWeeks, 0, 20),
    timingEstimated: false,
  };

  // Own custom plant: edit in place.
  if (plant.customForUserId === user.id) {
    await db.plantLibrary.update({ where: { id: plantId }, data: timing });
    revalidatePath(`/plants/${plantId}`);
    revalidatePath("/calendar");
    return { plantId };
  }

  // Global plant: fork-on-edit. Reuse the user's existing fork of this
  // plant (matched by name) so repeat edits don't pile up copies.
  const existingFork = await db.plantLibrary.findFirst({
    where: { customForUserId: user.id, name: plant.name },
    select: { id: true },
  });

  let forkId: string;
  if (existingFork) {
    await db.plantLibrary.update({ where: { id: existingFork.id }, data: timing });
    forkId = existingFork.id;
  } else {
    forkId = await db.$transaction(async (tx) => {
      // Copy everything except identity/unique fields (externalId is
      // @unique and belongs to the canonical row).
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, externalId: _externalId, createdAt: _createdAt, updatedAt: _updatedAt, ...copy } = plant;
      const fork = await tx.plantLibrary.create({
        data: { ...copy, ...timing, customForUserId: user.id, source: "custom" },
      });
      // Carry companion data over so companion warnings keep working for
      // plantings that get repointed to the fork.
      const rels = await tx.companionRelation.findMany({ where: { plantId: plant.id } });
      if (rels.length > 0) {
        await tx.companionRelation.createMany({
          data: rels.map((r) => ({
            plantId: fork.id,
            relatedId: r.relatedId,
            type: r.type,
            notes: r.notes,
          })),
        });
      }
      return fork.id;
    });
  }

  // Repoint the user's OWN data at the fork so their calendar/reminders
  // reflect the edit. Owned gardens only — pointing another owner's
  // plantings at a private fork would 404 their plant pages.
  await db.planting.updateMany({
    where: { plantId: plant.id, cell: { bed: { garden: { userId: user.id } } } },
    data: { plantId: forkId },
  });
  try {
    await db.seedInventory.updateMany({
      where: { plantId: plant.id, userId: user.id },
      data: { plantId: forkId },
    });
  } catch {
    // Unique (userId, plantId, …) collision when inventory rows exist for
    // both the global plant and the fork — keep the originals, non-fatal.
  }

  revalidatePath(`/plants/${forkId}`);
  revalidatePath(`/plants/${plant.id}`);
  revalidatePath("/plants");
  revalidatePath("/calendar");
  return { plantId: forkId };
}
