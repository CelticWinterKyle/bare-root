"use client";
import { useState, useTransition, useRef, useEffect } from "react";
import { PlantPicker } from "./PlantPicker";
import { CellDetail } from "./CellDetail";
import { SmartLayoutPanel } from "./SmartLayoutPanel";
import { updateCellSun } from "@/app/actions/planting";
import type { SunLevel, PlantingStatus } from "@/lib/generated/prisma/enums";
import type { LayoutAssignment } from "@/lib/services/smart-layout";
import { Sparkles, X, RotateCw, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

// Status → light cell fill + border color + label
const STATUS_STYLES: Record<string, { from: string; to: string; label: string }> = {
  PLANNED:      { from: "#8FA86B", to: "#7A9559", label: "Planned" },
  SEEDS_STARTED:{ from: "#D4A843", to: "#BA8F2E", label: "Seeds started" },
  TRANSPLANTED: { from: "#7AB648", to: "#609834", label: "Transplanted" },
  ACTIVE:       { from: "#3A6B20", to: "#325A1F", label: "Active" },
  HARVESTING:   { from: "#D4820A", to: "#A36207", label: "Harvesting" },
  HARVESTED:    { from: "#ADADAA", to: "#837E78", label: "Harvested" },
  FAILED:       { from: "#B85C3A", to: "#954928", label: "Failed" },
};

const CELL_STYLE: Record<string, { bg: string; border: string }> = {
  PLANNED:       { bg: "#F0F8E8", border: "rgba(125,168,78,0.4)" },
  SEEDS_STARTED: { bg: "#FFFBEB", border: "rgba(212,130,10,0.35)" },
  TRANSPLANTED:  { bg: "#E8F5E0", border: "rgba(58,107,32,0.4)" },
  ACTIVE:        { bg: "#E4F0D4", border: "rgba(58,107,32,0.5)" },
  HARVESTING:    { bg: "#FDF2E0", border: "rgba(212,130,10,0.4)" },
  HARVESTED:     { bg: "#F4F4EC", border: "rgba(173,173,170,0.4)" },
  FAILED:        { bg: "#FBF0EE", border: "rgba(122,42,24,0.25)" },
};

const STATUS_DOT_COLOR: Record<string, string> = {
  PLANNED:       "#7DA84E",
  SEEDS_STARTED: "#D4820A",
  TRANSPLANTED:  "#3A6B20",
  ACTIVE:        "#3A6B20",
  HARVESTING:    "#D4820A",
  HARVESTED:     "#ADADAA",
  FAILED:        "#7A2A18",
};

const SUN_CYCLE: SunLevel[] = ["FULL_SUN", "PARTIAL_SUN", "PARTIAL_SHADE", "FULL_SHADE"];
const SUN_LABEL: Record<string, string> = {
  FULL_SUN: "☀️", PARTIAL_SUN: "⛅", PARTIAL_SHADE: "🌥️", FULL_SHADE: "☁️",
};
const SUN_BG: Record<string, string> = {
  FULL_SUN: "#FEF9C3", PARTIAL_SUN: "#FEF3C7", PARTIAL_SHADE: "#E0F2FE", FULL_SHADE: "#F1F5F9",
};

// Vertical space to subtract from cell sizing:
// graph-paper wrapper padding 14px*2 + centering py-3 (24) ≈ 28px
const FRAME_PAD = 28;

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
  const [activeTab, setActiveTab] = useState<"plant" | "sun" | "companions" | "smart">("plant");
  const sunMode = activeTab === "sun";
  const [, startSunUpdate] = useTransition();
  const [pendingSun, setPendingSun] = useState<Record<string, SunLevel>>({});
  const [previewAssignments, setPreviewAssignments] = useState<LayoutAssignment[]>([]);
  const [justPlanted, setJustPlanted] = useState<Set<string>>(new Set());

  // Portrait beds (more rows than cols) auto-rotate on desktop only.
  // On mobile, rotation creates unscrollable horizontal overflow, so we start un-rotated
  // and correct to desktop-rotation in the useEffect once we know the viewport.
  const [rotated, setRotated] = useState(false);
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

  // Keyboard zoom shortcuts: +/= to zoom in, - to zoom out, 0 to reset
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(4, z * 1.35));
      if (e.key === "-") setZoom((z) => Math.max(0.25, z / 1.35));
      if (e.key === "0") setZoom(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Height constraint derived from window height — avoids circular dependency
  // with measuring a container whose size depends on its own content
  const [maxViewportH, setMaxViewportH] = useState(400);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    // header h-14 (56) + main pb-24 (96) + pt-10 (40) + page-header+mb-6 (68)
    // + toolbar (40) + gap-6×2 (48) + legend (20) + pb-4 (16) = 384px → use 396 for safety
    // Cap at 420 so cells don't grow huge on large monitors.
    const update = () => {
      const mobile = window.innerWidth < 768;
      setMaxViewportH(Math.max(200, Math.min(window.innerHeight - 396, 420)));
      setIsMobile(mobile);
    };
    // Set initial rotation: only auto-rotate on desktop
    if (window.innerWidth >= 768 && gridRows > gridCols) setRotated(true);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Display orientation: rotated swaps columns ↔ rows
  const displayCols = rotated ? gridRows : gridCols;
  const displayRows = rotated ? gridCols : gridRows;

  // When rotated, sort cells col-first so CSS Grid auto-placement maps correctly
  const displayCells = rotated
    ? [...cells].sort((a, b) => a.col !== b.col ? a.col - b.col : a.row - b.row)
    : cells;

  // Auto-fit cell size:
  // Mobile: fit to viewport width, no height cap — page scrolls down naturally.
  // Desktop: balance width vs height, cap cells so the bed fits without vertical scroll.
  const fitByW = Math.floor((vpW - FRAME_PAD) / displayCols);
  const fitByH = Math.floor((maxViewportH - FRAME_PAD) / displayRows);
  const targetByH = Math.min(300, Math.floor((maxViewportH * 0.95 - FRAME_PAD) / displayRows));
  const baseCellPx = isMobile
    ? Math.max(40, fitByW)
    : Math.max(20, Math.min(fitByH, Math.max(fitByW, targetByH)));
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

  const showPanel = (activeTab === "plant" && panel.type !== "none") || activeTab === "smart" || activeTab === "companions";
  const canRotate = gridRows !== gridCols;
  const isEmpty = cells.every((c) => !c.planting);

  // For filtered legend and smart-layout highlight
  const presentStatuses = new Set(
    cells.map((c) => c.planting?.status).filter(Boolean) as PlantingStatus[]
  );
  const hasAnyWarnings = cells.some((c) => c.warnings.length > 0);
  const [hoveredAssignment, setHoveredAssignment] = useState<{ row: number; col: number } | null>(null);

  const btnBase = "flex items-center justify-center w-8 h-8 rounded-lg text-sm font-medium transition-all duration-200 bg-[#F4F4EC] text-[#6B6B5A] hover:bg-[#EAEADE] hover:text-[#111109]";

  return (
    <div className="flex flex-col">
      {/* Tab row */}
      <div style={{ borderBottom: "1px solid #E4E4DC", background: "#FDFDF8" }}>
        <div className="max-w-3xl mx-auto" style={{ display: "flex", alignItems: "stretch", overflow: "hidden" }}>
          <div style={{ display: "flex", overflowX: "auto", flex: 1, gap: 0 }}>
            {(["plant", "sun", "companions", "smart"] as const).map((tab) => {
              const labels: Record<string, string> = {
                plant: "Plant",
                sun: "Sun Map",
                companions: "Companions",
                smart: "Smart Layout ✦",
              };
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    if (tab !== "plant") setPanel({ type: "none" });
                  }}
                  style={{
                    fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 500,
                    color: isActive ? "#1C3D0A" : "#6B6B5A",
                    padding: "10px 14px",
                    borderBottom: isActive ? "2px solid #1C3D0A" : "2px solid transparent",
                    whiteSpace: "nowrap", cursor: "pointer", background: "none",
                    border: "none", borderBottomStyle: "solid",
                    transition: "color 0.15s, border-color 0.15s",
                  }}
                >
                  {labels[tab]}
                </button>
              );
            })}
          </div>
          {/* Zoom + rotate controls pushed right */}
          <div style={{ display: "flex", alignItems: "center", gap: "2px", padding: "0 8px", flexShrink: 0 }}>
            {canRotate && (
              <button onClick={() => setRotated((r) => !r)} title={rotated ? "Portrait" : "Landscape"} className={btnBase}>
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={() => setZoom((z) => Math.min(4, z * 1.35))} title="Zoom in (+)" className={btnBase}>
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setZoom((z) => Math.max(0.25, z / 1.35))} title="Zoom out (−)" className={btnBase}>
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            {zoom !== 1 && (
              <button onClick={() => setZoom(1)} title="Fit" className={btnBase}>
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-start" style={{ marginTop: "20px" }}>
        {/* Bed column */}
        <div className="flex-1 min-w-0 flex flex-col gap-6">
          {/* Viewport: desktop caps height so grid fits screen; mobile removes cap so page scrolls */}
          <div
            ref={viewportRef}
            className="overflow-auto rounded-2xl relative"
            style={isMobile ? {} : { maxHeight: maxViewportH }}
          >
            {/* Empty bed hint — shown until the first plant is added */}
            {isEmpty && !sunMode && panel.type === "none" && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="backdrop-blur-sm rounded-xl px-4 py-3 shadow-md text-center" style={{ background: "rgba(253,253,248,0.92)", border: "1px solid #E4E4DC" }}>
                  <p className="text-sm font-semibold" style={{ color: "#111109" }}>Tap any cell</p>
                  <p className="text-xs mt-0.5" style={{ color: "#ADADAA" }}>to assign a plant</p>
                </div>
              </div>
            )}
            {/* Center bed in viewport when smaller than viewport */}
            <div className="flex items-center justify-center min-h-full py-3">
              {/* Graph-paper bed container */}
              <div
                className="shrink-0"
                style={{
                  backgroundImage: "repeating-linear-gradient(0deg, rgba(28,61,10,0.06) 0, rgba(28,61,10,0.06) 1px, transparent 1px, transparent 100%), repeating-linear-gradient(90deg, rgba(28,61,10,0.06) 0, rgba(28,61,10,0.06) 1px, transparent 1px, transparent 100%)",
                  backgroundSize: "40px 40px",
                  backgroundColor: "#FDFDF8",
                  borderRadius: "12px",
                  border: "1.5px solid #E4E4DC",
                  overflow: "hidden",
                }}
              >
                  <div
                    className="grid"
                    style={{
                      gridTemplateColumns: `repeat(${displayCols}, ${cellPx}px)`,
                      gap: "4px",
                      padding: "14px 16px",
                      background: "transparent",
                    }}
                  >
                    {displayCells.map((cell) => {
                      const sun = effectiveSun(cell);
                      const planting = cell.planting;
                      const cellStyle = planting ? CELL_STYLE[planting.status] : null;
                      const hasHarmful = cell.warnings.some((w) => w.type === "HARMFUL");
                      const hasBeneficial = cell.warnings.some((w) => w.type === "BENEFICIAL");
                      const isSelected =
                        (panel.type === "picker" && panel.cellId === cell.id) ||
                        (panel.type === "detail" && panel.cell.id === cell.id);
                      const preview = previewAssignments.find((a) => a.row === cell.row && a.col === cell.col);
                      const isNew = justPlanted.has(cell.id);
                      const labelSize = Math.max(7, Math.min(10, cellPx * 0.18));
                      const badgePx = 13;
                      const isHoveredByPlanner = hoveredAssignment?.row === cell.row && hoveredAssignment?.col === cell.col;

                      const cellBg = sunMode
                        ? SUN_BG[sun]
                        : planting
                        ? cellStyle!.bg
                        : preview
                        ? "rgba(28,61,10,0.06)"
                        : "rgba(255,255,255,0.8)";

                      const cellBorder = sunMode
                        ? "rgba(28,61,10,0.1)"
                        : planting
                        ? cellStyle!.border
                        : preview
                        ? "rgba(28,61,10,0.15)"
                        : "rgba(28,61,10,0.1)";

                      const cellBoxShadow = isHoveredByPlanner
                        ? "inset 0 0 0 2px #D4820A, 0 2px 8px rgba(196,121,10,0.3)"
                        : isSelected
                        ? "inset 0 0 0 2px #1C3D0A, 0 2px 8px rgba(28,61,10,0.15)"
                        : planting
                        ? "0 1px 3px rgba(28,61,10,0.08)"
                        : "none";

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
                            background: cellBg,
                            border: `1.5px solid ${cellBorder}`,
                            borderRadius: "8px",
                            borderStyle: preview && !planting ? "dashed" : "solid",
                            boxShadow: cellBoxShadow,
                          }}
                        >
                          {/* Sun mode emoji */}
                          {sunMode && (
                            <span className="absolute inset-0 flex items-center justify-center leading-none" style={{ fontSize: Math.max(10, cellPx * 0.45) }}>
                              {SUN_LABEL[sun]}
                            </span>
                          )}

                          {/* Empty cell plus icon */}
                          {!planting && !preview && !sunMode && (
                            <span className="absolute inset-0 flex items-center justify-center leading-none select-none pointer-events-none" style={{ fontSize: "18px", color: "rgba(28,61,10,0.15)" }}>
                              +
                            </span>
                          )}

                          {/* Planted cell: status dot + label */}
                          {planting && !sunMode && !dense && (
                            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center pb-1 px-0.5 gap-0.5">
                              <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: STATUS_DOT_COLOR[planting.status] ?? "#ADADAA", flexShrink: 0 }} />
                              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "#3A3A30", fontSize: labelSize, lineHeight: 1.1, textAlign: "center" }}>
                                {planting.plant.name.split(" ")[0]}
                              </span>
                            </div>
                          )}

                          {/* Dense mode: abbreviated name */}
                          {planting && !sunMode && dense && (
                            <span
                              className="absolute inset-0 flex items-center justify-center font-bold select-none pointer-events-none"
                              style={{
                                fontFamily: "var(--font-display)",
                                fontSize: Math.max(7, cellPx * 0.28),
                                color: "#3A3A30",
                              }}
                              title={planting.plant.name}
                            >
                              {planting.plant.name.slice(0, Math.max(1, Math.floor(cellPx / 14)))}
                            </span>
                          )}

                          {/* Preview overlay */}
                          {preview && !planting && !sunMode && !dense && (
                            <div className="absolute inset-x-0 bottom-0 pb-1 px-0.5">
                              <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", color: "#1C3D0A", fontSize: Math.max(8, labelSize - 1), textAlign: "center", display: "block", lineHeight: 1.1 }}>
                                {preview.plantName.split(" ")[0]}
                              </span>
                            </div>
                          )}

                          {/* Companion badge */}
                          {!sunMode && planting && (hasHarmful || hasBeneficial) && (
                            <span
                              className="absolute top-1 right-1 rounded-full ring-[1.5px] ring-white shadow-sm"
                              style={{
                                width: badgePx,
                                height: badgePx,
                                background: hasHarmful ? "#7A2A18" : "#3A6B20",
                              }}
                            />
                          )}

                          {/* Hover ring */}
                          {!sunMode && (
                            <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-100"
                              style={{ boxShadow: "inset 0 0 0 2px rgba(28,61,10,0.35)", borderRadius: "8px" }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
              </div>
            </div>
          </div>

          {/* Legend — only show statuses present in this bed */}
          {!sunMode && (
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 px-1">
              {presentStatuses.size === 0 && !hasAnyWarnings ? (
                <span className="text-xs text-[#ADADAA]">Tap any cell to add a plant</span>
              ) : (
                <>
                  {Object.entries(STATUS_STYLES)
                    .filter(([key]) => presentStatuses.has(key as PlantingStatus))
                    .map(([key, s]) => (
                      <div key={key} className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm" style={{ background: CELL_STYLE[key]?.bg ?? s.from, border: `1px solid ${CELL_STYLE[key]?.border ?? "transparent"}` }} />
                        <span className="text-xs text-[#ADADAA]">{s.label}</span>
                      </div>
                    ))}
                  {hasAnyWarnings && (
                    <>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full shadow-sm" style={{ background: "#B85C3A" }} />
                        <span className="text-xs text-[#ADADAA]">Conflict</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full shadow-sm" style={{ background: "#3A6B20" }} />
                        <span className="text-xs text-[#ADADAA]">Beneficial</span>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Side panel — slides in (below grid on mobile, beside on desktop) */}
        <div
          className="overflow-hidden transition-all duration-300 ease-in-out w-full md:w-auto md:shrink-0"
          style={isMobile
            ? { maxHeight: showPanel ? 640 : 0, opacity: showPanel ? 1 : 0 }
            : { width: showPanel ? 272 : 0, opacity: showPanel ? 1 : 0 }}
        >
          <div className="w-full md:w-[272px]" style={{ minWidth: 0 }}>
            <div className="rounded-xl border shadow-md overflow-hidden" style={{ background: "#FDFDF8", borderColor: "#E4E4DC" }}>
              {/* Panel header — not shown for CellDetail (it has its own header) */}
              {!(activeTab === "plant" && panel.type === "detail") && activeTab !== "companions" && (
                <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#F4F4EC" }}>
                  <p className="text-sm font-semibold" style={{ color: "#111109" }}>
                    {activeTab === "smart" ? "AI layout planner" : activeTab === "plant" && panel.type === "picker" ? "Add a plant" : "Companion planting"}
                  </p>
                  <button
                    onClick={() => { setPanel({ type: "none" }); if (activeTab !== "plant") setActiveTab("plant"); }}
                    className="w-6 h-6 flex items-center justify-center rounded-full text-[#ADADAA] hover:text-[#111109] hover:bg-[#F4F4EC] transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div style={{ maxHeight: 560, overflowY: "auto" }}>
                <div className={activeTab === "plant" && panel.type === "detail" ? "" : "p-4"}>
                  {/* Plant mode: picker or detail */}
                  {activeTab === "plant" && panel.type === "picker" && (
                    <PlantPicker
                      cellId={panel.cellId}
                      seasonId={seasonId}
                      userId={userId}
                      recentPlants={recentPlants}
                      onClose={() => setPanel({ type: "none" })}
                      onPlanted={() => handlePlanted(panel.cellId)}
                    />
                  )}
                  {activeTab === "plant" && panel.type === "detail" && (
                    <CellDetail
                      planting={{ ...panel.planting, cell: { row: panel.cell.row, col: panel.cell.col } }}
                      warnings={panel.cell.warnings}
                      gardenId={gardenId}
                      bedId={bedId}
                      onClose={() => setPanel({ type: "none" })}
                    />
                  )}
                  {/* Smart layout */}
                  {activeTab === "smart" && (
                    isPro ? (
                      <SmartLayoutPanel
                        bedId={bedId}
                        seasonId={seasonId}
                        userId={userId}
                        recentPlants={recentPlants}
                        onAssignmentsAccepted={(a) => setPreviewAssignments(a)}
                        onClose={() => setActiveTab("plant")}
                        onHoverAssignment={setHoveredAssignment}
                      />
                    ) : (
                      <div className="text-center py-8 space-y-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto" style={{ background: "#F4F4EC" }}>
                          <Sparkles className="w-6 h-6" style={{ color: "#ADADAA" }} />
                        </div>
                        <p className="text-sm font-semibold" style={{ color: "#111109" }}>AI layout planner</p>
                        <p className="text-xs leading-relaxed" style={{ color: "#6B6B5A" }}>
                          Build an optimized bed from your plant wishlist. Respects spacing, sun requirements, and companion relations.
                        </p>
                        <a href="/settings/billing" className="inline-block text-sm font-medium hover:underline" style={{ color: "#D4820A" }}>
                          Upgrade to Pro →
                        </a>
                      </div>
                    )
                  )}
                  {/* Companions overview */}
                  {activeTab === "companions" && (
                    <div className="p-4">
                      {cells.every(c => c.warnings.length === 0) ? (
                        <div className="text-center py-8" style={{ color: "#ADADAA" }}>
                          <p className="text-sm">No companion relationships</p>
                          <p className="text-xs mt-1">found in this bed</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {cells.filter(c => c.warnings.length > 0 && c.planting).map(c => (
                            <div key={c.id}>
                              <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "12px", color: "#111109", marginBottom: "4px" }}>
                                {c.planting!.plant.name}
                              </p>
                              {c.warnings.map((w, i) => (
                                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "7px", marginBottom: "3px" }}>
                                  <div style={{
                                    width: "18px", height: "18px", borderRadius: "50%",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: "9px", flexShrink: 0, marginTop: "1px",
                                    background: w.type === "BENEFICIAL" ? "#E4F0D4" : "#FDF2E0",
                                    color: w.type === "BENEFICIAL" ? "#1C3D0A" : "#D4820A",
                                  }}>
                                    {w.type === "BENEFICIAL" ? "✓" : "!"}
                                  </div>
                                  <span style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "#3A3A30", lineHeight: 1.4 }}>
                                    {w.plantName}{w.notes ? ` — ${w.notes}` : ""}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
