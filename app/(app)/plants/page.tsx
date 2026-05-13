import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PlantSearch } from "@/components/plants/PlantSearch";
import type { PlantCategory } from "@/lib/generated/prisma/enums";

const CATEGORIES: { value: PlantCategory; label: string; emoji: string }[] = [
  { value: "VEGETABLE", label: "Vegetables", emoji: "🥦" },
  { value: "FRUIT", label: "Fruits", emoji: "🍓" },
  { value: "HERB", label: "Herbs", emoji: "🌿" },
  { value: "FLOWER", label: "Flowers", emoji: "🌸" },
  { value: "TREE", label: "Trees", emoji: "🌳" },
  { value: "SHRUB", label: "Shrubs", emoji: "🌾" },
];

export default async function PlantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const user = await requireUser();
  const { q, category } = await searchParams;

  const [plants, inventory] = await Promise.all([
    db.plantLibrary.findMany({
      where: {
        AND: [
          {
            OR: [{ customForUserId: null }, { customForUserId: user.id }],
          },
          q ? { name: { contains: q, mode: "insensitive" } } : {},
          category ? { category: category as PlantCategory } : {},
        ],
      },
      orderBy: [{ source: "desc" }, { name: "asc" }],
      take: 48,
    }),
    db.seedInventory.findMany({
      where: { userId: user.id },
      select: { plantId: true, quantity: true },
    }),
  ]);

  const inventoryByPlant = new Map<string, number>();
  for (const item of inventory) {
    inventoryByPlant.set(item.plantId, (inventoryByPlant.get(item.plantId) ?? 0) + item.quantity);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold text-[#1C1C1A]">
          Plant Library
        </h1>
        <p className="text-[#6B6560] text-sm mt-1">
          Search for plants or browse by category.
        </p>
      </header>

      <PlantSearch
        initialPlants={plants}
        categories={CATEGORIES}
        initialQuery={q ?? ""}
        initialCategory={(category as PlantCategory) ?? null}
        userId={user.id}
        inventoryByPlant={Object.fromEntries(inventoryByPlant)}
      />
    </div>
  );
}
