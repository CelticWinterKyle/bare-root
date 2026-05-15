#!/usr/bin/env tsx
// Backfill plant images from Wikipedia for every PlantLibrary row that
// has imageUrl=null or a known-broken upgrade_access placeholder. Tries
// a few common variants of the slug (original, Title Case, underscores)
// to maximize hit rate against Wikipedia's article naming.
//
// Usage: npx tsx --env-file=.env.local scripts/backfill-images.ts

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

function toTitleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

async function wikiSummary(slug: string): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`,
        { headers: { "User-Agent": "BareRoot/1.0 (bareroot.garden)" } }
      );
      if (res.status === 404) return null; // Genuine miss, don't retry
      if (res.status === 429 || res.status >= 500) {
        // Throttled or transient — back off and retry
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      if (!res.ok) return null;
      const data = await res.json() as { thumbnail?: { source?: string } };
      const thumb = data.thumbnail?.source;
      if (!thumb) return null;
      // Bump the thumb width from the default 320px to 800px so the
      // library cards render sharp on retina without hauling down the
      // full-res original.
      return thumb.replace(/\/(\d+)px-/, "/800px-");
    } catch {
      await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
    }
  }
  return null;
}

// Named overrides: plant name → known-good Wikipedia article slug.
// Used when neither the literal name variants nor the family fallback
// surfaces an image (often because Wikipedia uses the Latin / genus name).
const NAMED_FALLBACKS: Record<string, string> = {
  "Marigold": "Tagetes",
  "Nasturtium": "Tropaeolum",
  "Black-Eyed Susan": "Rudbeckia hirta",
  "Currant": "Ribes",
  "Dwarf Sunflower": "Helianthus annuus",
  "Yellow Squash": "Cucurbita pepo",
  "English Cucumber": "Cucumber",
  "Curly Parsley": "Parsley",
  "Italian Parsley": "Parsley",
  "Fennel": "Fennel",
  "Mizuna": "Mizuna",
  "Forked Three Awned Grass": "Aristida",
};

// Fallback to a generic article when a specific variety has no Wikipedia
// page of its own (Wikipedia has "Tomato" but not "Yellow Tomato"). The
// match is whole-word suffix so "Black-Eyed Susan" doesn't accidentally
// fall back to "Susan."
const FAMILY_FALLBACKS: Array<[RegExp, string]> = [
  [/\bTomato\b/i, "Tomato"],
  [/\bPepper\b/i, "Bell pepper"],
  [/\bLettuce\b/i, "Lettuce"],
  [/\bSquash\b/i, "Cucurbita"],
  [/\bCarrot\b/i, "Carrot"],
  [/\bOnion\b/i, "Onion"],
  [/\bBean\b/i, "Bean"],
  [/\bPea\b/i, "Pea"],
  [/\bBasil\b/i, "Basil"],
  [/\bMint\b/i, "Mint"],
  [/\bGreens\b/i, "Leaf vegetable"],
  [/\bMelon\b/i, "Melon"],
];

async function fetchWikipediaImage(name: string): Promise<string | null> {
  // Wikipedia article titles for plants are usually sentence-case: first
  // letter capitalized, rest lowercase ("Cherry tomato", "Bell pepper").
  const sentenceCase = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  const variants = [
    sentenceCase,
    toTitleCase(name),
    name,
    name.toLowerCase(),
  ].filter((v, i, a) => a.indexOf(v) === i);

  for (const variant of variants) {
    const slug = variant.replace(/\s+/g, "_");
    const url = await wikiSummary(slug);
    if (url) return url;
    await new Promise((r) => setTimeout(r, 150));
  }

  // Named override before family fallback — these are the curated
  // "use this specific Wikipedia article" hits for plants whose common
  // name doesn't match Wikipedia's article title.
  const override = NAMED_FALLBACKS[name];
  if (override) {
    const url = await wikiSummary(override.replace(/\s+/g, "_"));
    if (url) return url;
    await new Promise((r) => setTimeout(r, 150));
  }

  // Family fallback: "Yellow Tomato" → "Tomato", "Bell Pepper" already
  // tried but "Sun Gold Pepper" → "Bell pepper", etc.
  for (const [pattern, fallback] of FAMILY_FALLBACKS) {
    if (pattern.test(name) && name.toLowerCase() !== fallback.toLowerCase()) {
      const url = await wikiSummary(fallback.replace(/\s+/g, "_"));
      if (url) return url;
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  return null;
}

async function main() {
  const plants = await db.plantLibrary.findMany({
    where: {
      OR: [
        { imageUrl: null },
        { imageUrl: { contains: "upgrade_access" } },
      ],
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  console.log(`Found ${plants.length} plants needing images.\n`);

  let fixed = 0;
  let missing = 0;

  for (const plant of plants) {
    const url = await fetchWikipediaImage(plant.name);
    if (url) {
      await db.plantLibrary.update({ where: { id: plant.id }, data: { imageUrl: url } });
      console.log(`  ✓ ${plant.name}`);
      fixed++;
    } else {
      console.log(`  - ${plant.name}`);
      missing++;
    }
    // Pause between plants too — Wikipedia API gets cranky with bursts.
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`\nDone. Fixed ${fixed}, no Wikipedia match for ${missing}.`);
  await db.$disconnect();
  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
