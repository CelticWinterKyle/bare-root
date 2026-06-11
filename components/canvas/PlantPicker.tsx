"use client";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { searchPlantsAction } from "@/app/actions/plants";
import { assignPlant, bulkAssignPlant } from "@/app/actions/planting";
import { Search, Loader2, AlertTriangle, Package, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { PlantThumb } from "@/components/plants/PlantThumb";
import type { SpacingWarning } from "@/lib/services/spacing";
import type { BedFamilyHistory } from "@/lib/services/crop-rotation";

type Plant = {
  id: string;
  name: string;
  category: string;
  imageUrl: string | null;
  daysToMaturity: number | null;
  spacingInches: number | null;
  plantFamily?: string | null;
};

/**
 * "Needs X×X cells" for a plant in this bed. Derived from spacing data
 * already in PlantLibrary, so it's free to compute per-row. Returns null
 * for 1×1 plants (the default) so we don't add noise.
 */
function footprintHint(spacingInches: number | null, cellSizeIn: number): string | null {
  if (!spacingInches) return null;
  const side = Math.max(1, Math.ceil(spacingInches / cellSizeIn));
  if (side <= 1) return null;
  return `Needs ${side}×${side} cells`;
}

export function PlantPicker({
  cellId,
  cellIds,
  seasonId,
  userId,
  cellSizeIn,
  recentPlants,
  seedInventory = [],
  familyHistory = [],
  onClose,
  onPlanted,
}: {
  /** Single-cell mode anchor. Ignored when cellIds is provided. */
  cellId?: string;
  /** Bulk mode: an array of anchor cells. When set, picking a plant
   *  fans the placement out to every cell via bulkAssignPlant. */
  cellIds?: string[];
  seasonId: string;
  userId: string;
  cellSizeIn: number;
  recentPlants: Plant[];
  /** The user's seed inventory — drives the "have seeds" badge on plant
   *  rows so the picker answers "do I already own seeds for this?" */
  seedInventory?: { plantId: string; variety: string; quantity: number; unit: string }[];
  /** Plant families that grew in this bed in recent past seasons — rows for
   *  matching plants get a compact crop-rotation hint (warn, never block). */
  familyHistory?: BedFamilyHistory[];
  onClose: () => void;
  /** Fired once per planted cell so BedGrid can run its placement
   *  animation. In bulk mode it's invoked per anchor. */
  onPlanted?: (cellId: string) => void;
}) {
  const isBulk = !!cellIds && cellIds.length > 0;
  // Per-plant inventory summary: total quantity (summed across rows), the
  // first row's unit, and the first named variety ("Sungold · 2 packets").
  const invByPlant = new Map<string, { total: number; unit: string; variety: string | null }>();
  for (const row of seedInventory) {
    const cur = invByPlant.get(row.plantId);
    if (cur) {
      cur.total += row.quantity;
      if (!cur.variety && row.variety) cur.variety = row.variety;
    } else {
      invByPlant.set(row.plantId, { total: row.quantity, unit: row.unit, variety: row.variety || null });
    }
  }
  const historyByFamily = new Map(familyHistory.map((h) => [h.family, h]));
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
      if (isBulk) {
        const ids = cellIds!;
        const summary = await bulkAssignPlant(ids, plantId, seasonId);
        // Fire placement animations for each successful anchor. We don't
        // know exactly which ids succeeded vs were skipped due to
        // overlap, so we fire for all and let the visual refetch settle
        // — incorrect animations are harmless.
        ids.forEach((id) => onPlanted?.(id));
        const parts: string[] = [];
        if (summary.planted > 0) parts.push(`Planted ${summary.planted}`);
        if (summary.skipped > 0) parts.push(`${summary.skipped} skipped`);
        if (summary.reduced > 0) parts.push(`${summary.reduced} with reduced spacing`);
        if (summary.planted > 0) toast.success(parts.join(" · "));
        else toast.error("Couldn't plant any. Cells may already be occupied");
        onClose();
        return;
      }

      const result = await assignPlant(cellId!, plantId, seasonId);
      onPlanted?.(cellId!);
      // Footprint warning takes precedence — it's the more actionable
      // signal ("not enough room" vs "neighbors are close"). Spacing
      // warnings keep the picker open until the user dismisses them —
      // an auto-close cut people off mid-read.
      if (result.footprintWarning) {
        toast.warning(result.footprintWarning, { duration: 6000 });
      } else if (result.spacingWarnings.length > 0) {
        setSpacingWarnings(result.spacingWarnings);
        return;
      }
      onClose();
    });
  }

  return (
    <div className="flex flex-col h-full">
      {spacingWarnings.length > 0 && (
        <div className="mb-3 p-2.5 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-yellow-800">Spacing conflict — planted anyway</p>
            {spacingWarnings.map((w, i) => (
              <p key={i} className="text-xs text-yellow-700">
                Too close to {w.neighborPlantName} ({w.distanceIn}″ apart, needs {w.requiredIn}″)
              </p>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-xs font-semibold text-yellow-800 hover:text-yellow-900 px-2 py-1 rounded hover:bg-yellow-100 transition-colors"
          >
            Got it
          </button>
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
              <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 relative">
                <PlantThumb src={plant.imageUrl} category={plant.category} name={plant.name} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-[#111109] truncate">{plant.name}</p>
                <p className="text-xs text-[#ADADAA]">
                  {plant.daysToMaturity ? `${plant.daysToMaturity} days` : plant.category}
                  {(() => {
                    const hint = footprintHint(plant.spacingInches, cellSizeIn);
                    return hint ? <span className="text-[#3A6B20] font-medium"> · {hint}</span> : null;
                  })()}
                </p>
                {/* Placement-time crop-rotation hint: same family grew in
                    this bed in a recent past season. Informational only —
                    the plant stays pickable. */}
                {(() => {
                  const hist = plant.plantFamily ? historyByFamily.get(plant.plantFamily) : undefined;
                  if (!hist) return null;
                  return (
                    <p
                      className="mt-0.5 flex items-center gap-1 text-[10px]"
                      style={{ color: "#A06010" }}
                      title={`${hist.plantNames.join(", ")} grew here in ${hist.seasonName} — rotating families helps prevent disease buildup`}
                    >
                      <RotateCcw className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">
                        {hist.family} grew here in {hist.seasonName} — consider rotating
                      </span>
                    </p>
                  );
                })()}
              </div>
              {/* Seed-inventory badge — green pill matching the library page's
                  stock indicator. "Sungold · 2 packets" when a variety is on file. */}
              {(() => {
                const inv = invByPlant.get(plant.id);
                if (!inv || inv.total <= 0) return null;
                return (
                  <span
                    className="shrink-0 inline-flex items-center gap-1 max-w-[120px]"
                    title="In your seed inventory"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "8px",
                      letterSpacing: "0.03em",
                      color: "#3A6B20",
                      background: "#E4F0D4",
                      border: "1px solid #D4E8BE",
                      padding: "2px 6px",
                      borderRadius: "100px",
                    }}
                  >
                    <Package className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate">
                      {inv.variety ? `${inv.variety} · ` : ""}{inv.total} {inv.unit}
                    </span>
                  </span>
                );
              })()}
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
