import { db } from "@/lib/db";

type ExportUser = {
  id: string;
  email: string;
  name: string | null;
  subscriptionTier: string;
  createdAt: Date;
};

/**
 * Everything the user owns as a JSON-serializable object. Backs the
 * "Export my data" right promised in the privacy policy (served as
 * data.json inside the export zip, alongside the photo files).
 */
export async function gatherExportData(user: ExportUser) {
  const gardens = await db.garden.findMany({
    where: { userId: user.id },
    include: {
      beds: { include: { cells: true } },
      seasons: {
        include: {
          plantings: {
            include: {
              plant: { select: { name: true, category: true } },
              harvestLogs: true,
              photos: true,
              growthNotes: true,
            },
          },
        },
      },
    },
  });

  const seedInventory = await db.seedInventory.findMany({
    where: { userId: user.id },
    include: { plant: { select: { name: true } } },
  });

  return {
    exportedAt: new Date().toISOString(),
    account: {
      email: user.email,
      name: user.name,
      tier: user.subscriptionTier,
      createdAt: user.createdAt,
    },
    gardens,
    seedInventory,
  };
}
