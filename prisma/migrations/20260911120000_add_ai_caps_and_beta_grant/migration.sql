-- AI layout planner daily cap + beta-grant audit trail.

-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "aiRunsToday" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "aiRunsResetAt" TIMESTAMP(3),
  ADD COLUMN "betaGrantedAt" TIMESTAMP(3);
