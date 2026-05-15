#!/usr/bin/env tsx
// One-off: align plant.spacingInches with Mel Bartholomew's Square Foot
// Gardening reference. Source: All New Square Foot Gardening (2nd ed.)
// + commonly-cited SFG plant tables.
//
// SFG quantity → inches mapping the app's footprint math expects:
//   1 per sq ft   → 12" spacing  (ceil(12/cellSize)² cells)
//   1 per 2 sq ft → 18" spacing
//   1 per 4 sq ft → 24" spacing
//   1 per 9 sq ft → 36" spacing
//   4 per sq ft   → 6"  spacing
//   9+ per sq ft  → 3-4" spacing
//
// Usage: npx tsx --env-file=.env.local scripts/fix-spacing.ts

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const UPDATES: Record<string, number> = {
  // Tomatoes — 1 per sq ft for determinate, 1 per 2 sq ft for big indeterminate
  "Tomato": 12,
  "Cherry Tomato": 12,
  "Roma Tomato": 12,
  "Grape Tomato": 12,
  "Beefsteak Tomato": 18,
  "San Marzano Tomato": 12,
  "Cherokee Purple Tomato": 18,
  "Brandywine Tomato": 18,
  "Early Girl Tomato": 12,
  "Celebrity Tomato": 12,
  "Sun Gold Tomato": 12,
  "Yellow Tomato": 12,
  "Black Krim Tomato": 18,
  "Amish Paste Tomato": 12,
  "Mortgage Lifter Tomato": 18,
  "Green Zebra Tomato": 12,

  // Peppers — 1 per sq ft
  "Pepper": 12,
  "Bell Pepper": 12,
  "Jalapeño": 12,
  "Serrano Pepper": 12,
  "Habanero Pepper": 12,
  "Poblano Pepper": 12,
  "Cayenne Pepper": 12,
  "Banana Pepper": 12,
  "Anaheim Pepper": 12,
  "Shishito Pepper": 12,
  "Ghost Pepper": 18,

  // Other Solanaceae
  "Eggplant": 12,
  "Japanese Eggplant": 12,
  "Sweet Potato": 18,

  // Summer squash — 1 per 2 sq ft. Winter squash + pumpkin stay at 36".
  "Zucchini": 18,
  "Yellow Squash": 18,
  "Patty Pan Squash": 18,

  // Brassicas
  "Kale": 12,
  "Broccoli": 12,
  "Cabbage": 12,
  "Cauliflower": 12,
  "Brussels Sprouts": 18,
  "Kohlrabi": 6,
  "Bok Choy": 6,
  "Collard Greens": 12,
  "Mustard Greens": 6,

  // Leafy
  "Swiss Chard": 6,

  // Misc
  "Okra": 12,
  "Celery": 6,
};

async function main() {
  let updated = 0;
  let notFound = 0;
  for (const [name, spacing] of Object.entries(UPDATES)) {
    const result = await db.plantLibrary.updateMany({
      where: { name },
      data: { spacingInches: spacing },
    });
    if (result.count > 0) {
      console.log(`✓ ${name.padEnd(28)} → ${spacing}"`);
      updated++;
    } else {
      console.log(`- ${name.padEnd(28)} not found`);
      notFound++;
    }
  }
  console.log(`\nUpdated ${updated} plants (${notFound} not found).`);
  await db.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
