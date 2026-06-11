-- Display units preference (metric support).

-- CreateEnum
CREATE TYPE "Units" AS ENUM ('IMPERIAL', 'METRIC');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "units" "Units" NOT NULL DEFAULT 'IMPERIAL';
