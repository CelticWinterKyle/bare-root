"use client";
import { useState, useTransition } from "react";
import { PlantPicker } from "./PlantPicker";
import { CellDetail } from "./CellDetail";
import { SmartLayoutPanel } from "./SmartLayoutPanel";
import { updateCellSun } from "@/app/actions/planting";
import type { SunLevel, PlantingStatus } from "@/lib/generated/prisma/enums";
import type { LayoutAssignment } from "@/lib/services/smart-layout";
import { Sun, Sparkles } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  PLANNED: "bg-[#8FA86B]",
  SEEDS_STARTED: "bg-[#D4A843]",
  TRANSPLANTED: "bg-[#7AB648]",
  ACTIVE: "bg-[#4A7C2F]",
  HARVESTING: "bg-[#C4790A]",
  HARVESTED: "bg-[#9E9890]",
  FAILED: "bg-[#B85C3A]",
};

const SUN_CYCLE: SunLevel[] = ["FULL_SUN", "PARTIAL_SUN", "PARTIAL_SHADE", "FULL_SHADE"];
const SUN_ICONS: Record<string, string> = {
  FULL_SUN: "☀️",
  PARTIAL_SUN: "⛅",
  PARTIAL_SHADE: "🌥️",
  FULL_SHADE: "☁️",
};

type Plant = { id: string; name: string; category: string; imageUrl: string | null; daysToMaturity: number | null };

type Planting = {
  id: string;
  status: PlantingStatus;
  plant: Plant;
  plantedDate: Date | null;
  transplantDate: Date | null;
  expectedHarvestDate: Date | null;
};

type CellData = {
  id: string;
  row: number;
  col: number;
  sunLevel: SunLevel;
  planting: Planting | null;
  warnings: { type: "BENEFICIAL" | "HARMFUL"; plantName: string; notes: string | null }[];
};

type Props = {
  bedId: string;
  gardenId: string;
  gridCols: number;
  gridRows: number;
  cellSizeIn: number;
  cells: CellData[];
  seasonId: string;
  userId: string;
  recentPlants: Plant[];
  isPro?: boolean;
};

type PanelState =
  | { type: "none" }
  | { type: "picker"; cellId: string }
  | { type: "detail"; planting: Planting; cell: CellData }
  | { type: "smart-layout" };

