"use client";
import { useState, useTransition, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { searchPlantsAction } from "@/app/actions/plants";
import type { PlantCategory } from "@/lib/generated/prisma/enums";
import { Search, Loader2, Leaf, Package } from "lucide-react";

type Plant = {
  id: string;
  name: string;
  scientificName: string | null;
  category: PlantCategory;
  imageUrl: string | null;
  sunRequirement: string | null;
  waterRequirement: string | null;
  daysToMaturity: number | null;
};

type Category = { value: PlantCategory; label: string; emoji: string };

const CATEGORY_STYLE: Record<string, { accent: string; bg: string }> = {
  VEGETABLE: { accent: "#4A7C2F", bg: "#EEF6E7" },
  FRUIT:     { accent: "#C4790A", bg: "#FFF4E6" },
  HERB:      { accent: "#6B8F47", bg: "#F2F6EE" },
  FLOWER:    { accent: "#9B4BAA", bg: "#F7EEF9" },
  TREE:      { accent: "#5C4A2A", bg: "#F2EDE6" },
  SHRUB:     { accent: "#3D6B50", bg: "#E8F2EC" },
  OTHER:     { accent: "#9E9890", bg: "#F5F0E8" },
};

const SUN_LABEL: Record<string, string> = {
  FULL_SUN: "☀️ Full sun",
  PARTIAL_SUN: "⛅ Part sun",
  PARTIAL_SHADE: "🌥️ Part shade",
  FULL_SHADE: "☁️ Full shade",
};

export function PlantSearch({
  initialPlants,
  categories,
  initialQuery,
  initialCategory,
  userId,
  inventoryByPlant = {},
}: {
  initialPlants: Plant[];
  categories: Category[];
  initialQuery: string;
  initialCategory: PlantCategory | null;
  userId: string;
  inventoryByPlant?: Record<string, number>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(initialQuery);
  const [activeCategory, setActiveCategory] = useState<PlantCategory | null>(initialCategory);
  const [plants, setPlants] = useState<Plant[]>(initialPlants);
  const [isPending, startTransition] = useTransition();
  const [apiSearching, setApiSearching] = useState(false);

  const updateUrl = useCallback(
    (q: string, cat: PlantCategory | null) => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (cat) params.set("category", cat);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router]
  );

  function handleCategoryClick(cat: PlantCategory | null) {
    const next = activeCategory === cat ? null : cat;
    setActiveCategory(next);
    updateUrl(query, next);
    startTransition(async () => {
      const results = await searchPlantsAction(query, next, userId);
      setPlants(results);
    });
  }

  function handleSearch(q: string) {
    setQuery(q);
    updateUrl(q, activeCategory);
    if (q.length === 0) {
      startTransition(async () => {
        const results = await searchPlantsAction("", activeCategory, userId);
        setPlants(results);
      });
      return;
    }
    if (q.length < 2) return;
    startTransition(async () => {
      setApiSearching(true);
      const results = await searchPlantsAction(q, activeCategory, userId);
      setPlants(results);
      setApiSearching(false);
    });
  }

  return (
    <div>
      {/* Search input */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9E9890]" />
        <Input
          placeholder="Search tomato, basil, marigold…"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9"
        />
        {(isPending || apiSearching) && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9E9890] animate-spin" />
        )}
      </div>

      {/* Category pills */}
      <div className="flex gap-2 flex-wrap mb-6">
        {categories.map((cat) => {
          const style = CATEGORY_STYLE[cat.value] ?? CATEGORY_STYLE.OTHER;
          const isActive = activeCategory === cat.value;
          return (
            <button
              key={cat.value}
              onClick={() => handleCategoryClick(cat.value)}
              className="px-3 py-1.5 rounded-full text-sm font-medium transition-all"
              style={
                isActive
                  ? { background: style.accent, color: "#fff" }
                  : { background: style.bg, color: style.accent }
              }
            >
              {cat.emoji} {cat.label}
            </button>
          );
        })}
      </div>

      {/* Results */}
      {plants.length === 0 ? (
        <div className="text-center py-12">
          <Leaf className="w-10 h-10 text-[#E8E2D9] mx-auto mb-3" />
          <p className="text-[#6B6560]">
            {query
              ? `No plants found for "${query}"`
              : "No plants in library yet. Search to add some."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {plants.map((plant) => {
            const style = CATEGORY_STYLE[plant.category] ?? CATEGORY_STYLE.OTHER;
            const stockQty = inventoryByPlant[plant.id];

            return (
              <Link
                key={plant.id}
                href={`/plants/${plant.id}`}
                className="bg-white rounded-xl overflow-hidden border border-[#E8E2D9] hover:border-[#6B8F47] hover:shadow-sm transition-all group flex flex-col"
              >
                {/* Top accent strip */}
                <div className="h-1 w-full" style={{ background: style.accent }} />

                {/* Image or placeholder */}
                {plant.imageUrl ? (
                  <div className="aspect-[4/3] relative bg-[#F5F0E8]">
                    <Image
                      src={plant.imageUrl}
                      alt={plant.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 50vw, 33vw"
                    />
                  </div>
                ) : (
                  <div
                    className="aspect-[4/3] flex items-center justify-center"
                    style={{ background: style.bg }}
                  >
                    <Leaf
                      className="w-9 h-9"
                      style={{ color: style.accent, opacity: 0.5 }}
                    />
                  </div>
                )}

                {/* Info */}
                <div className="p-3 flex-1 flex flex-col gap-1">
                  <div className="flex items-start justify-between gap-1">
                    <p
                      className="font-medium text-sm text-[#1C1C1A] group-hover:text-[#2D5016] transition-colors leading-tight"
                    >
                      {plant.name}
                    </p>
                    {stockQty === 0 && (
                      <span title="Out of stock" className="shrink-0">
                        <Package className="w-3.5 h-3.5 text-[#B85C3A]" />
                      </span>
                    )}
                    {stockQty != null && stockQty > 0 && (
                      <span title="In inventory" className="shrink-0">
                        <Package className="w-3.5 h-3.5 text-[#6B8F47]" />
                      </span>
                    )}
                  </div>

                  {plant.scientificName && (
                    <p className="text-xs text-[#9E9890] italic truncate">
                      {plant.scientificName}
                    </p>
                  )}

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1 mt-auto pt-1">
                    {plant.daysToMaturity && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-md font-medium"
                        style={{ background: "#FFF4E6", color: "#C4790A" }}
                      >
                        {plant.daysToMaturity}d
                      </span>
                    )}
                    {plant.sunRequirement && (
                      <span className="text-xs text-[#6B6560]">
                        {SUN_LABEL[plant.sunRequirement] ?? plant.sunRequirement}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
