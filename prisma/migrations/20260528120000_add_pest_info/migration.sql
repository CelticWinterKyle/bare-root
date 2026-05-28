-- AlterTable
ALTER TABLE "PlantLibrary" ADD COLUMN "commonPests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "PlantLibrary" ADD COLUMN "commonDiseases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
