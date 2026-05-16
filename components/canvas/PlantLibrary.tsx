"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useDraggable } from "@dnd-kit/core";
import { Input } from "@/components/ui/input";
import { searchPlantsAction } from "@/app/actions/plants";
import { Search, Loader2 } from "lucide-react";

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

function DraggablePlantCard({
  plant,
  cellSizeIn,
  onClick,
  selected,
}: {
  plant: LibraryPlant;
  cellSizeIn: number;
  onClick?: () => void;
  selected?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `plant:${plant.id}`,
    data: { kind: "plant", plant },
  });
  const hint = footprintHint(plant.spacingInches, cellSizeIn);
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
        className="shrink-0 rounded-md overflow-hidden flex items-center justify-center relative"
        style={{
          width: 36,
          height: 36,
          background: plant.imageUrl ? "#F4F4EC" : "#E4F0D4",
        }}
      >
        {plant.imageUrl ? (
          <Image
            src={plant.imageUrl}
            alt={plant.name}
            fill
            sizes="36px"
            className="object-cover"
          />
        ) : (
          <span style={{ fontSize: 18 }}>🌱</span>
        )}
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
  cellSizeIn,
  userId,
  onCardClick,
  selectedPlantId,
}: {
  recentPlants: LibraryPlant[];
  cellSizeIn: number;
  userId: string;
  /** Optional click handler — falls back to drag when omitted. */
  onCardClick?: (plant: LibraryPlant) => void;
  selectedPlantId?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LibraryPlant[]>(recentPlants);
  const [isSearching, startSearch] = useTransition();

  function handleSearch(q: string) {
    setQuery(q);
    if (q.length < 2) {
      setResults(recentPlants);
      return;
    }
    startSearch(async () => {
      const found = await searchPlantsAction(q, null, userId);
      setResults(found);
    });
  }

  const showRecent = query.length < 2 && results.length > 0;

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
            Recently used
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
