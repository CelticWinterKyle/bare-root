"use client";

import { useState, useTransition } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Input } from "@/components/ui/input";
import { searchPlantsAction } from "@/app/actions/plants";
import { PlantThumb } from "@/components/plants/PlantThumb";
import { Search, Loader2 } from "lucide-react";
import type { PlantCategory } from "@/lib/generated/prisma/enums";

// Compact browse pills — the four categories people actually plant in beds.
const LIBRARY_CATEGORIES: { label: string; value: PlantCategory | null }[] = [
  { label: "All", value: null },
  { label: "Vegetables", value: "VEGETABLE" },
  { label: "Herbs", value: "HERB" },
  { label: "Flowers", value: "FLOWER" },
  { label: "Fruit", value: "FRUIT" },
];

export type LibraryPlant = {
  id: string;
  name: string;
  category: string;
  imageUrl: string | null;
  daysToMaturity: number | null;
  spacingInches: number | null;
};

// Category accents — used as a left-edge stripe on each library card so
// the panel reads as a colored crop list instead of grey rows.
const CATEGORY_ACCENT: Record<string, string> = {
  VEGETABLE: "#4a8a2e",
  FRUIT: "#C44A2A",
  HERB: "#7DA84E",
  FLOWER: "#BC6B8A",
  TREE: "#3d6b32",
  SHRUB: "#5A8240",
  OTHER: "#A07640",
};

function footprintHint(spacingInches: number | null, cellSizeIn: number): string | null {
  if (!spacingInches) return null;
  const side = Math.max(1, Math.ceil(spacingInches / cellSizeIn));
  if (side <= 1) return null;
  return `${side}×${side}`;
}

// How many of this plant fit the current bed (grid in cells), using the
// same footprint rule as placement. Null when bed dims aren't supplied.
function bedCapacity(
  spacingInches: number | null,
  cellSizeIn: number,
  gridCols?: number,
  gridRows?: number
): number | null {
  if (!gridCols || !gridRows) return null;
  const side = Math.max(1, Math.ceil((spacingInches ?? cellSizeIn) / cellSizeIn));
  const fit = Math.floor(gridCols / side) * Math.floor(gridRows / side);
  return fit > 0 ? fit : null;
}

function DraggablePlantCard({
  plant,
  cellSizeIn,
  gridCols,
  gridRows,
  onClick,
  selected,
}: {
  plant: LibraryPlant;
  cellSizeIn: number;
  gridCols?: number;
  gridRows?: number;
  onClick?: () => void;
  selected?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `plant:${plant.id}`,
    data: { kind: "plant", plant },
  });
  const hint = footprintHint(plant.spacingInches, cellSizeIn);
  const capacity = bedCapacity(plant.spacingInches, cellSizeIn, gridCols, gridRows);
  const accent = CATEGORY_ACCENT[plant.category] ?? CATEGORY_ACCENT.OTHER;

  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      type="button"
      onClick={onClick}
      className={`group relative w-full text-left rounded-lg border transition-all overflow-hidden ${
        isDragging ? "opacity-40 scale-95" : "hover:border-[#7DA84E] hover:shadow-sm"
      }`}
      style={{
        background: selected ? "#E4F0D4" : "#FDFDF8",
        borderColor: selected ? "#7DA84E" : "#E4E4DC",
        padding: "8px 10px 8px 14px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        cursor: isDragging ? "grabbing" : "grab",
      }}
    >
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0"
        style={{ width: 4, background: accent }}
      />
      <div
        className="shrink-0 rounded-md overflow-hidden relative"
        style={{ width: 36, height: 36 }}
      >
        <PlantThumb src={plant.imageUrl} category={plant.category} name={plant.name} />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-[13px] font-semibold truncate"
          style={{ color: "#111109", fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "-0.01em" }}
        >
          {plant.name}
        </p>
        <p
          className="text-[10px] mt-0.5 truncate"
          style={{
            color: "#6B6B5A",
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {[
            plant.daysToMaturity ? `${plant.daysToMaturity}d` : null,
            hint ? `${hint} cells` : null,
            capacity ? `~${capacity} fit` : null,
          ]
            .filter(Boolean)
            .join(" · ") || plant.category.toLowerCase()}
        </p>
      </div>
    </button>
  );
}

export function PlantLibrary({
  recentPlants,
  suggestionsLabel = "Recently used",
  cellSizeIn,
  gridCols,
  gridRows,
  userId,
  onCardClick,
  selectedPlantId,
}: {
  recentPlants: LibraryPlant[];
  /** Header over the default list — "Recently used" normally, "Popular
   *  plants" when a fresh garden's list was padded with curated picks. */
  suggestionsLabel?: string;
  cellSizeIn: number;
  gridCols?: number;
  gridRows?: number;
  userId: string;
  /** Optional click handler — falls back to drag when omitted. */
  onCardClick?: (plant: LibraryPlant) => void;
  selectedPlantId?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LibraryPlant[]>(recentPlants);
  const [activeCategory, setActiveCategory] = useState<PlantCategory | null>(null);
  const [isSearching, startSearch] = useTransition();

  function runSearch(q: string, category: PlantCategory | null) {
    if (q.length < 2 && category === null) {
      setResults(recentPlants);
      return;
    }
    startSearch(async () => {
      const found = await searchPlantsAction(q.length >= 2 ? q : "", category, userId);
      setResults(found);
    });
  }

  function handleSearch(q: string) {
    setQuery(q);
    runSearch(q, activeCategory);
  }

  function handleCategory(category: PlantCategory | null) {
    const next = activeCategory === category ? null : category;
    setActiveCategory(next);
    runSearch(query, next);
  }

  const showRecent = query.length < 2 && activeCategory === null && results.length > 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
            style={{ color: "#ADADAA" }}
          />
          <Input
            placeholder="Search plants..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
            style={{ background: "#FDFDF8" }}
          />
          {isSearching && (
            <Loader2
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin"
              style={{ color: "#7DA84E" }}
            />
          )}
        </div>
        {/* Category pills — browse without typing */}
        <div className="flex gap-1 overflow-x-auto flex-nowrap pt-2">
          {LIBRARY_CATEGORIES.map((c) => {
            const isActive = activeCategory === c.value;
            return (
              <button
                key={c.label}
                type="button"
                onClick={() => handleCategory(c.value)}
                className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors"
                style={{
                  border: `1.5px solid ${isActive ? "#1C3D0A" : "#E4E4DC"}`,
                  background: isActive ? "#1C3D0A" : "transparent",
                  color: isActive ? "white" : "#6B6B5A",
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>
        {showRecent && (
          <p
            className="mt-2"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#ADADAA",
            }}
          >
            {suggestionsLabel}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">
        {results.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm" style={{ color: "#6B6B5A" }}>
              No plants found
            </p>
            <p className="text-xs mt-1" style={{ color: "#ADADAA" }}>
              Try a different search
            </p>
          </div>
        ) : (
          results.map((p) => (
            <DraggablePlantCard
              key={p.id}
              plant={p}
              cellSizeIn={cellSizeIn}
              gridCols={gridCols}
              gridRows={gridRows}
              onClick={onCardClick ? () => onCardClick(p) : undefined}
              selected={selectedPlantId === p.id}
            />
          ))
        )}
      </div>
      <div
        className="px-3 py-2 text-center"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#ADADAA",
          borderTop: "1px solid #E4E4DC",
        }}
      >
        Drag onto a cell · or tap to select
      </div>
    </div>
  );
}
