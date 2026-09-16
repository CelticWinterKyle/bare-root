-- Per-person beta links.

-- CreateTable
CREATE TABLE "BetaInvite" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "note" TEXT,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BetaInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetaRedemption" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BetaRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BetaInvite_code_key" ON "BetaInvite"("code");
CREATE UNIQUE INDEX "BetaRedemption_inviteId_userId_key" ON "BetaRedemption"("inviteId", "userId");
CREATE INDEX "BetaRedemption_userId_idx" ON "BetaRedemption"("userId");

-- AddForeignKey
ALTER TABLE "BetaRedemption" ADD CONSTRAINT "BetaRedemption_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "BetaInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BetaRedemption" ADD CONSTRAINT "BetaRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
