import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";

/** Cache tag for the shared (customForUserId: null) plant library. */
export const PLANT_LIBRARY_TAG = "plant-library";

/**
 * Only the fields the library grid (PlantSearch cards) renders, plus
 * `source` for the seed-wins dedupe + ordering. Keeps the page payload
 * small — full rows carry description/pests/diseases the grid never shows.
 */
export const plantCardSelect = {
  id: true,
  name: true,
  scientificName: true,
  category: true,
  imageUrl: true,
  sunRequirement: true,
  waterRequirement: true,
  daysToMaturity: true,
  source: true,
} as const;

/**
 * The shared plant library, cached across requests. Uses unstable_cache —
 * the `use cache` directive would require enabling the cacheComponents flag
 * in next.config.ts. Invalidated by tag on Perenual imports and timing
 * edits; the hourly revalidate picks up background image/detail enrichment
 * (getPlantAction's after() backfills) without explicit invalidation.
 */
export const getSharedPlantLibrary = unstable_cache(
  async () =>
    db.plantLibrary.findMany({
      where: { customForUserId: null },
      select: plantCardSelect,
      orderBy: [{ source: "desc" }, { name: "asc" }],
      take: 1000,
    }),
  ["shared-plant-library"],
  { tags: [PLANT_LIBRARY_TAG], revalidate: 3600 }
);
