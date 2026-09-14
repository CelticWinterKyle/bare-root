-- AI planner cap moves from per-day to per-month; the counter is renamed to match.

-- AlterTable
ALTER TABLE "User" RENAME COLUMN "aiRunsToday" TO "aiRunsThisMonth";
