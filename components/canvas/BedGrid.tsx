"use client";
import { useState, useTransition, useRef, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { PlantPicker } from "./PlantPicker";
import { CellDetail } from "./CellDetail";
import { SmartLayoutPanel } from "./SmartLayoutPanel";
import { PlantLibrary, type LibraryPlant } from "./PlantLibrary";
import { updateCellSun, assignPlant, bulkAssignPlant, movePlanting } from "@/app/actions/planting";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { Sprout, X as CloseIcon, Check, CheckSquare, Move, Sun, Leaf, MousePointer2 } from "lucide-react";
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

// Plant-category accent colors — used for the disc rendered inside a
// planted cell. Matches the 2D garden view and dashboard so a tomato
// reads as red, a herb reads as sage, etc., regardless of which view
// you're in.
const CATEGORY_COLOR: Record<string, string> = {
  VEGETABLE: "#4a8a2e",
  FRUIT: "#C44A2A",
  HERB: "#7DA84E",
  FLOWER: "#BC6B8A",
  TREE: "#3d6b32",
  SHRUB: "#5A8240",
  OTHER: "#A07640",
};

const SUN_CYCLE: SunLevel[] = ["FULL_SUN", "PARTIAL_SUN", "PARTIAL_SHADE", "FULL_SHADE"];
const SUN_LABEL: Record<string, string> = {
  FULL_SUN: "☀️", PARTIAL_SUN: "⛅", PARTIAL_SHADE: "🌥️", FULL_SHADE: "☁️",
};
const SUN_BG: Record<string, string> = {
  FULL_SUN: "#FEF9C3", PARTIAL_SUN: "#FEF3C7", PARTIAL_SHADE: "#E0F2FE", FULL_SHADE: "#F1F5F9",
};

// Vertical overhead: grid padding top+bottom (28px) + centering py-3 top+bottom (24px) = 52px
const FRAME_PAD = 52;

type Plant = { id: string; name: string; category: string; imageUrl: string | null; daysToMaturity: number | null; spacingInches: number | null };
type Planting = {
  id: string;
  status: PlantingStatus;
  plant: Plant;
  plantedDate: Date | null;
  transplantDate: Date | null;
  expectedHarvestDate: Date | null;
  variety: string | null;
  notes: string | null;
};
type CellData = {
  id: string;
  row: number;
  col: number;
  sunLevel: SunLevel;
  /** Set only on the anchor (primary) cell of a planting. */
  planting: Planting | null;
  /** Set when this cell is a non-anchor footprint cell of a multi-cell
   *  planting. Renders the same status color as the anchor but no label,
   *  and routes clicks to the anchor's detail panel. */
  footprint: { plantingId: string; primaryCellId: string; status: PlantingStatus } | null;
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
  prefillPlant?: Plant | null;
};
type PanelState =
  | { type: "none" }
  | { type: "picker"; cellId: string }
  | { type: "bulk-picker"; cellIds: string[] }
  | { type: "detail"; planting: Planting; cell: CellData }
  | { type: "smart-layout" };

// Internal cell tile — owns the per-cell DnD wiring so each cell can be both
// a drop target (for plants being placed) and a drag source (for moving an
// existing planting to a new cell). React hooks can't be called inside a
// .map(), which is why this is its own component rather than inline.
function CellTile({
  cell,
  cellPx,
  dense,
  effectiveStatus,
  isAnchor,
  isFootprintOnly,
  sunMode,
  sun,
  selectMode,
  isSelectedForBulk,
  preview,
  isSelected,
  isNew,
  isHoveredByPlanner,
  hasHarmful,
  hasBeneficial,
  onClick,
}: {
  cell: CellData;
  cellPx: number;
  dense: boolean;
  effectiveStatus: PlantingStatus | null;
  isAnchor: boolean;
  isFootprintOnly: boolean;
  sunMode: boolean;
  sun: SunLevel;
  selectMode: boolean;
  isSelectedForBulk: boolean;
  preview: LayoutAssignment | undefined;
  isSelected: boolean;
  isNew: boolean;
  isHoveredByPlanner: boolean;
  hasHarmful: boolean;
  hasBeneficial: boolean;
  onClick: () => void;
}) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop:${cell.id}`,
    data: { kind: "cell", cell },
    disabled: !!cell.planting || !!cell.footprint,
  });
  const drag = useDraggable({
    id: `drag:${cell.id}`,
    data: cell.planting
      ? {
          kind: "planting",
          plantingId: cell.planting.id,
          plantName: cell.planting.plant.name,
          fromCellId: cell.id,
        }
      : undefined,
    disabled: !cell.planting,
  });

  function setRef(node: HTMLDivElement | null) {
    setDropRef(node);
    drag.setNodeRef(node);
  }

  const cellStyle = effectiveStatus ? CELL_STYLE[effectiveStatus] : null;
  const labelSize = Math.max(7, Math.min(10, cellPx * 0.18));
  const badgePx = 13;

  // Empty cells are translucent paper so the bed's soil texture shows
  // through. Planted cells use the existing status tint. Drop-hover
  // highlights sage to confirm a valid drop target.
  const cellBg = sunMode
    ? SUN_BG[sun]
    : cellStyle
    ? cellStyle.bg
    : preview
    ? "rgba(228,240,212,0.6)"
    : isOver
    ? "rgba(168,216,112,0.35)"
    : "rgba(253,253,248,0.55)";

  const cellBorder = sunMode
    ? "rgba(28,61,10,0.1)"
    : cellStyle
    ? cellStyle.border
    : preview
    ? "rgba(28,61,10,0.15)"
    : isOver
    ? "#7DA84E"
    : "rgba(168,216,112,0.22)";

  const cellBoxShadow = isHoveredByPlanner
    ? "inset 0 0 0 2px #D4820A, 0 2px 8px rgba(196,121,10,0.3)"
    : isSelected
    ? "inset 0 0 0 2px #1C3D0A, 0 2px 8px rgba(28,61,10,0.15)"
    : isOver
    ? "inset 0 0 0 2px #7DA84E, 0 2px 8px rgba(125,168,78,0.25)"
    : isAnchor
    ? "0 1px 3px rgba(28,61,10,0.08)"
    : "none";

  const dragProps = isAnchor ? { ...drag.attributes, ...drag.listeners } : {};

  return (
    <div
      ref={setRef}
      {...dragProps}
      onClick={onClick}
      className={`relative flex items-end justify-center select-none transition-all duration-150 ${
        isNew ? "scale-110 z-10" : "scale-100"
      }`}
      style={{
        width: cellPx,
        height: cellPx,
        background: cellBg,
        border: `1.5px solid ${cellBorder}`,
        borderRadius: "8px",
        borderStyle: preview && !isAnchor ? "dashed" : "solid",
        boxShadow: cellBoxShadow,
        opacity: drag.isDragging ? 0.35 : 1,
        cursor: isAnchor ? (drag.isDragging ? "grabbing" : "grab") : "pointer",
      }}
    >
      {sunMode && (
        <span
          className="absolute inset-0 flex items-center justify-center leading-none"
          style={{ fontSize: Math.max(10, cellPx * 0.45) }}
        >
          {SUN_LABEL[sun]}
        </span>
      )}
      {selectMode && isSelectedForBulk && (
        <span className="absolute inset-0 flex items-center justify-center bg-[#1C3D0A]/15 rounded-lg">
          <span
            className="rounded-full bg-[#1C3D0A] text-white flex items-center justify-center shadow"
            style={{ width: Math.max(14, cellPx * 0.42), height: Math.max(14, cellPx * 0.42) }}
          >
            <Check
              style={{ width: Math.max(8, cellPx * 0.25), height: Math.max(8, cellPx * 0.25) }}
              strokeWidth={3}
            />
          </span>
        </span>
      )}
      {!isAnchor && !isFootprintOnly && !preview && !sunMode && (
        <span
          className="absolute inset-0 flex items-center justify-center leading-none select-none pointer-events-none"
          style={{ fontSize: Math.max(14, cellPx * 0.32), color: "rgba(168,216,112,0.45)" }}
        >
          +
        </span>
      )}
      {/* Category-colored disc — adds the rich visual weight that matches
          the 2D garden view and dashboard preview. Anchor cell shows a
          bold disc; footprint cells (no anchor planting) show a softer
          one with the same color. */}
      {(isAnchor || isFootprintOnly) && !sunMode && (
        <div
          aria-hidden
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div
            style={{
              width: cellPx * 0.55,
              height: cellPx * 0.55,
              borderRadius: "50%",
              background:
                CATEGORY_COLOR[cell.planting?.plant.category ?? "OTHER"] ?? "#A07640",
              opacity: isAnchor ? 0.85 : 0.45,
              boxShadow: isAnchor ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
            }}
          />
        </div>
      )}
      {isAnchor && cell.planting && !sunMode && !dense && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center pb-1 px-0.5 gap-0.5 pointer-events-none">
          <div
            style={{
              width: "5px",
              height: "5px",
              borderRadius: "50%",
              background: STATUS_DOT_COLOR[cell.planting.status] ?? "#ADADAA",
              flexShrink: 0,
              boxShadow: "0 0 0 1.5px rgba(253,253,248,0.85)",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              color: "#1C3D0A",
              fontSize: labelSize,
              lineHeight: 1.1,
              textAlign: "center",
              textShadow: "0 1px 0 rgba(253,253,248,0.7)",
            }}
          >
            {cell.planting.plant.name.split(" ")[0]}
          </span>
        </div>
      )}
      {isAnchor && cell.planting && !sunMode && dense && (
        <span
          className="absolute inset-0 flex items-center justify-center font-bold select-none pointer-events-none"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: Math.max(7, cellPx * 0.28),
            color: "#3A3A30",
          }}
          title={cell.planting.plant.name}
        >
          {cell.planting.plant.name.slice(0, Math.max(1, Math.floor(cellPx / 14)))}
        </span>
      )}
      {preview && !isAnchor && !sunMode && !dense && (
        <div className="absolute inset-x-0 bottom-0 pb-1 px-0.5 pointer-events-none">
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontStyle: "italic",
              color: "#1C3D0A",
              fontSize: Math.max(8, labelSize - 1),
              textAlign: "center",
              display: "block",
              lineHeight: 1.1,
            }}
          >
            {preview.plantName.split(" ")[0]}
          </span>
        </div>
      )}
      {!sunMode && isAnchor && (hasHarmful || hasBeneficial) && (
        <span
          className="absolute top-1 right-1 rounded-full ring-[1.5px] ring-white shadow-sm pointer-events-none"
          style={{
            width: badgePx,
            height: badgePx,
            background: hasHarmful ? "#7A2A18" : "#3A6B20",
          }}
        />
      )}
      {!sunMode && (
        <div
          className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-100 pointer-events-none"
          style={{ boxShadow: "inset 0 0 0 2px rgba(28,61,10,0.35)", borderRadius: "8px" }}
        />
      )}
    </div>
  );
}

export function BedGrid({ bedId, gardenId, gridCols, gridRows, cellSizeIn, cells, seasonId, userId, recentPlants, isPro, prefillPlant }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [panel, setPanel] = useState<PanelState>({ type: "none" });
  const [activeTab, setActiveTab] = useState<"plant" | "sun" | "companions" | "smart" | "select">("plant");
  const sunMode = activeTab === "sun";
  const selectMode = activeTab === "select";
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  // Move-mode state: when set, the next empty-cell tap relocates this
  // planting instead of opening the picker. Triggered from the Move
  // button in CellDetail.
  const [movingPlanting, setMovingPlanting] = useState<{ id: string; plantName: string } | null>(null);
  const [isMoving, startMove] = useTransition();
  const [, startSunUpdate] = useTransition();
  const [, startPrefillAssign] = useTransition();
  const [pendingSun, setPendingSun] = useState<Record<string, SunLevel>>({});
  const [previewAssignments, setPreviewAssignments] = useState<LayoutAssignment[]>([]);
  const [justPlanted, setJustPlanted] = useState<Set<string>>(new Set());
  const [pendingPlant, setPendingPlant] = useState<Plant | null>(prefillPlant ?? null);
  // How many plantings have been placed during this prefill session.
  // Drives the "3 Cherry Tomatoes planted" banner subtitle and resets
  // whenever a new prefill starts (via plant change) or is dismissed.
  const [prefillPlacedCount, setPrefillPlacedCount] = useState(0);

  function clearPrefill() {
    setPendingPlant(null);
    setPrefillPlacedCount(0);
    router.replace(pathname, { scroll: false });
  }

  // Rotation is now manual-only via the toolbar button — beds render in
  // their stored orientation (gridCols × gridRows) so a 2×8 bed reads as
  // 2 wide × 8 tall, matching reality and the dashboard preview.
  const [rotated, setRotated] = useState(false);
  const [zoom, setZoom] = useState(1);

  // Measure the scrollable viewport width for horizontal cell fitting.
  // Start at 360 (conservative mobile estimate) so the first render is close to
  // the real size and ResizeObserver only makes one small correction.
  const viewportRef = useRef<HTMLDivElement>(null);
  const [vpW, setVpW] = useState(360);

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
  const [mobileViewportH, setMobileViewportH] = useState(600);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    // header h-14 (56) + main pb-24 (96) + pt-10 (40) + page-header+mb-6 (68)
    // + toolbar (40) + gap-6×2 (48) + legend (20) + pb-4 (16) = 384px → use 396 for safety
    // Cap at 420 so cells don't grow huge on large monitors.
    const update = () => {
      const mobile = window.innerWidth < 768;
      setMaxViewportH(Math.max(200, Math.min(window.innerHeight - 396, 420)));
      setMobileViewportH(Math.max(200, window.innerHeight - 300));
      setIsMobile(mobile);
    };
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
  // Mobile: fit exactly to viewport width accounting for grid's actual horizontal padding
  //   (16px left + 16px right = 32px) + gaps ((cols-1) × 4px). No height cap — page scrolls.
  // Desktop: cells size to a height target. With the bed column now sizing
  //   to its content, measuring viewport width creates a feedback loop
  //   (cell size depends on width which depends on cell size). Height target
  //   sidesteps that — the bed grows to whatever the viewport height allows.
  const rowGaps = (displayRows - 1) * 4;
  const colGaps = (displayCols - 1) * 4;
  const fitByH = Math.floor((maxViewportH - FRAME_PAD - rowGaps) / displayRows);
  const targetByH = Math.min(300, Math.floor((maxViewportH * 0.95 - FRAME_PAD - rowGaps) / displayRows));
  const mobileFitByW = Math.floor((vpW - 32 - colGaps) / displayCols);
  // 52 = grid padding 28px (14px top + 14px bottom) + flex centering py-3 (24px)
  const mobileFitByH = Math.floor((mobileViewportH - 52 - (displayRows - 1) * 4) / displayRows);
  const baseCellPx = isMobile
    ? Math.max(28, Math.min(mobileFitByW, mobileFitByH))
    : Math.max(20, Math.min(fitByH, targetByH));
  const cellPx = Math.max(20, Math.round(baseCellPx * zoom));

  // Dense mode: hide labels when cells are too small to read them
  const dense = cellPx < 36;

  function handleCellClick(cell: CellData) {
    // Move flow takes precedence over everything else — the user has
    // committed to relocating this planting, so don't sidetrack into
    // pickers or selection toggles.
    if (movingPlanting) {
      // Guard against double-taps while the previous move is still
      // round-tripping. Without this, two fast taps fire two concurrent
      // movePlanting calls; the second wins, the first is silently
      // erased, and the grid flickers between states.
      if (isMoving) return;
      if (cell.planting?.id === movingPlanting.id || cell.footprint?.plantingId === movingPlanting.id) {
        // Tapped one of its own current cells — silently cancel as no-op.
        toast.info("That's where it currently is");
        return;
      }
      if (cell.planting || cell.footprint) {
        toast.error("That cell is occupied. Pick an empty one.");
        return;
      }
      const target = cell;
      const mv = movingPlanting;
      startMove(async () => {
        try {
          const result = await movePlanting(mv.id, target.id);
          handlePlanted(target.id);
          if (result.footprintWarning) {
            toast.warning(result.footprintWarning, { duration: 5000 });
          } else {
            toast.success(`Moved ${mv.plantName}`);
          }
          setMovingPlanting(null);
        } catch (err) {
          console.error(err);
          toast.error(err instanceof Error ? err.message : "Couldn't move — please try again");
        }
      });
      return;
    }
    if (selectMode) {
      // Bulk-select mode: tapping toggles cell selection. Only empty cells
      // are selectable — already-planted or footprint cells get a no-op
      // (we don't bulk-replace plantings; that needs a more deliberate UX).
      if (cell.planting || cell.footprint) {
        toast.info("Cell is already occupied", { duration: 1500 });
        return;
      }
      setSelectedCells((prev) => {
        const next = new Set(prev);
        if (next.has(cell.id)) next.delete(cell.id);
        else next.add(cell.id);
        return next;
      });
      return;
    }
    if (sunMode) {
      const current = pendingSun[cell.id] ?? cell.sunLevel;
      const next = SUN_CYCLE[(SUN_CYCLE.indexOf(current) + 1) % SUN_CYCLE.length];
      setPendingSun((prev) => ({ ...prev, [cell.id]: next }));
      startSunUpdate(async () => { await updateCellSun(cell.id, next); });
      return;
    }
    if (cell.planting) {
      setPanel({ type: "detail", planting: cell.planting, cell });
      return;
    }
    // Footprint cell: tapping a non-anchor cell of a multi-cell planting
    // opens the same detail panel the anchor would.
    if (cell.footprint) {
      const anchor = cells.find((c) => c.id === cell.footprint!.primaryCellId);
      if (anchor?.planting) {
        setPanel({ type: "detail", planting: anchor.planting, cell: anchor });
      }
      return;
    }
    // Guard: planting requires an active season. Without one, the picker
    // would silently fail server-side or save a planting with no season.
    if (!seasonId) {
      toast.error("Create an active season first", {
        description: "Plantings are tracked by season — head to Seasons to start one.",
      });
      return;
    }
    // Prefill flow: user arrived from a plant detail page with ?plant=ID
    // and we already know what they want to plant. Skip the picker. The
    // prefill stays active after each successful placement so the user
    // can plant the same plant in multiple cells without re-picking. The
    // banner X button is the only way out.
    if (pendingPlant) {
      const plant = pendingPlant;
      startPrefillAssign(async () => {
        try {
          const result = await assignPlant(cell.id, plant.id, seasonId);
          handlePlanted(cell.id);
          setPrefillPlacedCount((c) => c + 1);
          if (result.footprintWarning) {
            toast.warning(result.footprintWarning, { duration: 5000 });
          } else {
            toast.success(`Planted ${plant.name}`);
          }
        } catch (err) {
          console.error(err);
          toast.error("Couldn't plant — please try again");
        }
      });
      return;
    }
    setPanel({ type: "picker", cellId: cell.id });
  }

  function handlePlanted(cellId: string) {
    setJustPlanted((prev) => new Set([...prev, cellId]));
    setTimeout(() => setJustPlanted((prev) => { const n = new Set(prev); n.delete(cellId); return n; }), 600);
  }

  function effectiveSun(cell: CellData): SunLevel {
    return pendingSun[cell.id] ?? cell.sunLevel;
  }

  const showPanel =
    (activeTab === "plant" && panel.type !== "none") ||
    activeTab === "smart" ||
    activeTab === "companions" ||
    (activeTab === "select" && panel.type === "bulk-picker");

  // On mobile the picker/detail panel slides in BELOW the grid, which is
  // easy to miss if the grid pushes it offscreen. Scroll it into view
  // once the panel opens so the tap visibly "did something."
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showPanel || !isMobile || !panelRef.current) return;
    // Wait a beat so the panel has started its 300ms expand transition
    // — scrollIntoView on a collapsed (max-height 0) element jumps to
    // the wrong place.
    const t = setTimeout(() => {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);
    return () => clearTimeout(t);
  }, [showPanel, isMobile, panel.type]);
  const canRotate = gridRows !== gridCols;
  const isEmpty = cells.every((c) => !c.planting);

  // For filtered legend and smart-layout highlight
  const presentStatuses = new Set(
    cells.map((c) => c.planting?.status).filter(Boolean) as PlantingStatus[]
  );
  const hasAnyWarnings = cells.some((c) => c.warnings.length > 0);
  const [hoveredAssignment, setHoveredAssignment] = useState<{ row: number; col: number } | null>(null);

  const btnBase = "flex items-center justify-center w-8 h-8 rounded-lg text-sm font-medium transition-all duration-200 bg-[#F4F4EC] text-[#6B6B5A] hover:bg-[#EAEADE] hover:text-[#111109]";

  // ── Drag-and-drop wiring ───────────────────────────────────────────────────
  type DragSource =
    | { kind: "plant"; plant: LibraryPlant }
    | { kind: "planting"; plantingId: string; plantName: string; fromCellId: string };

  const [dragSource, setDragSource] = useState<DragSource | null>(null);

  // PointerSensor with a 4px activation distance prevents the mouse-down on
  // an empty cell from being interpreted as a drag — keeps clicks working.
  // TouchSensor uses a small delay so quick taps don't start a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } })
  );

  function onDragStart(e: DragStartEvent) {
    const data = e.active.data.current;
    if (!data) return;
    if (data.kind === "plant") setDragSource({ kind: "plant", plant: data.plant });
    else if (data.kind === "planting") setDragSource({
      kind: "planting",
      plantingId: data.plantingId,
      plantName: data.plantName,
      fromCellId: data.fromCellId,
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const source = dragSource;
    setDragSource(null);
    if (!source || !e.over) return;
    const overData = e.over.data.current;
    if (!overData || overData.kind !== "cell") return;
    const targetCell = overData.cell as CellData;

    if (source.kind === "plant") {
      if (!seasonId) {
        toast.error("Create an active season first");
        return;
      }
      if (targetCell.planting || targetCell.footprint) {
        toast.error("That cell is already occupied");
        return;
      }
      const plant = source.plant;
      startPrefillAssign(async () => {
        try {
          const result = await assignPlant(targetCell.id, plant.id, seasonId);
          handlePlanted(targetCell.id);
          if (result.footprintWarning) toast.warning(result.footprintWarning, { duration: 5000 });
          else toast.success(`Planted ${plant.name}`);
        } catch (err) {
          console.error(err);
          toast.error(err instanceof Error ? err.message : "Couldn't plant — please try again");
        }
      });
      return;
    }

    if (source.kind === "planting") {
      if (targetCell.id === source.fromCellId) return;
      if (targetCell.planting || targetCell.footprint) {
        toast.error("That cell is already occupied");
        return;
      }
      const pid = source.plantingId;
      const name = source.plantName;
      const targetId = targetCell.id;
      startMove(async () => {
        try {
          const result = await movePlanting(pid, targetId);
          handlePlanted(targetId);
          if (result.footprintWarning) toast.warning(result.footprintWarning, { duration: 5000 });
          else toast.success(`Moved ${name}`);
        } catch (err) {
          console.error(err);
          toast.error(err instanceof Error ? err.message : "Couldn't move — please try again");
        }
      });
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
    <div className="flex flex-col">
      {/* Move-mode banner — set from the CellDetail Move button. The
          next empty-cell tap relocates the planting. */}
      {movingPlanting && (
        <div
          className="flex items-center gap-3 px-[22px] md:px-8 py-3"
          style={{
            background: "#FFF3E8",
            borderBottom: "1px solid rgba(212,130,10,0.25)",
          }}
        >
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center border border-[rgba(212,130,10,0.25)] shrink-0">
            <Move className="w-4 h-4 text-[#D4820A]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#7A4A0A]">
              Tap an empty cell to move <span className="italic">{movingPlanting.plantName}</span>
            </p>
            <p className="text-xs text-[#A06010] mt-0.5">
              Footprint and current cells move together. Tap × to cancel.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMovingPlanting(null)}
            className="w-7 h-7 rounded-md hover:bg-white/60 flex items-center justify-center text-[#A06010]"
            aria-label="Cancel move"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Prefill banner — shown when user arrived from plant detail page */}
      {pendingPlant && (
        <div
          className="flex items-center gap-3 px-[22px] md:px-8 py-3"
          style={{
            background: "#E4F0D4",
            borderBottom: "1px solid #D4E8BE",
          }}
        >
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center border border-[#D4E8BE] shrink-0">
            <Sprout className="w-4 h-4 text-[#1C3D0A]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#1C3D0A]">
              {prefillPlacedCount === 0
                ? <>Tap any empty cell to plant <span className="italic">{pendingPlant.name}</span></>
                : <>Keep tapping to plant more <span className="italic">{pendingPlant.name}</span></>}
            </p>
            <p className="text-xs text-[#3A6B20] mt-0.5">
              {prefillPlacedCount === 0
                ? "We'll add it to each cell you tap. Tap × to stop."
                : `${prefillPlacedCount} planted so far — tap × when done.`}
            </p>
          </div>
          <button
            type="button"
            onClick={clearPrefill}
            className="w-7 h-7 rounded-md hover:bg-white/60 flex items-center justify-center text-[#3A6B20]"
            aria-label="Done"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Canvas toolbar — zoom/rotate only. Tabs moved into the sidebar. */}
      <div style={{ borderBottom: "1px solid #E4E4DC", background: "#FDFDF8" }}>
        <div className="flex items-center justify-end gap-1 px-[22px] md:px-8 py-2">
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#ADADAA",
              marginRight: "auto",
            }}
          >
            {gridCols} × {gridRows} grid · {cellSizeIn}&quot; cells
          </span>
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

      <div className="flex flex-col md:flex-row gap-6 items-stretch md:items-start md:justify-center" style={{ marginTop: "20px" }}>
        {/* Stats panel — fills the left whitespace with useful chrome. */}
        {(() => {
          const totalCells = gridCols * gridRows;
          const filledCells = cells.filter((c) => c.planting || c.footprint).length;
          const fillPct = totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0;
          const plantSummary: Record<string, { name: string; category: string; count: number }> = {};
          for (const c of cells) {
            if (!c.planting) continue;
            const key = c.planting.plant.id;
            if (!plantSummary[key]) {
              plantSummary[key] = {
                name: c.planting.plant.name,
                category: c.planting.plant.category,
                count: 0,
              };
            }
            plantSummary[key].count += 1;
          }
          const plantList = Object.values(plantSummary).sort((a, b) => b.count - a.count);
          return (
            <aside className="w-full md:w-[240px] md:shrink-0 hidden md:block">
              <div
                className="rounded-xl border shadow-sm"
                style={{ background: "#FDFDF8", borderColor: "#E4E4DC" }}
              >
                <div className="px-5 pt-4 pb-3" style={{ borderBottom: "1px solid #F4F4EC" }}>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      letterSpacing: "0.2em",
                      textTransform: "uppercase",
                      color: "#7DA84E",
                      marginBottom: 6,
                    }}
                  >
                    Bed stats
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 32,
                        fontWeight: 800,
                        color: "#111109",
                        letterSpacing: "-0.025em",
                        lineHeight: 1,
                      }}
                    >
                      {filledCells}
                    </span>
                    <span style={{ fontSize: 13, color: "#6B6B5A" }}>/ {totalCells} cells</span>
                  </div>
                  <div
                    className="mt-3 rounded-full overflow-hidden"
                    style={{ height: 6, background: "#F4F4EC" }}
                  >
                    <div
                      style={{
                        width: `${fillPct}%`,
                        height: "100%",
                        background: "linear-gradient(90deg, #3A6B20, #7DA84E)",
                        transition: "width 0.4s",
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#ADADAA" }}>
                      {fillPct}% planted
                    </span>
                    {filledCells > 0 && (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#ADADAA" }}>
                        {totalCells - filledCells} open
                      </span>
                    )}
                  </div>
                </div>

                <div className="px-5 py-4">
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      color: "#ADADAA",
                      marginBottom: 8,
                    }}
                  >
                    Planted
                  </div>
                  {plantList.length === 0 ? (
                    <p style={{ fontSize: 12, color: "#ADADAA", fontStyle: "italic" }}>
                      Drag a plant onto the bed to get started.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {plantList.map((p) => (
                        <div
                          key={p.name}
                          className="flex items-center gap-2"
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: CATEGORY_COLOR[p.category] ?? CATEGORY_COLOR.OTHER,
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              fontFamily: "var(--font-display)",
                              fontWeight: 700,
                              fontSize: 13,
                              color: "#111109",
                              flex: 1,
                              minWidth: 0,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {p.name}
                          </span>
                          <span
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 10,
                              color: "#6B6B5A",
                              fontWeight: 500,
                            }}
                          >
                            ×{p.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </aside>
          );
        })()}
        {/* Bed column — size-to-content so the bed and sidebar sit as a
            visually related pair instead of the bed floating in a wide
            empty column. */}
        <div className="flex flex-col gap-6 md:shrink-0">
          {/* Viewport: desktop caps height + scrolls; mobile flows naturally so page scrolls */}
          <div
            ref={viewportRef}
            className={`rounded-2xl relative ${isMobile ? "overflow-hidden" : "overflow-auto"}`}
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
              {/* Wood-framed soil bed — matches the dashboard preview and
                  2D garden view so the editor's bed speaks the same visual
                  language. Outer warm wood ring, dotted soil interior. */}
              <div
                className="shrink-0"
                style={{
                  // Subtle dotted soil pattern (browns) overlaid on a deep
                  // soil background — same vocabulary used in the 2D view.
                  backgroundImage:
                    "radial-gradient(rgba(36,21,16,0.45) 1px, transparent 1.5px), radial-gradient(rgba(74,50,32,0.55) 1px, transparent 1.5px)",
                  backgroundSize: "14px 14px, 22px 22px",
                  backgroundPosition: "0 0, 7px 11px",
                  backgroundColor: "#3a2818",
                  borderRadius: "12px",
                  // Outer wood frame: warm rim with a darker inner shadow
                  // so the bed reads as 3D-ish.
                  border: "6px solid #C49458",
                  outline: "1px solid #7D5630",
                  boxShadow:
                    "inset 0 0 0 2px rgba(122,75,40,0.4), 0 4px 18px -6px rgba(28,18,10,0.35)",
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
                      const planting = cell.planting;
                      const footprintStatus = cell.footprint?.status ?? null;
                      const effectiveStatus = planting?.status ?? footprintStatus;
                      const isFootprintOnly = !planting && !!footprintStatus;
                      const isSelected =
                        (panel.type === "picker" && panel.cellId === cell.id) ||
                        (panel.type === "detail" && panel.cell.id === cell.id);
                      const preview = previewAssignments.find(
                        (a) => a.row === cell.row && a.col === cell.col
                      );
                      return (
                        <CellTile
                          key={cell.id}
                          cell={cell}
                          cellPx={cellPx}
                          dense={dense}
                          effectiveStatus={effectiveStatus}
                          isAnchor={!!planting}
                          isFootprintOnly={isFootprintOnly}
                          sunMode={sunMode}
                          sun={effectiveSun(cell)}
                          selectMode={selectMode}
                          isSelectedForBulk={selectedCells.has(cell.id)}
                          preview={preview}
                          isSelected={isSelected}
                          isNew={justPlanted.has(cell.id)}
                          isHoveredByPlanner={
                            hoveredAssignment?.row === cell.row &&
                            hoveredAssignment?.col === cell.col
                          }
                          hasHarmful={cell.warnings.some((w) => w.type === "HARMFUL")}
                          hasBeneficial={cell.warnings.some((w) => w.type === "BENEFICIAL")}
                          onClick={() => handleCellClick(cell)}
                        />
                      );
                    })}
                  </div>
              </div>
            </div>
          </div>

          {/* Multi-select action bar — replaces the legend in select mode. */}
          {selectMode ? (
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border bg-white shadow-sm" style={{ borderColor: "#E4E4DC" }}>
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-md bg-[#F4F4EC] flex items-center justify-center shrink-0">
                  <CheckSquare className="w-4 h-4 text-[#1C3D0A]" />
                </div>
                <p className="text-sm text-[#111109]">
                  {selectedCells.size === 0 ? (
                    <span className="text-[#6B6B5A]">Tap empty cells to select them</span>
                  ) : (
                    <><span className="font-semibold">{selectedCells.size}</span> cell{selectedCells.size === 1 ? "" : "s"} selected</>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {selectedCells.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedCells(new Set())}
                    className="px-3 py-1.5 text-xs font-medium text-[#6B6B5A] hover:text-[#111109] rounded-md hover:bg-[#F4F4EC] transition-colors"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  disabled={selectedCells.size === 0 || !seasonId}
                  onClick={() => {
                    if (!seasonId) {
                      toast.error("Create an active season first");
                      return;
                    }
                    setPanel({ type: "bulk-picker", cellIds: Array.from(selectedCells) });
                  }}
                  className="px-4 py-1.5 text-xs font-semibold rounded-md bg-[#1C3D0A] text-white hover:bg-[#3d6b1e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Plant in {selectedCells.size || "selected"}
                </button>
              </div>
            </div>
          ) : null}

          {/* Legend — only show statuses present in this bed */}
          {!sunMode && !selectMode && (
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

        {/* Sidebar — always visible. Holds the mode switcher (top), the
            mode-specific content, and contextual cell detail. */}
        <div
          ref={panelRef}
          className="w-full md:w-[340px] md:shrink-0 flex flex-col"
        >
          <div
            className="rounded-xl border shadow-md overflow-hidden flex flex-col"
            style={{ background: "#FDFDF8", borderColor: "#E4E4DC", maxHeight: isMobile ? undefined : maxViewportH + 40 }}
          >
            {/* Mode switcher — icon row */}
            <div
              className="flex items-stretch border-b shrink-0"
              style={{ background: "#F8F8F2", borderColor: "#E4E4DC" }}
            >
              {(["plant", "sun", "companions", "smart", "select"] as const).map((tab) => {
                const ICON: Record<string, React.ReactNode> = {
                  plant: <Leaf className="w-4 h-4" />,
                  sun: <Sun className="w-4 h-4" />,
                  companions: <Sprout className="w-4 h-4" />,
                  smart: <Sparkles className="w-4 h-4" />,
                  select: <MousePointer2 className="w-4 h-4" />,
                };
                const LABEL: Record<string, string> = {
                  plant: "Plant",
                  sun: "Sun",
                  companions: "Pairs",
                  smart: "AI",
                  select: "Select",
                };
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab);
                      if (tab !== "plant") setPanel({ type: "none" });
                      if (tab !== "select") setSelectedCells(new Set());
                    }}
                    className="flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors"
                    style={{
                      background: isActive ? "#FDFDF8" : "transparent",
                      color: isActive ? "#1C3D0A" : "#6B6B5A",
                      fontFamily: "var(--font-mono)",
                      fontSize: "9px",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      fontWeight: isActive ? 600 : 500,
                      borderTop: isActive ? "2px solid #1C3D0A" : "2px solid transparent",
                      borderBottom: isActive ? "2px solid transparent" : "2px solid #E4E4DC",
                      cursor: "pointer",
                    }}
                    aria-pressed={isActive}
                  >
                    {ICON[tab]}
                    <span>{LABEL[tab]}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto" style={{ maxHeight: 640 }}>
              {/* PLANT MODE: always-visible library, plus detail panel when a cell with a planting is selected */}
              {activeTab === "plant" && panel.type !== "detail" && panel.type !== "picker" && (
                <PlantLibrary
                  recentPlants={recentPlants}
                  cellSizeIn={cellSizeIn}
                  userId={userId}
                  onCardClick={(p) => setPendingPlant(p)}
                  selectedPlantId={pendingPlant?.id ?? null}
                />
              )}
              {activeTab === "plant" && panel.type === "picker" && (
                <div className="p-4">
                  <PlantPicker
                    cellId={panel.cellId}
                    seasonId={seasonId}
                    userId={userId}
                    cellSizeIn={cellSizeIn}
                    recentPlants={recentPlants}
                    onClose={() => setPanel({ type: "none" })}
                    onPlanted={(id) => handlePlanted(id)}
                  />
                </div>
              )}
              {activeTab === "plant" && panel.type === "detail" && (
                <CellDetail
                  planting={{ ...panel.planting, cell: { row: panel.cell.row, col: panel.cell.col } }}
                  warnings={panel.cell.warnings}
                  gardenId={gardenId}
                  bedId={bedId}
                  onClose={() => setPanel({ type: "none" })}
                  onMoveStart={(p) => setMovingPlanting(p)}
                />
              )}

              {/* SUN MODE */}
              {activeTab === "sun" && (
                <div className="p-5 space-y-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "#FEF9C3" }}
                  >
                    <Sun className="w-5 h-5" style={{ color: "#A36207" }} />
                  </div>
                  <p className="text-sm font-semibold" style={{ color: "#111109" }}>Sun map</p>
                  <p className="text-xs leading-relaxed" style={{ color: "#6B6B5A" }}>
                    Tap any cell to cycle its sun level. Use this to map shadows from fences, trees, or the house so plant suggestions match each spot&apos;s reality.
                  </p>
                  <div className="space-y-1.5 pt-2">
                    {Object.entries(SUN_LABEL).map(([key, emoji]) => (
                      <div key={key} className="flex items-center gap-2 text-xs">
                        <span style={{ width: 22, height: 22, borderRadius: 6, background: SUN_BG[key], display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                          {emoji}
                        </span>
                        <span style={{ color: "#3A3A30" }}>
                          {key.replace("_", " ").toLowerCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* COMPANIONS MODE */}
              {activeTab === "companions" && (
                <div className="p-4">
                  {cells.every((c) => c.warnings.length === 0) ? (
                    <div className="text-center py-10" style={{ color: "#ADADAA" }}>
                      <Sprout className="w-7 h-7 mx-auto mb-2" />
                      <p className="text-sm">No companion notes</p>
                      <p className="text-xs mt-1">Add neighbouring plants to see relationships</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {cells.filter((c) => c.warnings.length > 0 && c.planting).map((c) => (
                        <div key={c.id}>
                          <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "13px", color: "#111109", marginBottom: "6px" }}>
                            {c.planting!.plant.name}
                          </p>
                          {c.warnings.map((w, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "7px", marginBottom: "4px" }}>
                              <div
                                style={{
                                  width: "18px", height: "18px", borderRadius: "50%",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontSize: "9px", flexShrink: 0, marginTop: "1px",
                                  background: w.type === "BENEFICIAL" ? "#E4F0D4" : "#FDF2E0",
                                  color: w.type === "BENEFICIAL" ? "#1C3D0A" : "#D4820A",
                                }}
                              >
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

              {/* SMART MODE */}
              {activeTab === "smart" && (
                <div className={isPro ? "p-4" : "p-5"}>
                  {isPro ? (
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
                    <div className="text-center py-6 space-y-3">
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
                  )}
                </div>
              )}

              {/* SELECT MODE */}
              {activeTab === "select" && panel.type !== "bulk-picker" && (
                <div className="p-5 space-y-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "#F0F8E8" }}
                  >
                    <CheckSquare className="w-5 h-5" style={{ color: "#1C3D0A" }} />
                  </div>
                  <p className="text-sm font-semibold" style={{ color: "#111109" }}>Multi-select</p>
                  <p className="text-xs leading-relaxed" style={{ color: "#6B6B5A" }}>
                    Tap empty cells in the bed to select them. Then plant the same crop into all of them at once — useful for filling a row of carrots or onions.
                  </p>
                  {selectedCells.size > 0 && (
                    <p className="text-xs" style={{ color: "#1C3D0A" }}>
                      <strong>{selectedCells.size}</strong> cell{selectedCells.size === 1 ? "" : "s"} selected. Use the bar under the bed to plant.
                    </p>
                  )}
                </div>
              )}
              {activeTab === "select" && panel.type === "bulk-picker" && (
                <div className="p-4">
                  <p className="mb-3 text-xs text-[#6B6B5A]">
                    Pick a plant — it&apos;ll be added to all {panel.cellIds.length} selected cells.
                  </p>
                  <PlantPicker
                    cellIds={panel.cellIds}
                    seasonId={seasonId}
                    userId={userId}
                    cellSizeIn={cellSizeIn}
                    recentPlants={recentPlants}
                    onClose={() => {
                      setPanel({ type: "none" });
                      setSelectedCells(new Set());
                      setActiveTab("plant");
                    }}
                    onPlanted={(id) => handlePlanted(id)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    <DragOverlay dropAnimation={null}>
      {dragSource?.kind === "plant" ? (
        <div
          className="rounded-lg shadow-2xl px-3 py-2"
          style={{
            background: "#FDFDF8",
            border: "1.5px solid #7DA84E",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 13,
            color: "#1C3D0A",
            cursor: "grabbing",
          }}
        >
          {dragSource.plant.name}
        </div>
      ) : dragSource?.kind === "planting" ? (
        <div
          className="rounded-lg shadow-2xl px-3 py-2"
          style={{
            background: "#E4F0D4",
            border: "1.5px solid #3A6B20",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 13,
            color: "#1C3D0A",
            cursor: "grabbing",
          }}
        >
          ↪ {dragSource.plantName}
        </div>
      ) : null}
    </DragOverlay>
    </DndContext>
  );
}
