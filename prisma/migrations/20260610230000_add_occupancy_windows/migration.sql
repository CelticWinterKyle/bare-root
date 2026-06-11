-- THE TIME-DIMENSION KEYSTONE.
-- Plantings gain an explicit occupancy window [occupiesFrom, occupiesUntil)
-- and perennial liveness (isPerennial + clearedAt). The cellId+seasonId
-- unique is DROPPED: one cell may host successive plantings in a season as
-- long as windows don't overlap — enforced in resolveFootprint inside the
-- assign transaction under a per-bed advisory lock.
-- Backfill is pure COALESCE from existing columns and is rerunnable.

-- AlterTable: Planting occupancy window + perennial liveness
ALTER TABLE "Planting"
  ADD COLUMN "occupiesFrom" TIMESTAMP(3),
  ADD COLUMN "occupiesUntil" TIMESTAMP(3),
  ADD COLUMN "isPerennial" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "clearedAt" TIMESTAMP(3);

-- Backfill: window start = best-known ground date, else creation.
UPDATE "Planting"
SET "occupiesFrom" = COALESCE("plantedDate", "transplantDate", "createdAt")
WHERE "occupiesFrom" IS NULL;

-- Window end = actual harvest, else expected, else the season's end.
-- Still-null = open-ended; correct for in-flight plantings in open seasons.
UPDATE "Planting" p
SET "occupiesUntil" = COALESCE(
  p."actualHarvestDate",
  p."expectedHarvestDate",
  (SELECT s."endDate" FROM "Season" s WHERE s."id" = p."seasonId")
)
WHERE p."occupiesUntil" IS NULL;

ALTER TABLE "Planting" ALTER COLUMN "occupiesFrom" SET NOT NULL,
  ALTER COLUMN "occupiesFrom" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable: PlantLibrary perennial flag
ALTER TABLE "PlantLibrary" ADD COLUMN "isPerennial" BOOLEAN NOT NULL DEFAULT false;

-- Perennials by NAME ONLY — the seed data's categories are unreliable for
-- this (Pansy is tagged TREE, Alyssum SHRUB), so no category-based rule.
-- Names absent from the library simply match nothing.
UPDATE "PlantLibrary"
SET "isPerennial" = true
WHERE "source" = 'seed' AND "customForUserId" IS NULL AND "name" IN (
  'Artichoke', 'Asparagus', 'Blackberry', 'Blueberry', 'Currant', 'Lavender',
  'Mint', 'Oregano', 'Raspberry', 'Rhubarb', 'Rosemary', 'Sage', 'Strawberry',
  'Tarragon', 'Thyme', 'Chives', 'Echinacea'
);

-- Index swap: replace the unique with plain + perennial-scan indexes.
CREATE INDEX "Planting_cellId_seasonId_idx" ON "Planting"("cellId", "seasonId");
CREATE INDEX "Planting_isPerennial_clearedAt_idx" ON "Planting"("isPerennial", "clearedAt");
ALTER TABLE "Planting" DROP CONSTRAINT IF EXISTS "Planting_cellId_seasonId_key";
DROP INDEX IF EXISTS "Planting_cellId_seasonId_key";
