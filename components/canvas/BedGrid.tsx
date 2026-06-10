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
import { Sprout, X as CloseIcon, Check, CheckSquare, Move, Sun, Leaf, MousePointer2, Eye } from "lucide-react";
import type { SunLevel, PlantingStatus, PlantStartMethod } from "@/lib/generated/prisma/enums";
import type { LayoutAssignment } from "@/lib/services/smart-layout";
import type { BedFamilyHistory } from "@/lib/services/crop-rotation";
import { Sparkles, X, RotateCw, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { HelpSheet } from "@/components/help/HelpSheet";

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

// One-line descriptor for the active mode tab — always visible under the
// tab row so the 9px icon labels never have to carry the explanation alone.
const MODE_DESC_EDIT: Record<string, string> = {
  plant: "Tap an empty cell to plant it; tap a planting for its details.",
  sun: "Tap cells to cycle their sun level and map the bed's light.",
  companions: "Shows which neighbors help or harm each planting.",
  smart: "Give the AI a wishlist and it lays out the bed for you.",
  select: "Tap empty cells, then plant one crop in all of them at once.",
};
const MODE_DESC_VIEW: Record<string, string> = {
  plant: "Tap any planting to see its details.",
  sun: "Each cell's mapped sun exposure.",
  companions: "Shows which neighbors help or harm each planting.",
};

// First-visit coach mark flag — set once per browser when dismissed.
const INTRO_SEEN_KEY = "bareroot:bedEditorIntroSeen";

type Plant = { id: string; name: string; category: string; imageUrl: string | null; daysToMaturity: number | null; spacingInches: number | null; indoorStartWeeks?: number | null; transplantWeeks?: number | null; plantFamily?: string | null };
type Planting = {
  id: string;
  status: PlantingStatus;
  plant: Plant;
  plantedDate: Date | null;
  transplantDate: Date | null;
  expectedHarvestDate: Date | null;
  variety: string | null;
  notes: string | null;
  startMethod: PlantStartMethod | null;
  /** History counts (harvests/photos/notes) — drives the "removing also
   *  deletes its history" warning in CellDetail's remove confirm. */
  _count?: { harvestLogs: number; photos: number; growthNotes: number };
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
  /** Garden frost dates ("MM-DD"), for the start-method guidance in the
   *  cell detail panel. */
  frost: { lastFrostDate: string | null; firstFrostDate: string | null };
  /** False for VIEWER collaborators — renders the grid read-only: no plant
   *  picker, no drag-to-move, no sun/bulk/AI editing. Defaults to true so
   *  existing call sites are unchanged. */
  canEdit?: boolean;
  /** The user's seed inventory rows, threaded into the plant picker so each
   *  plant row can show a "have seeds" badge ("Sungold · 2 packets"). */
  seedInventory?: SeedInventoryRow[];
  /** Plant families that grew in this bed in recent past seasons — drives
   *  the placement-time crop-rotation hint (picker row + prefill toast).
   *  Warn-only; never blocks planting. */
  familyHistory?: BedFamilyHistory[];
};
type SeedInventoryRow = { plantId: string; variety: string; quantity: number; unit: string };
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
  ariaLabel,
  canEdit,
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
  ariaLabel: string;
  canEdit: boolean;
  onClick: () => void;
}) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop:${cell.id}`,
    data: { kind: "cell", cell },
    disabled: !canEdit || !!cell.planting || !!cell.footprint,
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
    disabled: !canEdit || !cell.planting,
  });

  function setRef(node: HTMLDivElement | null) {
    setDropRef(node);
    drag.setNodeRef(node);
  }

  const cellStyle = effectiveStatus ? CELL_STYLE[effectiveStatus] : null;
  const badgePx = 13;
  const isOccupied = isAnchor || isFootprintOnly;
  // The category fill for a planting is drawn as ONE block BEHIND the cells
  // (see the footprint overlay in the grid), so an occupied cell is itself
  // transparent. This guarantees a multi-cell plant is a single seamless
  // shape — no borders, rounded corners, or sub-pixel gaps between cells can
  // let the soil show through as interior seams.
  const cellBg = sunMode
    ? SUN_BG[sun]
    : isOccupied
    ? "transparent"
    : preview
    ? "rgba(228,240,212,0.6)"
    : isOver
    ? "rgba(168,216,112,0.35)"
    : "rgba(253,253,248,0.55)";

  const baseBorder = sunMode
    ? "rgba(28,61,10,0.1)"
    : isOccupied
    ? "rgba(253,253,248,0.22)"
    : cellStyle
    ? cellStyle.border
    : preview
    ? "rgba(28,61,10,0.15)"
    : isOver
    ? "#7DA84E"
    : "rgba(168,216,112,0.22)";

  // Occupied cells draw NOTHING of their own (the footprint block behind them
  // is the fill, and its selection highlight is drawn on the block as a whole).
  // A per-cell inset outline here would cut an interior line across a
  // multi-cell block — e.g. the selected anchor's inner edges. Empty/preview
  // cells still get their hover / select / drop chrome.
  const cellBoxShadow = isOccupied
    ? "none"
    : isHoveredByPlanner
    ? "inset 0 0 0 2px #D4820A, 0 2px 8px rgba(196,121,10,0.3)"
    : isSelected
    ? "inset 0 0 0 2px #1C3D0A, 0 2px 8px rgba(28,61,10,0.15)"
    : isOver
    ? "inset 0 0 0 2px #7DA84E, 0 2px 8px rgba(125,168,78,0.25)"
    : "none";

  const dragProps = isAnchor && canEdit ? { ...drag.attributes, ...drag.listeners } : {};

  // Occupied cells are transparent (the footprint block draws the fill), so
  // their own border and radius are irrelevant — only empty/preview cells
  // render their own chrome.
  const cellRadius = isOccupied ? 0 : 8;

  return (
    <div
      ref={setRef}
      {...dragProps}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          // Space would scroll the page; Enter could double-fire on buttons.
          e.preventDefault();
          onClick();
        }
      }}
      className={`relative flex items-center justify-center select-none transition-all duration-150 focus-visible:outline-2 focus-visible:outline-[#1C3D0A] focus-visible:-outline-offset-2 focus-visible:z-10 ${
        isNew ? "scale-110 z-10" : "scale-100"
      }`}
      style={{
        width: cellPx,
        height: cellPx,
        background: cellBg,
        border: isOccupied ? "none" : `1.5px solid ${baseBorder}`,
        borderStyle: preview && !isAnchor ? "dashed" : "solid",
        borderRadius: cellRadius,
        boxShadow: cellBoxShadow,
        opacity: drag.isDragging ? 0.35 : 1,
        cursor: isAnchor && canEdit ? (drag.isDragging ? "grabbing" : "grab") : "pointer",
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
      {/* "+" plantability hint — editors only; for viewers an empty cell
          isn't an invitation to plant. */}
      {canEdit && !isOccupied && !preview && !sunMode && (
        <span
          className="absolute inset-0 flex items-center justify-center leading-none select-none pointer-events-none"
          style={{ fontSize: Math.max(14, cellPx * 0.32), color: "rgba(168,216,112,0.45)" }}
        >
          +
        </span>
      )}
      {/* Plant name is no longer drawn here — it's rendered once, centered
          over the whole footprint, by the label overlay layer (see the grid
          below) so multi-cell plants read as one block with a centered name. */}
      {/* Status indicator dot — small, top-right of anchor cell so the
          italic name stays clean and centered. */}
      {isAnchor && cell.planting && !sunMode && (
        <span
          aria-hidden
          className="absolute pointer-events-none"
          style={{
            top: 4,
            right: 4,
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: STATUS_DOT_COLOR[cell.planting.status] ?? "#ADADAA",
            boxShadow: "0 0 0 1.5px rgba(253,253,248,0.7)",
          }}
        />
      )}
      {/* Preview from smart layout — italic name centered in the empty cell */}
      {preview && !isAnchor && !sunMode && (
        <span
          className="pointer-events-none px-1 text-center"
          style={{
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontWeight: 600,
            fontSize: Math.max(8, Math.min(12, cellPx * 0.24)),
            color: "#1C3D0A",
            lineHeight: 1.05,
          }}
        >
          {preview.plantName.split(" ")[0]}
        </span>
      )}
      {/* Companion-warning corner badge — only on anchor cells.
          Positioned bottom-right so it doesn't fight the status dot. */}
      {!sunMode && isAnchor && (hasHarmful || hasBeneficial) && (
        <span
          className="absolute rounded-full ring-[1.5px] ring-white shadow-sm pointer-events-none"
          style={{
            bottom: 3,
            right: 3,
            width: badgePx - 2,
            height: badgePx - 2,
            background: hasHarmful ? "#7A2A18" : "#3A6B20",
          }}
        />
      )}
      {!sunMode && !isOccupied && (
        <div
          className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-100 pointer-events-none"
          style={{ boxShadow: "inset 0 0 0 2px rgba(28,61,10,0.35)", borderRadius: "8px" }}
        />
      )}
    </div>
  );
}

export function BedGrid({ bedId, gardenId, gridCols, gridRows, cellSizeIn, cells, seasonId, userId, recentPlants, isPro, prefillPlant, frost, canEdit = true, seedInventory = [], familyHistory = [] }: Props) {
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
  // Viewers never get a prefill session — arriving with ?plant=ID in a
  // shared garden must not arm the "tap to plant" flow.
  const [pendingPlant, setPendingPlant] = useState<Plant | null>(canEdit ? prefillPlant ?? null : null);
  // Crop-rotation toast dedupe for the prefill/library placement path (which
  // bypasses PlantPicker's inline hint): warn once per plant per page view,
  // not on every cell tap while painting the same plant.
  const rotationWarnedRef = useRef<Set<string>>(new Set());
  // How many plantings have been placed during this prefill session.
  // Drives the "3 Cherry Tomatoes planted" banner subtitle and resets
  // whenever a new prefill starts (via plant change) or is dismissed.
  const [prefillPlacedCount, setPrefillPlacedCount] = useState(0);
  // After a single deliberate placement (tapping an empty cell → picker, or
  // dragging one plant from the library), auto-open the new planting's detail
  // panel so the gardener can set status / variety / dates right away instead
  // of placing a default and hunting for the menu. The new planting only
  // appears in `cells` after the server revalidates, so we stash the target
  // cell id and let an effect open the panel once its planting lands. NOT set
  // by the prefill (rapid repeat) or bulk flows — those would be interrupted.
  // The ref mirrors the state so the picker's onClose can tell "just planted"
  // (don't snap back to none — the effect is about to open detail) from a
  // plain dismiss, without waiting for a state flush.
  const [pendingDetailCellId, setPendingDetailCellId] = useState<string | null>(null);
  const pendingDetailRef = useRef<string | null>(null);
  function queueAutoOpen(cellId: string) {
    pendingDetailRef.current = cellId;
    setPendingDetailCellId(cellId);
  }

  function clearPrefill() {
    setPendingPlant(null);
    setPrefillPlacedCount(0);
    router.replace(pathname, { scroll: false });
  }

  // First-visit coach mark for the mode tabs (editors only — the copy
  // describes the five edit tools) + the help sheet it links to.
  const [showIntro, setShowIntro] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  useEffect(() => {
    if (!canEdit) return;
    try {
      if (!localStorage.getItem(INTRO_SEEN_KEY)) {
        // Intentional: localStorage is only readable client-side, so the
        // first-visit check has to run in an effect.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShowIntro(true);
      }
    } catch {
      // Private mode / storage blocked — skip the coach mark.
    }
  }, [canEdit]);
  function dismissIntro() {
    try {
      localStorage.setItem(INTRO_SEEN_KEY, "1");
    } catch {
      // Storage blocked — still hide it for this page view.
    }
    setShowIntro(false);
  }

  // Auto-rotate tall beds on desktop so the long axis runs horizontal —
  // a 2×8 bed renders as 8 wide × 2 tall, filling the canvas instead of
  // floating as a sliver in dead space. Users can still flip manually
  // via the rotate button. Mobile keeps the stored orientation since
  // rotating a tall bed sideways would overflow a phone's narrow width.
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

  // Height constraint derived from window height. We deliberately let this
  // grow up to ~640px on tall monitors so dense beds (e.g. a 4×16 grid)
  // don't get squeezed into 19px cells. Cells stay click-friendly via the
  // minimum/target clamp below — for shorter beds the bed just doesn't
  // fill the available height.
  const [maxViewportH, setMaxViewportH] = useState(560);
  const [mobileViewportH, setMobileViewportH] = useState(600);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    // header h-14 (56) + main pb-24 (96) + pt-10 (40) + page-header+mb-6 (68)
    // + toolbar (40) + gap-6×2 (48) + legend (20) + pb-4 (16) = 384px → use 396 for safety
    const update = () => {
      const mobile = window.innerWidth < 768;
      setMaxViewportH(Math.max(360, Math.min(window.innerHeight - 240, 720)));
      setMobileViewportH(Math.max(200, window.innerHeight - 300));
      setIsMobile(mobile);
    };
    update();
    // On desktop, auto-rotate tall beds (more rows than cols) to lay the
    // long axis horizontal — the v5a design language. Only fires once on
    // mount so a later manual flip via the rotate button sticks.
    if (typeof window !== "undefined" && window.innerWidth >= 768 && gridRows > gridCols) {
      setRotated(true);
    }
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

  // Per-planting footprint bounds in DISPLAY (visual) grid coordinates, derived
  // from each cell's index in displayCells (which is exactly how CSS Grid
  // auto-places them — so this is rotation-proof). Drives BOTH the single
  // category-colored block drawn behind the cells and the centered name label
  // drawn on top, so a multi-cell plant reads as one seamless block.
  const footprintBounds = (() => {
    const m = new Map<
      string,
      { minR: number; maxR: number; minC: number; maxC: number; name: string | null; variety: string | null; category: string }
    >();
    displayCells.forEach((cell, i) => {
      const pid = cell.planting?.id ?? cell.footprint?.plantingId ?? null;
      if (!pid) return;
      const r = Math.floor(i / displayCols);
      const c = i % displayCols;
      const b = m.get(pid) ?? { minR: r, maxR: r, minC: c, maxC: c, name: null, variety: null, category: "OTHER" };
      b.minR = Math.min(b.minR, r);
      b.maxR = Math.max(b.maxR, r);
      b.minC = Math.min(b.minC, c);
      b.maxC = Math.max(b.maxC, c);
      if (cell.planting) {
        b.name = cell.planting.plant.name;
        b.variety = cell.planting.variety;
        b.category = cell.planting.plant.category;
      }
      m.set(pid, b);
    });
    return [...m.entries()];
  })();

  // Auto-fit cell size:
  // Mobile: fit exactly to viewport width accounting for grid's actual horizontal padding
  //   (16px left + 16px right = 32px) + gaps ((cols-1) × 4px). No height cap — page scrolls.
  // Desktop: cells size to a height target. With the bed column now sizing
  //   to its content, measuring viewport width creates a feedback loop
  //   (cell size depends on width which depends on cell size). Height target
  //   sidesteps that — the bed grows to whatever the viewport height allows.
  // Grid gap is 0 (cells share borders so multi-cell footprints can merge
  // into one tinted block without 4px gaps cutting through them).
  const rowGaps = 0;
  const colGaps = 0;
  const fitByH = Math.floor((maxViewportH - FRAME_PAD - rowGaps) / displayRows);
  const mobileFitByW = Math.floor((vpW - 32 - colGaps) / displayCols);
  // 52 = grid padding 28px (14px top + 14px bottom) + flex centering py-3 (24px)
  const mobileFitByH = Math.floor((mobileViewportH - 52) / displayRows);

  // Desktop cell size: keep cells in the 32–56px range so they stay
  // click-friendly even on dense (16-row) beds. Below 32 the cells
  // become unreadable; above 56 wastes screen on short beds. If the
  // viewport-height fit lands inside the band, use it; otherwise clamp.
  // The viewport itself scrolls (overflow-auto + maxHeight) when the
  // bed runs taller than the available space.
  const DESKTOP_CELL_MIN = 32;
  const DESKTOP_CELL_MAX = 56;
  const desktopCellPx = Math.max(
    DESKTOP_CELL_MIN,
    Math.min(DESKTOP_CELL_MAX, fitByH)
  );
  const baseCellPx = isMobile
    ? Math.max(28, Math.min(mobileFitByW, mobileFitByH))
    : desktopCellPx;
  const cellPx = Math.max(20, Math.round(baseCellPx * zoom));

  // Dense mode: hide labels when cells are too small to read them
  const dense = cellPx < 36;

  function handleCellClick(cell: CellData) {
    // Read-only mode: viewing a planting is the point, everything else is
    // off the table. Planted/footprint cells open the (read-only) detail
    // panel; empty cells get a consistent "view only" toast; sun-map taps
    // are silent no-ops (the overlay itself is still viewable).
    if (!canEdit) {
      if (sunMode) return;
      if (cell.planting) {
        setPanel({ type: "detail", planting: cell.planting, cell });
        return;
      }
      if (cell.footprint) {
        const anchor = cells.find((c) => c.id === cell.footprint!.primaryCellId);
        if (anchor?.planting) {
          setPanel({ type: "detail", planting: anchor.planting, cell: anchor });
        }
        return;
      }
      toast.info("View only — ask the garden owner for editor access to plant", { duration: 2000 });
      return;
    }
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
          toast.error(err instanceof Error ? err.message : "Couldn't move. Please try again");
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
        description: "Plantings are tracked by season. Head to Seasons to start one.",
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
          // Placement-time rotation hint — warn, never block.
          const hist = plant.plantFamily
            ? familyHistory.find((h) => h.family === plant.plantFamily)
            : undefined;
          if (hist && !rotationWarnedRef.current.has(plant.id)) {
            rotationWarnedRef.current.add(plant.id);
            toast.warning(
              `Crop rotation: ${hist.family} (${hist.plantNames.join(", ")}) grew in this bed in ${hist.seasonName}. Consider a different family to prevent disease buildup.`,
              { duration: 6000 }
            );
          }
        } catch (err) {
          console.error(err);
          toast.error("Couldn't plant. Please try again");
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
  // Auto-open detail for a just-placed planting once it shows up in `cells`.
  useEffect(() => {
    if (!pendingDetailCellId) return;
    const c = cells.find((cell) => cell.id === pendingDetailCellId);
    if (c?.planting) {
      // Intentional: react to the new planting arriving in `cells` (after the
      // server action revalidates) by opening its panel. The guard below
      // clears the trigger so this runs once, not in a loop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPanel({ type: "detail", planting: c.planting, cell: c });
      setPendingDetailCellId(null);
      pendingDetailRef.current = null;
    }
  }, [cells, pendingDetailCellId]);

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
    // Belt-and-braces: drag sources/targets are already disabled when
    // read-only, but never mutate from a drag in view-only mode.
    if (!canEdit) return;
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
          // Single drag-drop placement → open its detail panel once it lands.
          queueAutoOpen(targetCell.id);
          if (result.footprintWarning) toast.warning(result.footprintWarning, { duration: 5000 });
          else toast.success(`Planted ${plant.name}`);
        } catch (err) {
          console.error(err);
          toast.error(err instanceof Error ? err.message : "Couldn't plant. Please try again");
        }
      });
      return;
    }

    if (source.kind === "planting") {
      // Same guard the tap-move path has: ignore a second drag while a move
      // is already in flight, so two quick drags can't fire concurrent
      // movePlanting calls and race the PlantingCell rows.
      if (isMoving) return;
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
          toast.error(err instanceof Error ? err.message : "Couldn't move. Please try again");
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
                : `${prefillPlacedCount} planted so far. Tap × when done.`}
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
              color: "#6B6B5A",
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

      <div className="flex flex-col md:flex-row gap-6 md:items-start" style={{ marginTop: "20px" }}>
        {/* Bed column — the hero. Fills the available width and centers the
            bed; the former left stats card is folded into a compact strip
            above so the bed sits centered instead of pushed to one side. */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {/* Compact stats strip (replaces the old left stats card) */}
          {(() => {
            const totalCells = gridCols * gridRows;
            const filledCells = cells.filter((c) => c.planting || c.footprint).length;
            const fillPct = totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0;
            const plantSummary: Record<string, { name: string; category: string; count: number }> = {};
            for (const c of cells) {
              if (!c.planting) continue;
              const key = c.planting.plant.id;
              if (!plantSummary[key]) plantSummary[key] = { name: c.planting.plant.name, category: c.planting.plant.category, count: 0 };
              plantSummary[key].count += 1;
            }
            const plantList = Object.values(plantSummary).sort((a, b) => b.count - a.count);
            return (
              <div className="hidden md:flex self-center items-center flex-wrap justify-center gap-x-4 gap-y-2 px-5 py-2 rounded-full border shadow-sm" style={{ background: "#FDFDF8", borderColor: "#E4E4DC" }}>
                <div className="flex items-baseline gap-1.5">
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 800, color: "#111109", letterSpacing: "-0.02em", lineHeight: 1 }}>{filledCells}</span>
                  <span style={{ fontSize: 12, color: "#6B6B5A" }}>/ {totalCells} cells</span>
                </div>
                <div className="rounded-full overflow-hidden" style={{ width: 90, height: 6, background: "#F4F4EC" }}>
                  <div style={{ width: `${fillPct}%`, height: "100%", background: "linear-gradient(90deg, #3A6B20, #7DA84E)", transition: "width 0.4s" }} />
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#6B6B5A" }}>{fillPct}% planted</span>
                {plantList.length > 0 && (
                  <>
                    <span style={{ width: 1, height: 14, background: "#E4E4DC" }} />
                    {plantList.map((p) => (
                      <div key={p.name} className="flex items-center gap-1.5">
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: CATEGORY_COLOR[p.category] ?? CATEGORY_COLOR.OTHER, flexShrink: 0 }} />
                        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, color: "#111109" }}>{p.name}</span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#6B6B5A", fontWeight: 500 }}>×{p.count}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            );
          })()}
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
                  <p className="text-sm font-semibold" style={{ color: "#111109" }}>{canEdit ? "Tap any cell" : "Nothing planted yet"}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#6B6B5A" }}>{canEdit ? "to assign a plant" : "this bed is still empty"}</p>
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
                  position: "relative",
                }}
              >
                  <div
                    className="grid"
                    role="group"
                    aria-label={`Bed grid, ${gridRows} rows by ${gridCols} columns`}
                    style={{
                      position: "relative",
                      gridTemplateColumns: `repeat(${displayCols}, ${cellPx}px)`,
                      gap: 0,
                      padding: "14px 16px",
                      background: "transparent",
                    }}
                  >
                    {/* Footprint fill — ONE category-colored block per planting,
                        spanning its whole footprint, drawn BEHIND the cells. A
                        single element can't have interior seams, so multi-cell
                        plants read as one solid rounded block; the transparent
                        cells above just handle interaction + status/labels. */}
                    {!sunMode && (
                      <div className="absolute inset-0 pointer-events-none">
                        {footprintBounds.map(([pid, b]) => {
                          const base = CATEGORY_COLOR[b.category] ?? "#A07640";
                          // Selecting a planting (detail panel open) highlights
                          // the WHOLE block, not a single cell — so a multi-cell
                          // plant never gets an interior outline cut into it.
                          const isSel = panel.type === "detail" && panel.planting.id === pid;
                          // ONE absolutely-positioned div covering the footprint's
                          // exact pixel rectangle (grid origin = 16px/14px padding,
                          // then col/row × cellPx). Pixel coverage — not grid-span
                          // trickery — guarantees a multi-cell plant is a single
                          // solid block that can't be split into per-cell pieces.
                          const cols = b.maxC - b.minC + 1;
                          const rows = b.maxR - b.minR + 1;
                          return (
                            <div
                              key={pid}
                              style={{
                                position: "absolute",
                                left: 16 + b.minC * cellPx,
                                top: 14 + b.minR * cellPx,
                                width: cols * cellPx,
                                height: rows * cellPx,
                                // Opaque so the dark soil lattice can't bleed
                                // through; a defined dark edge + raised-tile
                                // shadow separates adjacent plants — even two of
                                // the same category color.
                                background: base,
                                borderRadius: 8,
                                border: isSel
                                  ? "2px solid #14260a"
                                  : "1.5px solid rgba(28,18,10,0.45)",
                                boxShadow: isSel
                                  ? "0 0 0 3px rgba(28,61,10,0.35), inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 7px rgba(28,18,10,0.5)"
                                  : "inset 0 1px 0 rgba(255,255,255,0.15), 0 1px 3px rgba(28,18,10,0.4)",
                              }}
                            />
                          );
                        })}
                      </div>
                    )}
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
                      // Accessible name: position (logical row/col, 1-based) +
                      // occupant + state. Footprint cells borrow the anchor's
                      // plant name so every cell of a multi-cell planting
                      // announces what's growing there. Variety is included
                      // ("Tomato Sungold, active") when set.
                      const anchorPlanting =
                        planting ??
                        (cell.footprint
                          ? cells.find((c) => c.id === cell.footprint!.primaryCellId)?.planting ?? null
                          : null);
                      const occupantName = anchorPlanting
                        ? `${anchorPlanting.plant.name}${anchorPlanting.variety ? ` ${anchorPlanting.variety}` : ""}`
                        : null;
                      const statusLabel = effectiveStatus ? STATUS_STYLES[effectiveStatus]?.label.toLowerCase() : null;
                      const cellContent = sunMode
                        ? `sun level ${effectiveSun(cell).replace(/_/g, " ").toLowerCase()}`
                        : occupantName
                        ? `${occupantName}${statusLabel ? `, ${statusLabel}` : ""}`
                        : "empty";
                      const isSelectedAny = isSelected || (selectMode && selectedCells.has(cell.id));
                      const ariaLabel = `Row ${cell.row + 1}, column ${cell.col + 1} — ${cellContent}${isSelectedAny ? ", selected" : ""}`;

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
                          ariaLabel={ariaLabel}
                          canEdit={canEdit}
                          onClick={() => handleCellClick(cell)}
                        />
                      );
                    })}
                  </div>
                  {/* Centered plant-name overlay. One label per planting,
                      placed in a grid identical to the cell grid so it spans
                      the planting's whole footprint and centers the name over
                      the single block (not pinned to the anchor's corner). */}
                  {!sunMode && (
                      <div
                        className="absolute inset-0 grid pointer-events-none"
                        style={{
                          gridTemplateColumns: `repeat(${displayCols}, ${cellPx}px)`,
                          gridTemplateRows: `repeat(${displayRows}, ${cellPx}px)`,
                          gap: 0,
                          padding: "14px 16px",
                        }}
                      >
                        {footprintBounds.map(([pid, b]) => {
                          if (!b.name) return null;
                          const span = Math.max(b.maxR - b.minR + 1, b.maxC - b.minC + 1);
                          // Variety second line — only when there's room for it:
                          // a footprint at least 2 cells wide, or a comfortably
                          // large single cell (≥44px). Tiny zoomed-out cells
                          // (<28px) never get it, so labels degrade gracefully.
                          const fpCols = b.maxC - b.minC + 1;
                          const showVariety =
                            !!b.variety && cellPx >= 28 && (fpCols >= 2 || cellPx >= 44);
                          return (
                            <div
                              key={pid}
                              style={{
                                gridColumn: `${b.minC + 1} / ${b.maxC + 2}`,
                                gridRow: `${b.minR + 1} / ${b.maxR + 2}`,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: "0 3px",
                                overflow: "hidden",
                              }}
                            >
                              <span
                                className="text-center"
                                style={{
                                  fontFamily: "var(--font-display)",
                                  fontStyle: "italic",
                                  fontWeight: 700,
                                  fontSize: Math.max(9, Math.min(span > 1 ? 20 : 14, cellPx * 0.28 * (span > 1 ? 1.35 : 1))),
                                  color: "#FDFDF8",
                                  letterSpacing: "-0.005em",
                                  textShadow: "0 1px 2px rgba(0,0,0,0.45), 0 0 6px rgba(0,0,0,0.25)",
                                  fontVariationSettings: "'opsz' 14",
                                  lineHeight: 1.05,
                                }}
                              >
                                {b.name.split(" ")[0]}
                              </span>
                              {showVariety && (
                                <span
                                  className="text-center max-w-full truncate"
                                  style={{
                                    fontFamily: "var(--font-body)",
                                    fontStyle: "italic",
                                    fontWeight: 500,
                                    fontSize: Math.max(8, Math.min(11, cellPx * 0.2)),
                                    color: "rgba(253,253,248,0.85)",
                                    textShadow: "0 1px 2px rgba(0,0,0,0.45)",
                                    lineHeight: 1.1,
                                    marginTop: 1,
                                  }}
                                >
                                  {b.variety}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                  )}
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
                <span className="text-xs text-[#6B6B5A]">{canEdit ? "Tap any cell to add a plant" : "No plants in this bed yet"}</span>
              ) : (
                <>
                  {Object.entries(STATUS_STYLES)
                    .filter(([key]) => presentStatuses.has(key as PlantingStatus))
                    .map(([key, s]) => (
                      <div key={key} className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm" style={{ background: CELL_STYLE[key]?.bg ?? s.from, border: `1px solid ${CELL_STYLE[key]?.border ?? "transparent"}` }} />
                        <span className="text-xs text-[#6B6B5A]">{s.label}</span>
                      </div>
                    ))}
                  {hasAnyWarnings && (
                    <>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full shadow-sm" style={{ background: "#B85C3A" }} />
                        <span className="text-xs text-[#6B6B5A]">Conflict</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full shadow-sm" style={{ background: "#3A6B20" }} />
                        <span className="text-xs text-[#6B6B5A]">Beneficial</span>
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
          className="w-full md:w-[360px] md:shrink-0 md:sticky md:top-4 md:self-start flex flex-col"
        >
          <div
            className="rounded-xl border shadow-md overflow-hidden flex flex-col"
            style={{ background: "#FDFDF8", borderColor: "#E4E4DC", maxHeight: isMobile ? undefined : "calc(100vh - 96px)" }}
          >
            {/* Read-only eyebrow — tells collaborators why edit modes are gone */}
            {!canEdit && (
              <div
                className="flex items-center justify-center gap-1.5 py-1.5 border-b shrink-0"
                style={{ background: "#F4F4EC", borderColor: "#E4E4DC" }}
              >
                <Eye className="w-3 h-3" style={{ color: "#6B6B5A" }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#6B6B5A" }}>
                  Viewing — read only
                </span>
              </div>
            )}
            {/* First-visit coach mark — explains the mode tabs once, then
                lives in localStorage. "Learn more" opens the field guide. */}
            {canEdit && showIntro && (
              <div
                className="px-4 py-3 border-b shrink-0"
                style={{ background: "#E4F0D4", borderColor: "#D4E8BE" }}
              >
                <p className="text-xs leading-relaxed" style={{ color: "#1C3D0A" }}>
                  <span className="font-semibold">New here?</span> Five tools: Plant fills
                  cells, Sun maps light, Pairs shows good neighbors, AI plans the bed,
                  Select plants many cells at once.
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <button
                    type="button"
                    onClick={dismissIntro}
                    className="px-3 py-1 text-xs font-semibold rounded-md bg-[#1C3D0A] text-white hover:bg-[#3d6b1e] transition-colors"
                  >
                    Got it
                  </button>
                  <button
                    type="button"
                    onClick={() => setHelpOpen(true)}
                    className="text-xs font-medium underline underline-offset-2"
                    style={{ color: "#3A6B20" }}
                  >
                    Learn more
                  </button>
                </div>
              </div>
            )}
            {/* Mode switcher — icon row. Viewers keep the read modes (plant
                detail, sun map, companion pairs) and lose the edit modes
                (AI layout, bulk select). */}
            <div
              className="flex items-stretch border-b shrink-0"
              role="tablist"
              aria-label="Editor mode"
              style={{ background: "#F8F8F2", borderColor: "#E4E4DC" }}
            >
              {(canEdit
                ? (["plant", "sun", "companions", "smart", "select"] as const)
                : (["plant", "sun", "companions"] as const)
              ).map((tab) => {
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
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => {
                      // Cancel any active move/prefill mode when switching
                      // tabs so its banner doesn't linger and lie about what
                      // the next cell tap will do.
                      if (tab !== activeTab) {
                        setMovingPlanting(null);
                        setPendingPlant(null);
                      }
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
                  >
                    {ICON[tab]}
                    <span>{LABEL[tab]}</span>
                  </button>
                );
              })}
            </div>

            {/* Active-mode descriptor — one persistent line so every mode is
                explained, not just the ones with a dedicated sidebar panel. */}
            <div
              className="px-4 py-1.5 border-b shrink-0"
              style={{ background: "#FDFDF8", borderColor: "#E4E4DC" }}
            >
              <p style={{ fontSize: 11, color: "#6B6B5A", lineHeight: 1.45 }}>
                {(canEdit ? MODE_DESC_EDIT : MODE_DESC_VIEW)[activeTab]}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* PLANT MODE: always-visible library, plus detail panel when a cell with a planting is selected */}
              {activeTab === "plant" && panel.type !== "detail" && panel.type !== "picker" && (
                canEdit ? (
                  <PlantLibrary
                    recentPlants={recentPlants}
                    cellSizeIn={cellSizeIn}
                    gridCols={gridCols}
                    gridRows={gridRows}
                    userId={userId}
                    onCardClick={(p) => setPendingPlant(p)}
                    selectedPlantId={pendingPlant?.id ?? null}
                  />
                ) : (
                  /* Viewers don't get the plant library (it exists to place
                     plants) — explain what they CAN do instead. */
                  <div className="p-5 space-y-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: "#F4F4EC" }}
                    >
                      <Eye className="w-5 h-5" style={{ color: "#6B6B5A" }} />
                    </div>
                    <p className="text-sm font-semibold" style={{ color: "#111109" }}>Viewing this bed</p>
                    <p className="text-xs leading-relaxed" style={{ color: "#6B6B5A" }}>
                      Tap any planted cell to see its details — status, dates, variety, and companions. You have view-only access; ask the garden owner for editor access to make changes.
                    </p>
                  </div>
                )
              )}
              {activeTab === "plant" && panel.type === "picker" && (
                <div className="p-4">
                  <PlantPicker
                    cellId={panel.cellId}
                    seasonId={seasonId}
                    userId={userId}
                    cellSizeIn={cellSizeIn}
                    recentPlants={recentPlants}
                    seedInventory={seedInventory}
                    familyHistory={familyHistory}
                    onClose={() => {
                      // Just planted into this cell? Don't snap back to none —
                      // the auto-open effect is about to swap in the detail
                      // panel. A plain dismiss (X / no plant) closes normally.
                      if (pendingDetailRef.current) return;
                      setPanel({ type: "none" });
                    }}
                    onPlanted={(id) => {
                      handlePlanted(id);
                      queueAutoOpen(id);
                    }}
                  />
                </div>
              )}
              {activeTab === "plant" && panel.type === "detail" && (
                <CellDetail
                  planting={{ ...panel.planting, cell: { row: panel.cell.row, col: panel.cell.col } }}
                  warnings={panel.cell.warnings}
                  gardenId={gardenId}
                  bedId={bedId}
                  frost={frost}
                  canEdit={canEdit}
                  onClose={() => setPanel({ type: "none" })}
                  onMoveStart={canEdit ? (p) => setMovingPlanting(p) : undefined}
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
                    {canEdit
                      ? "Tap any cell to cycle its sun level. Use this to map shadows from fences, trees, or the house so plant suggestions match each spot's reality."
                      : "Shows each cell's mapped sun exposure — shadows from fences, trees, or the house."}
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
                    <div className="text-center py-10" style={{ color: "#6B6B5A" }}>
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
                                {w.plantName}{w.notes ? `: ${w.notes}` : ""}
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
                      onAssignmentsAccepted={() => setPreviewAssignments([])}
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
                    Tap empty cells in the bed to select them. Then plant the same crop into all of them at once, useful for filling a row of carrots or onions.
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
                    Pick a plant. It&apos;ll be added to all {panel.cellIds.length} selected cells.
                  </p>
                  <PlantPicker
                    cellIds={panel.cellIds}
                    seasonId={seasonId}
                    userId={userId}
                    cellSizeIn={cellSizeIn}
                    recentPlants={recentPlants}
                    seedInventory={seedInventory}
                    familyHistory={familyHistory}
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
    <HelpSheet open={helpOpen} onOpenChange={setHelpOpen} />
    </DndContext>
  );
}
