"use client";
import { useState, useTransition, useRef, useEffect } from "react";
import { PlantPicker } from "./PlantPicker";
import { CellDetail } from "./CellDetail";
import { SmartLayoutPanel } from "./SmartLayoutPanel";
import { updateCellSun } from "@/app/actions/planting";
import type { SunLevel, PlantingStatus } from "@/lib/generated/prisma/enums";
import type { LayoutAssignment } from "@/lib/services/smart-layout";
import { Sun, Sparkles, X, RotateCw, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

// Status → gradient fill + text color
const STATUS_STYLES: Record<string, { from: string; to: string; label: string }> = {
  PLANNED:      { from: "#8FA86B", to: "#7A9559", label: "Planned" },
  SEEDS_STARTED:{ from: "#D4A843", to: "#BA8F2E", label: "Seeds started" },
  TRANSPLANTED: { from: "#7AB648", to: "#609834", label: "Transplanted" },
  ACTIVE:       { from: "#4A7C2F", to: "#325A1F", label: "Active" },
  HARVESTING:   { from: "#C4790A", to: "#A36207", label: "Harvesting" },
  HARVESTED:    { from: "#9E9890", to: "#837E78", label: "Harvested" },
  FAILED:       { from: "#B85C3A", to: "#954928", label: "Failed" },
};

const SUN_CYCLE: SunLevel[] = ["FULL_SUN", "PARTIAL_SUN", "PARTIAL_SHADE", "FULL_SHADE"];
const SUN_LABEL: Record<string, string> = {
  FULL_SUN: "☀️", PARTIAL_SUN: "⛅", PARTIAL_SHADE: "🌥️", FULL_SHADE: "☁️",
};
const SUN_BG: Record<string, string> = {
  FULL_SUN: "#FEF9C3", PARTIAL_SUN: "#FEF3C7", PARTIAL_SHADE: "#E0F2FE", FULL_SHADE: "#F1F5F9",
};

// Vertical space to subtract from cell sizing:
// wooden frame p-3 (24) + inner p-px (2) + centering py-3 (24) ≈ 52px
const FRAME_PAD = 52;

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
  const [previewAssignments, setPreviewAssignments] = useState<LayoutAssignment[]>([]);
  const [justPlanted, setJustPlanted] = useState<Set<string>>(new Set());

  // Portrait beds (more rows than cols) auto-rotate to landscape for screen fit
  const [rotated, setRotated] = useState(() => gridRows > gridCols);
  const [zoom, setZoom] = useState(1);

  // Measure the scrollable viewport width for horizontal cell fitting
  const viewportRef = useRef<HTMLDivElement>(null);
  const [vpW, setVpW] = useState(700);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setVpW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Height constraint derived from window height — avoids circular dependency
  // with measuring a container whose size depends on its own content
  const [maxViewportH, setMaxViewportH] = useState(400);
  useEffect(() => {
    // header h-14 (56) + main pb-24 (96) + pt-10 (40) + page-header+mb-6 (68)
    // + toolbar (40) + gap-6×2 (48) + legend (20) + pb-4 (16) = 384px → use 396 for safety
    // Cap at 420 so cells don't grow huge on large monitors.
    const update = () => setMaxViewportH(Math.max(200, Math.min(window.innerHeight - 396, 420)));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Display orientation: rotated swaps columns ↔ rows
  const displayCols = rotated ? gridRows : gridCols;
  const displayRows = rotated ? gridCols : gridRows;

  // When rotated, sort cells col-first so CSS Grid auto-placement maps correctly
  const displayCells = rotated
    ? [...cells].sort((a, b) => a.col !== b.col ? a.col - b.col : a.row - b.row)
    : cells;

  // Auto-fit cell size:
  // - fitByH caps cells so the bed never overflows vertically
  // - fitByW is the natural width-based size
  // - For narrow beds (≤4 cols) apply a height-floor so shallow beds fill the screen;
  //   wide beds (>4 cols) use min(fitByW, fitByH) — no horizontal scroll forced
  const fitByW = Math.floor((vpW - FRAME_PAD) / displayCols);
  const fitByH = Math.floor((maxViewportH - FRAME_PAD) / displayRows);
  const targetByH = Math.min(300, Math.floor((maxViewportH * 0.95 - FRAME_PAD) / displayRows));
  const baseCellPx = Math.max(20, Math.min(fitByH, Math.max(fitByW, targetByH)));
  const cellPx = Math.max(20, Math.round(baseCellPx * zoom));

  // Dense mode: hide labels when cells are too small to read them
  const dense = cellPx < 36;

  function handleCellClick(cell: CellData) {
    if (sunMode) {
      const current = pendingSun[cell.id] ?? cell.sunLevel;
      const next = SUN_CYCLE[(SUN_CYCLE.indexOf(current) + 1) % SUN_CYCLE.length];
      setPendingSun((prev) => ({ ...prev, [cell.id]: next }));
      startSunUpdate(async () => { await updateCellSun(cell.id, next); });
      return;
    }
    if (cell.planting) {
      setPanel({ type: "detail", planting: cell.planting, cell });
    } else {
      setPanel({ type: "picker", cellId: cell.id });
    }
  }

  function handlePlanted(cellId: string) {
    setJustPlanted((prev) => new Set([...prev, cellId]));
    setTimeout(() => setJustPlanted((prev) => { const n = new Set(prev); n.delete(cellId); return n; }), 600);
  }

  function effectiveSun(cell: CellData): SunLevel {
    return pendingSun[cell.id] ?? cell.sunLevel;
  }

  const showPanel = panel.type !== "none";
  const canRotate = gridRows !== gridCols;
  const isEmpty = cells.every((c) => !c.planting);

  // For filtered legend and smart-layout highlight
  const presentStatuses = new Set(
    cells.map((c) => c.planting?.status).filter(Boolean) as PlantingStatus[]
  );
  const hasAnyWarnings = cells.some((c) => c.warnings.length > 0);
  const [hoveredAssignment, setHoveredAssignment] = useState<{ row: number; col: number } | null>(null);

  const btnBase = "flex items-center justify-center w-8 h-8 rounded-lg text-sm font-medium transition-all duration-200 bg-[#F5F0E8] text-[#6B6560] hover:bg-[#EDE8DF] hover:text-[#1C1C1A]";

  return (
    <div className="flex flex-col gap-6">
      {/* Toolbar — centered, constrained width */}
      <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Sun mapping */}
        <button
          onClick={() => { setSunMode((v) => !v); if (showPanel) setPanel({ type: "none" }); }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            sunMode
              ? "bg-amber-400 text-white shadow-sm shadow-amber-200"
              : "bg-[#F5F0E8] text-[#6B6560] hover:bg-[#EDE8DF] hover:text-[#1C1C1A]"
          }`}
        >
          <Sun className="w-4 h-4" />
          {sunMode ? "Tap cells to change sun" : "Map sun"}
        </button>
        {sunMode && (
          <button onClick={() => setSunMode(false)} className="text-sm text-[#9E9890] hover:text-[#1C1C1A] transition-colors">
            Done
          </button>
        )}

        {!sunMode && (
          <>
            {/* Rotate toggle (only for non-square beds) */}
            {canRotate && (
              <button
                onClick={() => setRotated((r) => !r)}
                title={rotated ? "Switch to portrait" : "Switch to landscape"}
                className={btnBase}
              >
                <RotateCw className="w-4 h-4" />
              </button>
            )}

            <div className="w-px h-5 bg-[#E8E2D9]" />

            {/* Zoom controls */}
            <button onClick={() => setZoom((z) => Math.min(4, z * 1.35))} title="Zoom in" className={btnBase}>
              <ZoomIn className="w-4 h-4" />
            </button>
            <button onClick={() => setZoom((z) => Math.max(0.25, z / 1.35))} title="Zoom out" className={btnBase}>
              <ZoomOut className="w-4 h-4" />
            </button>
            {zoom !== 1 && (
              <button onClick={() => setZoom(1)} title="Fit to screen" className={btnBase}>
                <Maximize2 className="w-4 h-4" />
              </button>
            )}

            {/* Plan bed — pushed to right edge of constrained toolbar */}
            <button
              onClick={() => setPanel(panel.type === "smart-layout" ? { type: "none" } : { type: "smart-layout" })}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ml-auto ${
                panel.type === "smart-layout"
                  ? "bg-[#2D5016] text-white shadow-sm"
                  : "bg-[#F5F0E8] text-[#6B6560] hover:bg-[#EDE8DF] hover:text-[#1C1C1A]"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Plan bed
              {!isPro && panel.type !== "smart-layout" && (
                <span className="text-[9px] font-semibold bg-[#C4790A] text-white px-1.5 py-0.5 rounded-full ml-0.5 leading-none">
                  PRO
                </span>
              )}
            </button>
          </>
        )}
      </div>
      </div>

      <div className="flex gap-4 items-start">
        {/* Bed column */}
        <div className="flex-1 min-w-0 flex flex-col gap-6">
          {/* Scrollable viewport — max height caps it, shrinks to content */}
          <div
            ref={viewportRef}
            className="overflow-auto rounded-2xl relative"
            style={{ maxHeight: maxViewportH }}
          >
            {/* Empty bed hint — shown until the first plant is added */}
            {isEmpty && !sunMode && panel.type === "none" && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="bg-white/90 backdrop-blur-sm rounded-xl px-4 py-3 shadow-md border border-[#E8E2D9] text-center">
                  <p className="text-sm font-semibold text-[#1C1C1A]">Tap any cell</p>
                  <p className="text-xs text-[#9E9890] mt-0.5">to assign a plant</p>
                </div>
              </div>
            )}
            {/* Center bed in viewport when smaller than viewport */}
            <div className="flex items-center justify-center min-h-full py-3">
              {/* Wooden frame */}
              <div
                className="rounded-2xl p-3 shadow-lg shrink-0"
                style={{ background: "linear-gradient(135deg, #8B6914 0%, #A07820 40%, #8B6914 100%)" }}
              >
                {/* Inner soil tray */}
                <div
                  className="rounded-xl overflow-hidden"
                  style={{ background: "linear-gradient(160deg, #3d2b1f 0%, #2d1f14 100%)" }}
                >
                  <div
                    className="grid gap-px p-px"
                    style={{
                      gridTemplateColumns: `repeat(${displayCols}, ${cellPx}px)`,
                      background: "#2d1f14",
                    }}
                  >
                    {displayCells.map((cell) => {
                      const sun = effectiveSun(cell);
                      const planting = cell.planting;
                      const style = planting ? STATUS_STYLES[planting.status] : null;
                      const hasHarmful = cell.warnings.some((w) => w.type === "HARMFUL");
                      const hasBeneficial = cell.warnings.some((w) => w.type === "BENEFICIAL");
                      const isSelected =
                        (panel.type === "picker" && panel.cellId === cell.id) ||
                        (panel.type === "detail" && panel.cell.id === cell.id);
                      const preview = previewAssignments.find((a) => a.row === cell.row && a.col === cell.col);
                      const isNew = justPlanted.has(cell.id);
                      const labelSize = Math.max(8, Math.min(13, cellPx * 0.2));
                      const badgePx = Math.max(12, Math.min(14, cellPx * 0.2));
                      const isHoveredByPlanner = hoveredAssignment?.row === cell.row && hoveredAssignment?.col === cell.col;

                      return (
                        <div
                          key={cell.id}
                          onClick={() => handleCellClick(cell)}
                          className={`relative flex items-end justify-center cursor-pointer select-none transition-all duration-150 ${
                            isNew ? "scale-110 z-10" : "scale-100"
                          }`}
                          style={{
                            width: cellPx,
                            height: cellPx,
                            background: sunMode
                              ? SUN_BG[sun]
                              : planting
                              ? `radial-gradient(circle at 50% 35%, ${style!.from}, ${style!.to})`
                              : preview
                              ? "rgba(107, 143, 71, 0.25)"
                              : "rgba(58, 38, 22, 0.6)",
                            boxShadow: isHoveredByPlanner
                              ? "inset 0 0 0 3px #C4790A, 0 2px 8px rgba(196,121,10,0.4)"
                              : isSelected
                              ? "inset 0 0 0 2.5px #2D5016, 0 2px 8px rgba(45,80,22,0.3)"
                              : planting
                              ? "inset 0 -2px 4px rgba(0,0,0,0.15), 0 1px 2px rgba(0,0,0,0.1)"
                              : "inset 0 1px 3px rgba(0,0,0,0.08)",
                          }}
                        >
                          {/* Sun mode emoji */}
                          {sunMode && (
                            <span className="absolute inset-0 flex items-center justify-center leading-none" style={{ fontSize: Math.max(10, cellPx * 0.45) }}>
                              {SUN_LABEL[sun]}
                            </span>
                          )}

                          {/* Planted cell label */}
                          {planting && !sunMode && !dense && (
                            <div
                              className="absolute inset-x-0 bottom-0 flex items-end justify-center pb-1 px-0.5"
                              style={{ background: "linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 100%)" }}
                            >
                              <span className="text-white font-semibold leading-tight text-center" style={{ fontSize: labelSize }}>
                                {planting.plant.name.split(" ")[0]}
                              </span>
                            </div>
                          )}

                          {/* Dense mode: abbreviated name instead of invisible dot */}
                          {planting && !sunMode && dense && (
                            <span
                              className="absolute inset-0 flex items-center justify-center text-white font-bold select-none pointer-events-none"
                              style={{
                                fontSize: Math.max(7, cellPx * 0.28),
                                textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                              }}
                              title={planting.plant.name}
                            >
                              {planting.plant.name.slice(0, Math.max(1, Math.floor(cellPx / 14)))}
                            </span>
                          )}

                          {/* Preview overlay */}
                          {preview && !planting && !sunMode && !dense && (
                            <div className="absolute inset-x-0 bottom-0 pb-1 px-0.5"
                              style={{ background: "linear-gradient(to top, rgba(45,80,22,0.35) 0%, transparent 100%)" }}
                            >
                              <span className="text-[#2D5016] font-medium text-center block leading-tight italic" style={{ fontSize: Math.max(8, labelSize - 1) }}>
                                {preview.plantName.split(" ")[0]}
                              </span>
                            </div>
                          )}

                          {/* Companion badge — min 12px, white ring, earthy colors */}
                          {!sunMode && planting && (hasHarmful || hasBeneficial) && (
                            <span
                              className="absolute top-1 right-1 rounded-full ring-[1.5px] ring-white shadow-sm"
                              style={{
                                width: badgePx,
                                height: badgePx,
                                background: hasHarmful ? "#B85C3A" : "#4A7C2F",
                              }}
                            />
                          )}

                          {/* Hover ring */}
                          {!sunMode && (
                            <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-100"
                              style={{ boxShadow: "inset 0 0 0 2px rgba(45,80,22,0.6)" }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Legend — only show statuses present in this bed */}
          {!sunMode && (
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 px-1">
              {presentStatuses.size === 0 && !hasAnyWarnings ? (
                <span className="text-xs text-[#9E9890]">Tap any cell to add a plant</span>
              ) : (
                <>
                  {Object.entries(STATUS_STYLES)
                    .filter(([key]) => presentStatuses.has(key as PlantingStatus))
                    .map(([key, s]) => (
                      <div key={key} className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm shadow-sm" style={{ background: `linear-gradient(135deg, ${s.from}, ${s.to})` }} />
                        <span className="text-xs text-[#9E9890]">{s.label}</span>
                      </div>
                    ))}
                  {hasAnyWarnings && (
                    <>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full shadow-sm" style={{ background: "#B85C3A" }} />
                        <span className="text-xs text-[#9E9890]">Conflict</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full shadow-sm" style={{ background: "#4A7C2F" }} />
                        <span className="text-xs text-[#9E9890]">Beneficial</span>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Side panel — slides in */}
        <div
          className="shrink-0 overflow-hidden transition-all duration-300 ease-in-out"
          style={{ width: showPanel ? 272 : 0, opacity: showPanel ? 1 : 0 }}
        >
          <div className="w-68" style={{ width: 272 }}>
            <div className="bg-white rounded-xl border border-[#E8E2D9] shadow-md overflow-hidden">
              {/* Panel header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#F5F0E8]">
                <p className="text-sm font-semibold text-[#1C1C1A]">
                  {panel.type === "picker"
                    ? "Add a plant"
                    : panel.type === "smart-layout"
                    ? "AI layout planner"
                    : "Plant details"}
                </p>
                <button
                  onClick={() => setPanel({ type: "none" })}
                  className="w-6 h-6 flex items-center justify-center rounded-full text-[#9E9890] hover:text-[#1C1C1A] hover:bg-[#F5F0E8] transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-4" style={{ maxHeight: 520, overflowY: "auto" }}>
                {panel.type === "picker" && (
                  <PlantPicker
                    cellId={panel.cellId}
                    seasonId={seasonId}
                    userId={userId}
                    recentPlants={recentPlants}
                    onClose={() => setPanel({ type: "none" })}
                    onPlanted={() => handlePlanted(panel.cellId)}
                  />
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
                  isPro ? (
                    <SmartLayoutPanel
                      bedId={bedId}
                      seasonId={seasonId}
                      userId={userId}
                      recentPlants={recentPlants}
                      onAssignmentsAccepted={(a) => setPreviewAssignments(a)}
                      onClose={() => setPanel({ type: "none" })}
                      onHoverAssignment={setHoveredAssignment}
                    />
                  ) : (
                    <div className="text-center py-8 space-y-3">
                      <div className="w-12 h-12 rounded-xl bg-[#F5F0E8] flex items-center justify-center mx-auto">
                        <Sparkles className="w-6 h-6 text-[#9E9890]" />
                      </div>
                      <p className="text-sm font-semibold text-[#1C1C1A]">AI layout planner</p>
                      <p className="text-xs text-[#6B6560] leading-relaxed">
                        Build an optimized bed from your plant wishlist. Respects spacing, sun requirements, and companion relations.
                      </p>
                      <a href="/settings/billing" className="inline-block text-sm font-medium text-[#C4790A] hover:underline">
                        Upgrade to Pro →
                      </a>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
