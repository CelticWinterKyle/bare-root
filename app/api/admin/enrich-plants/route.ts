import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { PLANT_ENRICHMENT } from "@/lib/data/plant-enrichment";

const OWNER_EMAIL = "kyle@celticwinter.com";

/**
 * Owner-only backfill: apply the curated enrichment in
 * lib/data/plant-enrichment.ts to the live seed plant library.
 *   POST /api/admin/enrich-plants
 *
 * Idempotent and conservative — for each enrichment entry it finds the
 * PlantLibrary row with the same name where source = "seed" and fills ONLY
 * fields that are currently null/empty (description, scientificName,
 * plantingDepthIn, soilPhRange, plantingSeasons, harvestMonths). Anything a
 * user or import already set is left untouched, so re-running is safe.
 *
 * POST-only on purpose: a state-changing GET authenticated by the session
 * cookie (SameSite=Lax) is CSRF-able via a crafted link. Trigger from a
 * terminal: curl -X POST -H "Cookie: ..." or from the browser devtools
 * console with fetch(url, { method: "POST" }).
 */
export async function POST() {
  const me = await getCurrentUser();
  if (!me || me.email.toLowerCase() !== OWNER_EMAIL) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let matched = 0;
  let updated = 0;
  let skippedNoMatch = 0;

  for (const [name, e] of Object.entries(PLANT_ENRICHMENT)) {
    const row = await db.plantLibrary.findFirst({
      where: { name, source: "seed", customForUserId: null },
      select: {
        id: true,
        description: true,
        scientificName: true,
        plantingDepthIn: true,
        soilPhRange: true,
        plantingSeasons: true,
        harvestMonths: true,
      },
    });
    if (!row) {
      skippedNoMatch++;
      continue;
    }
    matched++;

    const data: {
      description?: string;
      scientificName?: string;
      plantingDepthIn?: number;
      soilPhRange?: string;
      plantingSeasons?: string[];
      harvestMonths?: string[];
    } = {};
    if (!row.description) data.description = e.description;
    if (!row.scientificName) data.scientificName = e.scientificName;
    if (row.plantingDepthIn == null) data.plantingDepthIn = e.plantingDepthIn;
    if (!row.soilPhRange) data.soilPhRange = e.soilPhRange;
    if (row.plantingSeasons.length === 0) data.plantingSeasons = e.plantingSeasons;
    if (row.harvestMonths.length === 0) data.harvestMonths = e.harvestMonths;

    if (Object.keys(data).length > 0) {
      await db.plantLibrary.update({ where: { id: row.id }, data });
      updated++;
    }
  }

  return NextResponse.json({ matched, updated, skippedNoMatch });
}
