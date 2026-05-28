import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { gardenAccessFilter } from "@/lib/permissions";
import { isProFeature } from "@/lib/tier";
import { SeedInventoryClient } from "@/components/tracking/SeedInventoryClient";

export default async function InventoryPage() {
  const user = await requireUser();

  // Seed inventory is a Pro feature (also enforced server-side in the
  // upsert/delete actions). Free users get an upsell instead of the tool.
  if (!isProFeature(user.subscriptionTier)) {
    return (
      <div className="container-narrow">
        <div className="px-[22px] md:px-8 py-16 text-center">
          <h1 className="font-display text-2xl font-semibold text-[#111109] mb-2">
            Seed inventory is a Pro feature
          </h1>
          <p className="text-sm text-[#6B6B5A] mb-6 max-w-md mx-auto">
            Track your seed packets, quantities, and what you still need to buy. Upgrade to
            Pro to unlock seed inventory.
          </p>
          <Link
            href="/settings/billing"
            className="inline-block bg-[#1C3D0A] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#3A6B20] transition-colors"
          >
            Upgrade to Pro
          </Link>
        </div>
      </div>
    );
  }

  const [inventory, gardens] = await Promise.all([
    db.seedInventory.findMany({
      where: { userId: user.id },
      include: { user: false, plant: { select: { id: true, name: true, category: true } } },
      orderBy: [{ plant: { name: "asc" } }, { variety: "asc" }],
    }),
    db.garden.findMany({
      where: gardenAccessFilter(user.id),
      include: {
        seasons: { where: { isActive: true }, take: 1 },
        beds: {
          include: {
            cells: {
              include: {
                plantings: {
                  where: { season: { isActive: true } },
                  include: { plant: { select: { id: true, name: true } } },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  // Build shopping list: active planned plantings not in inventory
  type ShoppingItem = { plantId: string; plantName: string; inInventory: boolean; inventoryQty: number | null };
  const inventoryByPlantId = new Map(inventory.map((i) => [i.plantId, i.quantity]));

  const plannedPlantIds = new Map<string, string>();
  for (const g of gardens) {
    for (const b of g.beds) {
      for (const c of b.cells) {
        for (const p of c.plantings) {
          if (!plannedPlantIds.has(p.plant.id)) {
            plannedPlantIds.set(p.plant.id, p.plant.name);
          }
        }
      }
    }
  }

  const shoppingList: ShoppingItem[] = [...plannedPlantIds.entries()].map(([id, name]) => ({
    plantId: id,
    plantName: name,
    inInventory: inventoryByPlantId.has(id) && (inventoryByPlantId.get(id) ?? 0) > 0,
    inventoryQty: inventoryByPlantId.get(id) ?? null,
  }));

  return (
    <div className="container-narrow">
      <SeedInventoryClient
        userId={user.id}
        inventory={inventory.map((i) => ({
          id: i.id,
          plantId: i.plantId,
          plantName: i.plant.name,
          variety: i.variety,
          quantity: i.quantity,
          unit: i.unit,
          notes: i.notes,
        }))}
        shoppingList={shoppingList}
      />
    </div>
  );
}
