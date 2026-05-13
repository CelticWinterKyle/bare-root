"use client";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { searchPlantsAction } from "@/app/actions/plants";
import { assignPlant } from "@/app/actions/planting";
import { Search, Loader2, Leaf, AlertTriangle } from "lucide-react";
import Image from "next/image";
import type { SpacingWarning } from "@/lib/services/spacing";

type Plant = {
  id: string;
  name: string;
  category: string;
  imageUrl: string | null;
  daysToMaturity: number | null;
};

export function PlantPicker({
  cellId,
  seasonId,
  userId,
  recentPlants,
  onClose,
  onPlanted,
}: {
  cellId: string;
  seasonId: string;
  userId: string;
  recentPlants: Plant[];
  onClose: () => void;
  onPlanted?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Plant[]>(recentPlants);
  const [isSearching, startSearch] = useTransition();
  const [isAssigning, startAssign] = useTransition();
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [spacingWarnings, setSpacingWarnings] = useState<SpacingWarning[]>([]);

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

  function handlePick(plantId: string) {
    setAssigningId(plantId);
    setSpacingWarnings([]);
    startAssign(async () => {
      const result = await assignPlant(cellId, plantId, seasonId);
      onPlanted?.();
      if (result.spacingWarnings.length > 0) {
        setSpacingWarnings(result.spacingWarnings);
        setTimeout(onClose, 2500);
      } else {
        onClose();
      }
    });
  }

  return (
    <div className="flex flex-col h-full">
      {spacingWarnings.length > 0 && (
        <div className="mb-3 p-2.5 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-yellow-800">Spacing conflict</p>
            {spacingWarnings.map((w, i) => (
              <p key={i} className="text-xs text-yellow-700">
                Too close to {w.neighborPlantName} ({w.distanceIn}" apart, needs {w.requiredIn}")
              </p>
            ))}
          </div>
        </div>
      )}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ADADAA]" />
        <Input
          autoFocus
          placeholder="Search plants…"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[#ADADAA]" />
        )}
      </div>

      {!query && recentPlants.length > 0 && (
        <p className="text-xs text-[#ADADAA] mb-2">Recently used</p>
      )}

      <div className="flex-1 overflow-y-auto space-y-1">
        {results.length === 0 ? (
          <div className="text-center py-8 text-[#ADADAA] text-sm">
            {query ? `No plants found for "${query}"` : "Search for a plant to add"}
          </div>
        ) : (
          results.map((plant) => (
            <button
              key={plant.id}
              onClick={() => handlePick(plant.id)}
              disabled={isAssigning}
              className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-[#F4F4EC] transition-colors text-left disabled:opacity-50"
            >
              {plant.imageUrl ? (
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#F4F4EC] shrink-0 relative">
                  <Image src={plant.imageUrl} alt={plant.name} fill className="object-cover" sizes="40px" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-lg bg-[#F4F4EC] flex items-center justify-center shrink-0 border border-[#E4E4DC]">
                  <span className="font-display text-base font-semibold text-[#ADADAA] select-none">
                    {plant.name[0].toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-[#111109] truncate">{plant.name}</p>
                <p className="text-xs text-[#ADADAA]">
                  {plant.daysToMaturity ? `${plant.daysToMaturity} days` : plant.category}
                </p>
              </div>
              {isAssigning && assigningId === plant.id && (
                <Loader2 className="w-4 h-4 animate-spin text-[#7DA84E] shrink-0" />
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
