"use client";

/**
 * GridCell — the single bed-grid cell (extracted from BedGrid so temporal
 * scrubber styling doesn't grow a 2,000-line file further). Exports the
 * shared cell types and the canvas's status/category palettes.
 */
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { Check } from "lucide-react";
import type { SunLevel, PlantingStatus, PlantStartMethod } from "@/lib/generated/prisma/enums";
import type { LayoutAssignment } from "@/lib/services/smart-layout";


// Status → light cell fill + border color + label
export const STATUS_STYLES: Record<string, { from: string; to: string; label: string }> = {
  PLANNED:      { from: "#8FA86B", to: "#7A9559", label: "Planned" },
  SEEDS_STARTED:{ from: "#D4A843", to: "#BA8F2E", label: "Seeds started" },
  TRANSPLANTED: { from: "#7AB648", to: "#609834", label: "Transplanted" },
  ACTIVE:       { from: "#3A6B20", to: "#325A1F", label: "Active" },
  HARVESTING:   { from: "#D4820A", to: "#A36207", label: "Harvesting" },
  HARVESTED:    { from: "#ADADAA", to: "#837E78", label: "Harvested" },
  FAILED:       { from: "#B85C3A", to: "#954928", label: "Failed" },
};

export const CELL_STYLE: Record<string, { bg: string; border: string }> = {
  PLANNED:       { bg: "#F0F8E8", border: "rgba(125,168,78,0.4)" },
  SEEDS_STARTED: { bg: "#FFFBEB", border: "rgba(212,130,10,0.35)" },
  TRANSPLANTED:  { bg: "#E8F5E0", border: "rgba(58,107,32,0.4)" },
  ACTIVE:        { bg: "#E4F0D4", border: "rgba(58,107,32,0.5)" },
  HARVESTING:    { bg: "#FDF2E0", border: "rgba(212,130,10,0.4)" },
  HARVESTED:     { bg: "#F4F4EC", border: "rgba(173,173,170,0.4)" },
  FAILED:        { bg: "#FBF0EE", border: "rgba(122,42,24,0.25)" },
};

