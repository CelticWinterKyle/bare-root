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

  const [rawPlants, inventory] = await Promise.all([
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
      // Over-fetch so the dedupe below doesn't leave a sparse list when
      // Perenual duplicates dominate (e.g. searching "tomato" returns
      // 5 indistinguishable Perenual rows we'll collapse).
      take: 96,
    }),
    db.seedInventory.findMany({
      where: { userId: user.id },
      select: { plantId: true, quantity: true },
    }),
  ]);

  // Collapse Perenual duplicates against seed entries with the same
  // lowercase name. Same rule as searchPlantsAction.
  const seen = new Map<string, (typeof rawPlants)[number]>();
  for (const p of rawPlants) {
    const key = p.name.toLowerCase().trim();
    const existing = seen.get(key);
    if (!existing || (p.source === "seed" && existing.source !== "seed")) {
      seen.set(key, p);
    }
  }
  const plants = Array.from(seen.values()).slice(0, 48);

  const inventoryByPlant = new Map<string, number>();
  for (const item of inventory) {
    inventoryByPlant.set(item.plantId, (inventoryByPlant.get(item.plantId) ?? 0) + item.quantity);
  }

  return (
    <div className="container-narrow">
      {/* Page header */}
      <div className="px-[22px] md:px-8 pt-6 pb-5" style={{ borderBottom: "1px solid #E4E4DC" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#7DA84E", marginBottom: "6px" }}>
          <span style={{ display: "block", width: "16px", height: "1.5px", background: "#7DA84E", borderRadius: "1px", flexShrink: 0 }} />
          Library
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px, 4vw, 28px)", fontWeight: 800, color: "#111109", letterSpacing: "-0.025em", lineHeight: 1, fontVariationSettings: "'opsz' 28" }}>
          Plant <em style={{ fontStyle: "italic", color: "#1C3D0A" }}>Library</em>
        </h1>
      </div>

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
