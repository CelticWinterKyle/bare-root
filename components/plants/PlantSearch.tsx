"use client";
import { useState, useTransition, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { searchPlantsAction } from "@/app/actions/plants";
import type { PlantCategory } from "@/lib/generated/prisma/enums";
import { Search, Loader2, Leaf } from "lucide-react";

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

export function PlantSearch({
  initialPlants,
  categories,
  initialQuery,
  initialCategory,
  userId,
}: {
  initialPlants: Plant[];
  categories: Category[];
  initialQuery: string;
  initialCategory: PlantCategory | null;
  userId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(initialQuery);
  const [activeCategory, setActiveCategory] = useState<PlantCategory | null>(initialCategory);
  const [plants, setPlants] = useState<Plant[]>(initialPlants);
  const [isPending, startTransition] = useTransition();
  const [apiSearching, setApiSearching] = useState(false);

  const updateUrl = useCallback((q: string, cat: PlantCategory | null) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (cat) params.set("category", cat);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router]);

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
        {categories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => handleCategoryClick(cat.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeCategory === cat.value
                ? "bg-[#2D5016] text-white"
                : "bg-[#F5F0E8] text-[#6B6560] hover:bg-[#E8E2D9]"
            }`}
          >
            {cat.emoji} {cat.label}
          </button>
        ))}
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
          {plants.map((plant) => (
            <Link
              key={plant.id}
              href={`/plants/${plant.id}`}
              className="bg-white rounded-xl border border-[#E8E2D9] overflow-hidden hover:border-[#6B8F47] hover:shadow-sm transition-all group"
            >
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
                <div className="aspect-[4/3] bg-[#F5F0E8] flex items-center justify-center">
                  <Leaf className="w-8 h-8 text-[#E8E2D9]" />
                </div>
              )}
              <div className="p-3">
                <p className="font-medium text-sm text-[#1C1C1A] group-hover:text-[#2D5016] transition-colors leading-tight">
                  {plant.name}
                </p>
                {plant.scientificName && (
                  <p className="text-xs text-[#9E9890] mt-0.5 italic truncate">
                    {plant.scientificName}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1.5">
                  {plant.daysToMaturity && (
                    <span className="text-xs text-[#6B6560]">
                      {plant.daysToMaturity}d
                    </span>
                  )}
                  {plant.sunRequirement && (
                    <span className="text-xs text-[#6B6560]">
                      {sunLabel(plant.sunRequirement)}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function sunLabel(sun: string): string {
  const map: Record<string, string> = {
    FULL_SUN: "☀️ Full sun",
    PARTIAL_SUN: "⛅ Part sun",
    PARTIAL_SHADE: "🌥️ Part shade",
    FULL_SHADE: "☁️ Full shade",
  };
  return map[sun] ?? sun;
}
