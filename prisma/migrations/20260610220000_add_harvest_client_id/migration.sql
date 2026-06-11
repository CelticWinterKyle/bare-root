-- Idempotency key for offline-queued harvest logs: replaying the queue can
-- never create a duplicate row (unique violation = already synced).

-- AlterTable
ALTER TABLE "HarvestLog" ADD COLUMN "clientId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "HarvestLog_clientId_key" ON "HarvestLog"("clientId");
