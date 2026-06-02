-- CreateEnum
CREATE TYPE "PlantStartMethod" AS ENUM ('SEED_INDOORS', 'DIRECT_SOW', 'BUY_START');

-- AlterTable
ALTER TABLE "Planting" ADD COLUMN "startMethod" "PlantStartMethod";
