-- GrowthNote gains an optional gardenId so a note can attach to the garden
-- as a whole ("aphids on the east bed") instead of a single planting.
-- Exactly one of plantingId/gardenId is set — enforced in application code.

-- AlterTable
ALTER TABLE "GrowthNote" ALTER COLUMN "plantingId" DROP NOT NULL;
ALTER TABLE "GrowthNote" ADD COLUMN "gardenId" TEXT;

-- CreateIndex
CREATE INDEX "GrowthNote_gardenId_idx" ON "GrowthNote"("gardenId");

-- AddForeignKey
ALTER TABLE "GrowthNote" ADD CONSTRAINT "GrowthNote_gardenId_fkey" FOREIGN KEY ("gardenId") REFERENCES "Garden"("id") ON DELETE CASCADE ON UPDATE CASCADE;