export const STATUS_DOT_COLOR: Record<string, string> = {
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
export const CATEGORY_COLOR: Record<string, string> = {
  VEGETABLE: "#4a8a2e",
  FRUIT: "#C44A2A",
  HERB: "#7DA84E",
  FLOWER: "#BC6B8A",
  TREE: "#3d6b32",
  SHRUB: "#5A8240",
  OTHER: "#A07640",
};

export const SUN_CYCLE: SunLevel[] = ["FULL_SUN", "PARTIAL_SUN", "PARTIAL_SHADE", "FULL_SHADE"];
export const SUN_LABEL: Record<string, string> = {
  FULL_SUN: "☀️", PARTIAL_SUN: "⛅", PARTIAL_SHADE: "🌥️", FULL_SHADE: "☁️",
};
export const SUN_BG: Record<string, string> = {
  FULL_SUN: "#FEF9C3", PARTIAL_SUN: "#FEF3C7", PARTIAL_SHADE: "#E0F2FE", FULL_SHADE: "#F1F5F9",
};



export type Plant = { id: string; name: string; category: string; imageUrl: string | null; daysToMaturity: number | null; spacingInches: number | null; indoorStartWeeks?: number | null; transplantWeeks?: number | null; plantFamily?: string | null; isPerennial?: boolean };
export type Planting = {
  id: string;
  status: PlantingStatus;
  plant: Plant;
  plantedDate: Date | null;
  transplantDate: Date | null;
  expectedHarvestDate: Date | null;
  variety: string | null;
  notes: string | null;
  startMethod: PlantStartMethod | null;
  /** Plants growing in each occupied cell (SFG density — 4 carrots/cell). */
  quantityPerCell?: number;
  /** Start of the occupancy window — "Planned for" display + future pill. */
  occupiesFrom?: Date;
  /** Denormalized perennial liveness (drives badge + remove flow). */
  isPerennial?: boolean;
  /** Scrubber temporal state: future = window hasn't started (ghost +
   *  dashed), past = window over while scrubbing history (grey ghost),
   *  dormant = perennial off-season. Absent/current = today's rendering. */
  temporal?: "past" | "current" | "future" | "dormant";
  /** History counts (harvests/photos/notes) — drives the "removing also
   *  deletes its history" warning in CellDetail's remove confirm. */
  _count?: { harvestLogs: number; photos: number; growthNotes: number };
};
export type CellData = {
  id: string;
  row: number;
  col: number;
  sunLevel: SunLevel;
  /** Set only on the anchor (primary) cell of a planting. */
  planting: Planting | null;
  /** Set when this cell is a non-anchor footprint cell of a multi-cell
   *  planting. Renders the same status color as the anchor but no label,
   *  and routes clicks to the anchor's detail panel. */
  footprint: { plantingId: string; primaryCellId: string; status: PlantingStatus; plantName?: string } | null;
  warnings: { type: "BENEFICIAL" | "HARMFUL"; plantName: string; notes: string | null }[];
};

export function CellTile({
  cell,
  cellPx,
  dotPx,
  dotOffset,
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
  dotPx: number;
  dotOffset: number;
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
  // A multi-cell planting is draggable from ANY of its cells (anchor or
  // footprint) — users grab the block, not a specific corner.
  const dragPlantingId = cell.planting?.id ?? cell.footprint?.plantingId ?? null;
  const dragPlantName = cell.planting?.plant.name ?? cell.footprint?.plantName ?? "plant";
  const drag = useDraggable({
    id: `drag:${cell.id}`,
    data: dragPlantingId
      ? {
          kind: "planting",
          plantingId: dragPlantingId,
          plantName: dragPlantName,
          fromCellId: cell.id,
        }
      : undefined,
    disabled: !canEdit || !dragPlantingId,
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

  const dragProps = isOccupied && canEdit ? { ...drag.attributes, ...drag.listeners } : {};

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
        // Single shorthand ONLY — never pair `border` with a `borderStyle`
        // longhand. `border: "none"` leaves border-width at its 3px default,
        // and a separate borderStyle re-enables it: every occupied cell got
        // a 3px seam cutting multi-cell blocks into quadrants (only on fresh
        // mounts — React's style diffing hid it after empty→occupied
        // transitions, which is why moves looked fixed until a refresh).
        border: isOccupied
          ? "none"
          : `1.5px ${preview && !isAnchor ? "dashed" : "solid"} ${baseBorder}`,
        borderRadius: cellRadius,
        boxShadow: cellBoxShadow,
        opacity: drag.isDragging ? 0.35 : 1,
        cursor: isOccupied && canEdit ? (drag.isDragging ? "grabbing" : "grab") : "pointer",
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
      {/* Density badge — SFG plants-per-cell (×4 carrots), top-left so it
          doesn't fight the status dot. Hidden in dense/zoomed-out views. */}
      {isAnchor && cell.planting && (cell.planting.quantityPerCell ?? 1) > 1 && !sunMode && !dense && (
        <span
          aria-hidden
          className="absolute pointer-events-none"
          style={{
            top: dotOffset,
            left: dotOffset + 2,
            fontFamily: "var(--font-mono)",
            fontSize: Math.max(9, Math.min(13, cellPx * 0.16)),
            fontWeight: 600,
            lineHeight: 1,
            color: "rgba(253,253,248,0.92)",
            textShadow: "0 1px 2px rgba(0,0,0,0.5)",
            letterSpacing: "0.02em",
          }}
        >
          ×{cell.planting.quantityPerCell}
        </span>
      )}
      {/* Status indicator dot — small, top-right of anchor cell so the
          italic name stays clean and centered. */}
      {isAnchor && cell.planting && !sunMode && (
        <span
          aria-hidden
          className="absolute pointer-events-none"
          style={{
            top: dotOffset,
            right: dotOffset,
            width: dotPx,
            height: dotPx,
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