export function BedGrid({ bedId, gardenId, gridCols, gridRows, cells, seasonId, userId, recentPlants, isPro }: Props) {
  const [panel, setPanel] = useState<PanelState>({ type: "none" });
  const [sunMode, setSunMode] = useState(false);
  const [, startSunUpdate] = useTransition();
  const [pendingSun, setPendingSun] = useState<Record<string, SunLevel>>({});
  // Preview assignments from smart layout (shown on cells before accepting)
  const [previewAssignments, setPreviewAssignments] = useState<LayoutAssignment[]>([]);

  function handleCellClick(cell: CellData) {
    if (sunMode) {
      const current = pendingSun[cell.id] ?? cell.sunLevel;
      const nextIdx = (SUN_CYCLE.indexOf(current) + 1) % SUN_CYCLE.length;
      const next = SUN_CYCLE[nextIdx];
      setPendingSun((prev) => ({ ...prev, [cell.id]: next }));
      startSunUpdate(async () => {
        await updateCellSun(cell.id, next);
      });
      return;
    }

    if (cell.planting) {
      setPanel({ type: "detail", planting: cell.planting, cell });
    } else {
      setPanel({ type: "picker", cellId: cell.id });
    }
  }

  // Compute effective sun (local optimistic state)
  function effectiveSun(cell: CellData): SunLevel {
    return pendingSun[cell.id] ?? cell.sunLevel;
  }

  const showPanel = panel.type !== "none";

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setSunMode((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            sunMode
              ? "bg-[#D4A843] text-white"
              : "bg-[#F5F0E8] text-[#6B6560] hover:bg-[#E8E2D9]"
          }`}
        >
          <Sun className="w-4 h-4" />
          {sunMode ? "Editing sun — tap cells" : "Edit sun mapping"}
        </button>
        {sunMode && (
          <button
            onClick={() => setSunMode(false)}
            className="text-sm text-[#9E9890] hover:text-[#1C1C1A]"
          >
            Done
          </button>
        )}
        {!sunMode && (
          <button
            onClick={() => setPanel(panel.type === "smart-layout" ? { type: "none" } : { type: "smart-layout" })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ml-auto ${
              panel.type === "smart-layout"
                ? "bg-[#2D5016] text-white"
                : "bg-[#F5F0E8] text-[#6B6560] hover:bg-[#E8E2D9]"
            }`}
            title={isPro ? "AI layout planner" : "Upgrade to Pro for AI layout planner"}
          >
            <Sparkles className="w-4 h-4" />
            Plan bed
          </button>
        )}
      </div>

      <div className="flex gap-4 items-start">
        {/* Grid */}
        <div className="flex-1 min-w-0">
          <div
            className="grid gap-0.5"
            style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
          >
            {cells.map((cell) => {
              const sun = effectiveSun(cell);
              const planting = cell.planting;
              const hasHarmful = cell.warnings.some((w) => w.type === "HARMFUL");
              const hasBeneficial = cell.warnings.some((w) => w.type === "BENEFICIAL");
              const isSelected =
                (panel.type === "picker" && panel.cellId === cell.id) ||
                (panel.type === "detail" && panel.cell.id === cell.id);
              const preview = previewAssignments.find((a) => a.row === cell.row && a.col === cell.col);

              return (
                <div
                  key={cell.id}
                  onClick={() => handleCellClick(cell)}
                  className={`relative aspect-square flex items-end justify-center cursor-pointer rounded-sm transition-all select-none ${
                    sunMode
                      ? "hover:opacity-80"
                      : "hover:ring-2 hover:ring-[#2D5016] hover:ring-offset-1"
                  } ${isSelected ? "ring-2 ring-[#2D5016] ring-offset-1" : ""} ${
                    planting
                      ? STATUS_COLORS[planting.status] ?? "bg-[#8FA86B]"
                      : preview
                      ? "bg-[#6B8F47]/20 border-2 border-dashed border-[#6B8F47]"
                      : sunMode
                      ? sunBg(sun)
                      : "bg-[#FAF7F2] border border-[#E8E2D9]"
                  }`}
                >
                  {/* Sun icon in sun mode */}
                  {sunMode && (
                    <span className="absolute inset-0 flex items-center justify-center text-sm">
                      {SUN_ICONS[sun]}
                    </span>
                  )}

                  {/* Plant name */}
                  {planting && !sunMode && gridCols <= 16 && (
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-medium text-white text-center px-0.5 leading-tight">
                      {planting.plant.name.split(" ")[0]}
                    </span>
                  )}

                  {/* Smart layout preview label */}
                  {preview && !planting && !sunMode && gridCols <= 16 && (
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-medium text-[#2D5016] text-center px-0.5 leading-tight italic">
                      {preview.plantName.split(" ")[0]}
                    </span>
                  )}

                  {/* Warning badges */}
                  {!sunMode && planting && (hasHarmful || hasBeneficial) && (
                    <span
                      className={`absolute top-0.5 right-0.5 w-2 h-2 rounded-full ${
                        hasHarmful ? "bg-red-400" : "bg-emerald-400"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          {!sunMode && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
              {Object.entries(STATUS_COLORS).map(([status, color]) => (
                <div key={status} className="flex items-center gap-1">
                  <div className={`w-3 h-3 rounded-sm ${color}`} />
                  <span className="text-xs text-[#9E9890]">
                    {status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <span className="text-xs text-[#9E9890]">Conflict</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
                <span className="text-xs text-[#9E9890]">Beneficial</span>
              </div>
            </div>
          )}
        </div>

        {/* Side panel */}
        {showPanel && (
          <div className="w-64 shrink-0 bg-white rounded-xl border border-[#E8E2D9] p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-[#1C1C1A]">
                {panel.type === "picker" ? "Choose a plant" : panel.type === "smart-layout" ? "AI layout planner" : "Plant details"}
              </p>
              <button
                onClick={() => setPanel({ type: "none" })}
                className="text-[#9E9890] hover:text-[#1C1C1A] text-lg leading-none"
              >
                ×
              </button>
            </div>

            {panel.type === "picker" && (
              <div style={{ height: 320 }}>
                <PlantPicker
                  cellId={panel.cellId}
                  seasonId={seasonId}
                  userId={userId}
                  recentPlants={recentPlants}
                  onClose={() => setPanel({ type: "none" })}
                />
              </div>
            )}

            {panel.type === "detail" && (
              <CellDetail
                planting={{ ...panel.planting, cell: { row: panel.cell.row, col: panel.cell.col } }}
                warnings={panel.cell.warnings}
                gardenId={gardenId}
                bedId={bedId}
                onClose={() => setPanel({ type: "none" })}
              />
            )}

            {panel.type === "smart-layout" && (
              <div style={{ height: 400 }}>
                {isPro ? (
                  <SmartLayoutPanel
                    bedId={bedId}
                    seasonId={seasonId}
                    userId={userId}
                    recentPlants={recentPlants}
                    onAssignmentsAccepted={(a) => setPreviewAssignments(a)}
                    onClose={() => setPanel({ type: "none" })}
                  />
                ) : (
                  <div className="text-center py-8 space-y-3">
                    <Sparkles className="w-8 h-8 text-[#9E9890] mx-auto" />
                    <p className="text-sm font-medium text-[#1C1C1A]">AI layout planner</p>
                    <p className="text-xs text-[#9E9890]">
                      Build an optimized bed layout from your plant wishlist.
                    </p>
                    <a
                      href="/settings/billing"
                      className="inline-block text-sm font-medium text-[#C4790A] hover:underline"
                    >
                      Upgrade to Pro →
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function sunBg(sun: SunLevel): string {
  return (
    {
      FULL_SUN: "bg-yellow-100",
      PARTIAL_SUN: "bg-yellow-50",
      PARTIAL_SHADE: "bg-blue-50",
      FULL_SHADE: "bg-slate-100",
    }[sun] ?? "bg-[#FAF7F2]"
  );
}
