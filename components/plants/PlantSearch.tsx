"use client";
import { useState, useTransition, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { searchPlantsAction } from "@/app/actions/plants";
import { PlantThumb } from "@/components/plants/PlantThumb";
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

const CATEGORY_STYLE: Record<string, { accent: string; border: string; bg: string; label: string }> = {
  VEGETABLE: { accent: "#1C3D0A", border: "#D4E8BE", bg: "#E4F0D4", label: "Vegetable" },
  FRUIT:     { accent: "#7A2A18", border: "#F0C8C0", bg: "#FBE8E4", label: "Fruit" },
  HERB:      { accent: "#3A6B20", border: "#C8DEB0", bg: "#E0EDCC", label: "Herb" },
  FLOWER:    { accent: "#5A2A7A", border: "#DCC8F0", bg: "#EDE4F8", label: "Flower" },
  TREE:      { accent: "#3D2A0E", border: "#D4C8A8", bg: "#F0EAD8", label: "Tree" },
  SHRUB:     { accent: "#1A3D2A", border: "#B8D4C4", bg: "#D4EBE0", label: "Shrub" },
  OTHER:     { accent: "#3A3A30", border: "#D4D4C8", bg: "#EAEAE0", label: "Other" },
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
  // How many cards are shown; "Load more" reveals another page. Reset to the
  // first page whenever the result set changes (search / category).
  const PAGE = 48;
  const [visibleCount, setVisibleCount] = useState(PAGE);

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
    setVisibleCount(PAGE);
    updateUrl(query, next);
    startTransition(async () => {
      const results = await searchPlantsAction(query, next, userId);
      setPlants(results);
    });
  }

  function handleSearch(q: string) {
    setQuery(q);
    setVisibleCount(PAGE);
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
    <div className="px-[22px] md:px-8 pt-4 pb-8">
      {/* Search input */}
      <div className="relative mb-4">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
          style={{ color: "#ADADAA" }}
        />
        <Input
          placeholder="Search tomato, basil, marigold…"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9"
          style={{
            background: "#F4F4EC",
            border: "1px solid #E4E4DC",
            color: "#111109",
            fontSize: "15px",
          }}
        />
        {(isPending || apiSearching) && (
          <Loader2
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin"
            style={{ color: "#ADADAA" }}
          />
        )}
      </div>

      {/* Category pills — horizontal scroll, no emojis */}
      <div style={{ display: "flex", gap: "6px", overflowX: "auto", flexWrap: "nowrap", paddingBottom: "2px", marginBottom: "20px" }}>
        {categories.map((cat) => {
          const isActive = activeCategory === cat.value;
          return (
            <button
              key={cat.value}
              onClick={() => handleCategoryClick(cat.value)}
              style={{
                whiteSpace: "nowrap" as const,
                borderRadius: "100px",
                border: `1.5px solid ${isActive ? "#1C3D0A" : "#E4E4DC"}`,
                background: isActive ? "#1C3D0A" : "transparent",
                color: isActive ? "white" : "#6B6B5A",
                fontFamily: "var(--font-body)",
                fontSize: "13px",
                fontWeight: 500,
                padding: "6px 14px",
                cursor: "pointer",
                transition: "all 0.12s",
                flexShrink: 0,
              }}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Result count */}
      {plants.length > 0 && query && (
        <p className="font-mono text-xs mb-3" style={{ color: "#6B6B5A", letterSpacing: "0.05em" }}>
          {plants.length} result{plants.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
        </p>
      )}

      {/* Results */}
      {plants.length === 0 ? (
        <div className="text-center py-12">
          <Leaf className="w-10 h-10 mx-auto mb-3" style={{ color: "#D4E8BE" }} />
          <p style={{ color: "#6B6B5A" }}>
            {query
              ? `No plants found for "${query}"`
              : "No plants in library yet. Search to add some."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {plants.slice(0, visibleCount).map((plant) => {
            const style = CATEGORY_STYLE[plant.category] ?? CATEGORY_STYLE.OTHER;
            const stockQty = inventoryByPlant[plant.id];

            return (
              <Link
                key={plant.id}
                href={`/plants/${plant.id}`}
                className="group flex flex-col overflow-hidden transition-all"
                style={{
                  background: "#FDFDF8",
                  border: "1px solid #E4E4DC",
                  borderRadius: "10px",
                  boxShadow: "0 1px 4px rgba(28,61,10,0.04)",
                }}
              >
                {/* Card image area */}
                <div
                  className="relative overflow-hidden flex items-center justify-center"
                  style={{ height: "88px", background: "#F4F4EC", borderRadius: "10px 10px 0 0" }}
                >
                  <PlantThumb
                    src={plant.imageUrl}
                    category={plant.category}
                    name={plant.name}
                    className="transition-transform duration-500 group-hover:scale-105"
                  />
                  <span
                    style={{
                      position: "absolute",
                      bottom: "6px",
                      left: "6px",
                      fontFamily: "var(--font-mono)",
                      fontSize: "7px",
                      textTransform: "uppercase" as const,
                      letterSpacing: "0.1em",
                      padding: "2px 6px",
                      borderRadius: "100px",
                      background: "rgba(255,255,255,0.9)",
                      border: "1px solid rgba(0,0,0,0.08)",
                      color: "#6B6B5A",
                      zIndex: 1,
                    }}
                  >
                    {style.label}
                  </span>
                </div>

                {/* Info */}
                <div className="p-2.5 flex-1 flex flex-col gap-1">
                  <div className="flex items-start justify-between gap-1">
                    <p
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "13px",
                        fontWeight: 800,
                        color: "#111109",
                        letterSpacing: "-0.01em",
                        lineHeight: 1.15,
                        fontVariationSettings: "'opsz' 18",
                      }}
                    >
                      {plant.name}
                    </p>
                    {stockQty === 0 && (
                      <span title="Out of stock" className="shrink-0 mt-0.5">
                        <Package className="w-3 h-3" style={{ color: "#7A2A18" }} />
                      </span>
                    )}
                    {stockQty != null && stockQty > 0 && (
                      <span title="In inventory" className="shrink-0 mt-0.5">
                        <Package className="w-3 h-3" style={{ color: "#3A6B20" }} />
                      </span>
                    )}
                  </div>

                  {plant.scientificName && (
                    <p
                      style={{ fontFamily: "var(--font-body)", fontStyle: "italic", color: "#6B6B5A", fontSize: "10px", marginTop: "2px", lineHeight: 1.3 }}
                    >
                      {plant.scientificName}
                    </p>
                  )}

                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-1">
                    {plant.daysToMaturity && (
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "8px",
                          color: "#D4820A",
                          background: "#FDF2E0",
                          padding: "2px 6px",
                          borderRadius: "100px",
                          letterSpacing: "0.04em",
                          border: "1px solid rgba(212,130,10,0.25)",
                        }}
                      >
                        {plant.daysToMaturity}d
                      </span>
                    )}
                    {plant.sunRequirement && (
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "8px",
                          color: "#3A6B20",
                          background: "#E4F0D4",
                          padding: "2px 6px",
                          borderRadius: "100px",
                          letterSpacing: "0.03em",
                          border: "1px solid #D4E8BE",
                        }}
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

      {plants.length > visibleCount && (
        <div className="flex justify-center mt-7">
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + PAGE)}
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "13px",
              fontWeight: 600,
              color: "#1C3D0A",
              background: "transparent",
              border: "1.5px solid #E4E4DC",
              borderRadius: "100px",
              padding: "9px 22px",
              cursor: "pointer",
              transition: "all 0.12s",
            }}
          >
            Load more
            <span style={{ color: "#ADADAA", fontWeight: 500 }}>
              {" "}· {plants.length - visibleCount} more
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
