import { ActionError } from "@/lib/action-error";
import { Tier } from "@/lib/generated/prisma/enums";
import { db } from "@/lib/db";

export const TIER_LIMITS = {
  FREE: { gardens: 1, bedsPerGarden: 5, photos: 20, collaborators: 0 },
  PRO: {
    gardens: Infinity,
    bedsPerGarden: Infinity,
    photos: Infinity,
    collaborators: 5,
  },
} as const;

export class TierLimitError extends ActionError {
  constructor(code: "UPGRADE_REQUIRED" = "UPGRADE_REQUIRED") {
    super(code);
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

/**
 * The garden owner's id + tier. Every lock and cap follows the OWNER, never
 * the caller — a Pro collaborator can't add a sixth bed to a Free owner's
 * garden, and a Free owner's editors are locked out with them.
 */
async function gardenOwner(gardenId: string): Promise<{ id: string; tier: Tier } | null> {
  const g = await db.garden.findUnique({
    where: { id: gardenId },
    select: { userId: true, user: { select: { subscriptionTier: true } } },
  });
  return g ? { id: g.userId, tier: g.user.subscriptionTier } : null;
}

export async function checkCanCreateBed(gardenId: string): Promise<void> {
  const owner = await gardenOwner(gardenId);
  if (!owner || owner.tier === "PRO") return;
  const count = await db.bed.count({ where: { gardenId } });
  if (count >= TIER_LIMITS.FREE.bedsPerGarden) throw new TierLimitError("UPGRADE_REQUIRED");
}

/** Photos across ALL of an owner's plantings — the number the cap counts. */
export async function countOwnerPhotos(userId: string): Promise<number> {
  return db.plantingPhoto.count({
    where: { planting: { season: { garden: { userId } } } },
  });
}

export async function checkCanUploadPhoto(
  userId: string,
  tier: Tier
): Promise<void> {
  if (tier === "PRO") return;
  const count = await countOwnerPhotos(userId);
  if (count >= TIER_LIMITS.FREE.photos) throw new TierLimitError("UPGRADE_REQUIRED");
}

/**
 * Photos the garden's OWNER can still upload (null = unlimited). The UI gate
 * must use this, not the viewer's tier or one planting's count — otherwise a
 * free owner at the cap sees "Add photo", taps it, and the upload throws.
 */
export async function getPhotoAllowanceRemaining(gardenId: string): Promise<number | null> {
  const garden = await db.garden.findUnique({
    where: { id: gardenId },
    select: { userId: true, user: { select: { subscriptionTier: true } } },
  });
  if (!garden) return 0;
  if (garden.user.subscriptionTier === "PRO") return null;
  const used = await countOwnerPhotos(garden.userId);
  return Math.max(0, TIER_LIMITS.FREE.photos - used);
}

export async function checkCanAddCollaborator(tier: Tier): Promise<void> {
  if (tier === "PRO") return;
  throw new TierLimitError("UPGRADE_REQUIRED");
}

export function isProFeature(tier: Tier): boolean {
  return tier === "PRO";
}

/**
 * Gardens a FREE user is over-limit on, locked read-only after a downgrade.
 * Keeps the oldest `FREE.gardens` and locks the rest (by creation order).
 * PRO users never have locked gardens.
 */
export async function getLockedGardenIds(
  userId: string,
  tier: Tier
): Promise<string[]> {
  if (tier === "PRO") return [];
  const gardens = await db.garden.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return gardens.slice(TIER_LIMITS.FREE.gardens).map((g) => g.id);
}

/**
 * Beds in a garden a FREE user is over-limit on, locked read-only after a
 * downgrade. Keeps the oldest `FREE.bedsPerGarden` and locks the rest.
 */
export async function getLockedBedIds(
  gardenId: string,
  tier: Tier
): Promise<string[]> {
  if (tier === "PRO") return [];
  const beds = await db.bed.findMany({
    where: { gardenId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return beds.slice(TIER_LIMITS.FREE.bedsPerGarden).map((b) => b.id);
}

/**
 * Throw when the garden is locked read-only (a FREE owner over the garden
 * limit after a downgrade). Follows the OWNER's tier, so it blocks the
 * owner and their collaborators alike. Removing/deleting is intentionally
 * NOT gated so a downgraded owner can delete extras to get back under the
 * limit and unlock.
 */
export async function assertGardenWritable(gardenId: string): Promise<void> {
  const owner = await gardenOwner(gardenId);
  if (!owner || owner.tier === "PRO") return;
  const locked = await getLockedGardenIds(owner.id, owner.tier);
  if (locked.includes(gardenId)) throw new TierLimitError("UPGRADE_REQUIRED");
}

/**
 * Throw when the bed (or its garden) is locked read-only for a FREE owner.
 * Follows the OWNER's tier — the old version returned early for any
 * non-owner, so editors kept full write access to locked beds.
 */
export async function assertBedWritable(gardenId: string, bedId: string): Promise<void> {
  const owner = await gardenOwner(gardenId);
  if (!owner || owner.tier === "PRO") return;
  const [lockedGardens, lockedBeds] = await Promise.all([
    getLockedGardenIds(owner.id, owner.tier),
    getLockedBedIds(gardenId, owner.tier),
  ]);
  if (lockedGardens.includes(gardenId) || lockedBeds.includes(bedId)) {
    throw new TierLimitError("UPGRADE_REQUIRED");
  }
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
