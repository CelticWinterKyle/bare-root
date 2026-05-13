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

const CATEGORY_STYLE: Record<string, { accent: string; border: string; label: string }> = {
  VEGETABLE: { accent: "#2D5016", border: "#4A7C2F", label: "Vegetable" },
  FRUIT:     { accent: "#8B3A2A", border: "#C4790A", label: "Fruit" },
  HERB:      { accent: "#4A3820", border: "#6B8F47", label: "Herb" },
  FLOWER:    { accent: "#6B3A5A", border: "#9B4BAA", label: "Flower" },
  TREE:      { accent: "#3D2A0E", border: "#7A5C2A", label: "Tree" },
  SHRUB:     { accent: "#1A3D2A", border: "#3D6B50", label: "Shrub" },
  OTHER:     { accent: "#4A3820", border: "#8B7A60", label: "Other" },
};

const SUN_LABEL: Record<string, string> = {
  FULL_SUN:      "Full sun",
  PARTIAL_SUN:   "Part sun",
  PARTIAL_SHADE: "Part shade",
  FULL_SHADE:    "Full shade",
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
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
          style={{ color: "#8B7A60" }}
        />
        <Input
          placeholder="Search tomato, basil, marigold…"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9"
          style={{
            background: "#EDE3C8",
            border: "1px solid #D4C8A8",
            color: "#231A0D",
            fontFamily: "var(--font-crimson-pro)",
            fontSize: "16px",
          }}
        />
        {(isPending || apiSearching) && (
          <Loader2
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin"
            style={{ color: "#8B7A60" }}
          />
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
              className="px-3 py-1 rounded-sm font-mono text-xs uppercase tracking-wider transition-all"
              style={
                isActive
                  ? {
                      background: style.accent,
                      color: "#F5EDDA",
                      border: `1px solid ${style.accent}`,
                      letterSpacing: "0.1em",
                    }
                  : {
                      background: "transparent",
                      color: style.accent,
                      border: `1px solid ${style.border}`,
                      letterSpacing: "0.1em",
                    }
              }
            >
              {cat.emoji} {cat.label}
            </button>
          );
        })}
      </div>

      {/* Result count */}
      {plants.length > 0 && query && (
        <p className="font-mono text-xs mb-3" style={{ color: "#8B7A60", letterSpacing: "0.05em" }}>
          {plants.length} result{plants.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
        </p>
      )}

      {/* Results */}
      {plants.length === 0 ? (
        <div className="text-center py-12">
          <Leaf className="w-10 h-10 mx-auto mb-3" style={{ color: "#D4C8A8" }} />
          <p style={{ color: "#8B7A60" }}>
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
                className="group flex flex-col overflow-hidden transition-all paper-grain"
                style={{
                  background: "#EDE3C8",
                  border: "1px solid #D4C8A8",
                  borderRadius: "3px",
                  boxShadow: "0 1px 3px rgba(35,26,13,0.08)",
                }}
              >
                {/* Left border accent stripe — applied as box-shadow trick via wrapper */}
                <div
                  style={{
                    height: "3px",
                    background: style.border,
                    width: "100%",
                  }}
                />

                {/* Image or initial */}
                {plant.imageUrl ? (
                  <div className="aspect-[4/3] relative overflow-hidden" style={{ background: "#E4D8B8" }}>
                    <Image
                      src={plant.imageUrl}
                      alt={plant.name}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(max-width: 640px) 50vw, 33vw"
                    />
                  </div>
                ) : (
                  <div
                    className="aspect-[4/3] flex items-center justify-center relative overflow-hidden"
                    style={{ background: "#E4D8B8" }}
                  >
                    {/* Subtle dot grid */}
                    <div
                      className="absolute inset-0 opacity-30"
                      style={{
                        backgroundImage: `radial-gradient(circle, ${style.border} 1px, transparent 1px)`,
                        backgroundSize: "14px 14px",
                      }}
                    />
                    <span
                      className="relative font-display font-bold select-none"
                      style={{
                        color: style.accent,
                        opacity: 0.25,
                        fontSize: "3rem",
                        fontVariationSettings: "'opsz' 72",
                      }}
                    >
                      {plant.name[0].toUpperCase()}
                    </span>
                  </div>
                )}

                {/* Info */}
                <div className="p-2.5 flex-1 flex flex-col gap-1">
                  <div className="flex items-start justify-between gap-1">
                    <p
                      className="font-display font-semibold leading-tight transition-colors"
                      style={{
                        color: "#231A0D",
                        fontSize: "14px",
                        fontVariationSettings: "'opsz' 18",
                      }}
                    >
                      {plant.name}
                    </p>
                    {stockQty === 0 && (
                      <span title="Out of stock" className="shrink-0 mt-0.5">
                        <Package className="w-3 h-3" style={{ color: "#8B3A2A" }} />
                      </span>
                    )}
                    {stockQty != null && stockQty > 0 && (
                      <span title="In inventory" className="shrink-0 mt-0.5">
                        <Package className="w-3 h-3" style={{ color: "#2D5016" }} />
                      </span>
                    )}
                  </div>

                  {plant.scientificName && (
                    <p
                      className="italic leading-tight"
                      style={{ color: "#8B7A60", fontSize: "11px", fontFamily: "var(--font-crimson-pro)" }}
                    >
                      {plant.scientificName}
                    </p>
                  )}

                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-1">
                    {plant.daysToMaturity && (
                      <span
                        className="font-mono"
                        style={{
                          fontSize: "10px",
                          color: "#C4790A",
                          background: "rgba(196,121,10,0.12)",
                          padding: "1px 5px",
                          borderRadius: "2px",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {plant.daysToMaturity}d
                      </span>
                    )}
                    {plant.sunRequirement && (
                      <span
                        className="font-mono"
                        style={{ fontSize: "10px", color: "#8B7A60", letterSpacing: "0.03em" }}
                      >
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
