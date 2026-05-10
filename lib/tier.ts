import { Tier } from "@/lib/generated/prisma/enums";
import { db } from "@/lib/db";

export const TIER_LIMITS = {
  FREE: { gardens: 1, bedsPerGarden: 3, photos: 20, collaborators: 0 },
  PRO: {
    gardens: Infinity,
    bedsPerGarden: Infinity,
    photos: Infinity,
    collaborators: 5,
  },
} as const;

export class TierLimitError extends Error {
  constructor(public readonly code: "UPGRADE_REQUIRED") {
    super("Tier limit reached");
    this.name = "TierLimitError";
  }
}

type Resource = "garden" | "bed" | "photo" | "collaborator";

export async function getUserWithCounts(userId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      _count: { select: { gardens: true } },
    },
  });
  return user;
}

export async function checkCanCreateGarden(
  userId: string,
  tier: Tier
): Promise<void> {
  if (tier === "PRO") return;
  const count = await db.garden.count({ where: { userId } });
  if (count >= TIER_LIMITS.FREE.gardens) throw new TierLimitError("UPGRADE_REQUIRED");
}

export async function checkCanCreateBed(
  gardenId: string,
  tier: Tier
): Promise<void> {
  if (tier === "PRO") return;
  const count = await db.bed.count({ where: { gardenId } });
  if (count >= TIER_LIMITS.FREE.bedsPerGarden) throw new TierLimitError("UPGRADE_REQUIRED");
}

export async function checkCanUploadPhoto(
  userId: string,
  tier: Tier
): Promise<void> {
  if (tier === "PRO") return;
  const count = await db.plantingPhoto.count({
    where: { planting: { season: { garden: { userId } } } },
  });
  if (count >= TIER_LIMITS.FREE.photos) throw new TierLimitError("UPGRADE_REQUIRED");
}

export async function checkCanAddCollaborator(tier: Tier): Promise<void> {
  if (tier === "PRO") return;
  throw new TierLimitError("UPGRADE_REQUIRED");
}

export function isProFeature(tier: Tier): boolean {
  return tier === "PRO";
}

export function getBedCountForWarning(
  currentCount: number,
  tier: Tier
): { showWarning: boolean; remaining: number } | null {
  if (tier === "PRO") return null;
  const limit = TIER_LIMITS.FREE.bedsPerGarden;
  const remaining = limit - currentCount;
  if (remaining <= 1) return { showWarning: true, remaining };
  return null;
}
