import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { gardenAccessFilter } from "@/lib/permissions";
import { SeedInventoryClient } from "@/components/tracking/SeedInventoryClient";

export default async function InventoryPage() {
  const user = await requireUser();

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
  );
}
