-- Indexes for every hot FK/filter path. Postgres does not auto-index FK
-- columns; before this migration the only non-unique index in the schema
-- was PlantingCell_cellId_idx, so the per-request access checks and the
-- reminder scans were all sequential table scans.

-- Drop unused coordinate columns (weather/zone/frost derive from locationZip;
-- the zip lookup returns no coordinates and nothing reads these).
ALTER TABLE "Garden" DROP COLUMN "locationLat";
ALTER TABLE "Garden" DROP COLUMN "locationLng";

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "Garden_userId_idx" ON "Garden"("userId");

-- CreateIndex (gardenAccessFilter's collaborators.some({userId}) subquery —
-- the existing unique is led by gardenId, the wrong column for this lookup)
CREATE INDEX "GardenCollaborator_userId_idx" ON "GardenCollaborator"("userId");

-- CreateIndex
CREATE INDEX "Bed_gardenId_idx" ON "Bed"("gardenId");

-- CreateIndex
CREATE INDEX "Season_gardenId_isActive_idx" ON "Season"("gardenId", "isActive");

-- CreateIndex
CREATE INDEX "Planting_seasonId_idx" ON "Planting"("seasonId");

-- CreateIndex
CREATE INDEX "Planting_plantId_idx" ON "Planting"("plantId");

-- CreateIndex
CREATE INDEX "GrowthNote_plantingId_idx" ON "GrowthNote"("plantingId");

-- CreateIndex
CREATE INDEX "HarvestLog_plantingId_harvestedAt_idx" ON "HarvestLog"("plantingId", "harvestedAt");

-- CreateIndex
CREATE INDEX "PlantingPhoto_plantingId_idx" ON "PlantingPhoto"("plantingId");

-- CreateIndex
CREATE INDEX "PlantLibrary_customForUserId_idx" ON "PlantLibrary"("customForUserId");

-- CreateIndex
CREATE INDEX "PlantLibrary_category_idx" ON "PlantLibrary"("category");

-- CreateIndex
CREATE INDEX "CompanionRelation_relatedId_idx" ON "CompanionRelation"("relatedId");

-- CreateIndex (bell + reminders page: filter by user/dismissed, order by scheduledAt)
CREATE INDEX "Reminder_userId_dismissed_scheduledAt_idx" ON "Reminder"("userId", "dismissed", "scheduledAt");

-- CreateIndex (hourly dispatch scan: sentAt IS NULL AND scheduledAt <= now)
CREATE INDEX "Reminder_sentAt_scheduledAt_idx" ON "Reminder"("sentAt", "scheduledAt");

-- CreateIndex
CREATE INDEX "Reminder_plantingId_idx" ON "Reminder"("plantingId");

-- CreateIndex
CREATE INDEX "Reminder_gardenId_idx" ON "Reminder"("gardenId");

-- CreateIndex
CREATE INDEX "SeedInventory_plantId_idx" ON "SeedInventory"("plantId");
