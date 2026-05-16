"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateBedPosition } from "@/app/actions/garden";

type CellOccupant = { plantingId: string; isPrimary: boolean; category: string };
type CellData = { row: number; col: number; occupants: CellOccupant[] };

export type Bed2D = {
  id: string;
  name: string;
  xPosition: number;
  yPosition: number;
  widthFt: number;
  heightFt: number;
  gridCols: number;
  gridRows: number;
  plantCount: number;
  cells: CellData[];
};
export type Garden2D = { id: string; widthFt: number; heightFt: number };

// Plant-category palette — matches the dashboard polaroid gradients so the
// two views feel like one family.
const CATEGORY_COLOR: Record<string, string> = {
  VEGETABLE: "#4a8a2e",
  FRUIT: "#C44A2A",
  HERB: "#7DA84E",
  FLOWER: "#BC6B8A",
  TREE: "#3d6b32",
  SHRUB: "#5A8240",
  OTHER: "#A07640",
};

export function GardenOverview2D({ garden, beds }: { garden: Garden2D; beds: Bed2D[] }) {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const [, startTransition] = useTransition();

  const GW = garden.widthFt;
  const GH = garden.heightFt;
  const PAD = 1; // 1ft margin around the plot

  // Local optimistic positions — committed to the server on pointer-up.
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(
    () => Object.fromEntries(beds.map((b) => [b.id, { x: b.xPosition, y: b.yPosition }]))
  );

  // View transform — viewBox-driven zoom + pan, all in world units (feet).
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(-PAD);
  const [panY, setPanY] = useState(-PAD);
  const viewW = (GW + PAD * 2) / zoom;
  const viewH = (GH + PAD * 2) / zoom;

  // Sync ref so the wheel handler (registered once) sees latest values.
  const viewRef = useRef({ zoom, panX, panY, viewW, viewH });
  viewRef.current = { zoom, panX, panY, viewW, viewH };

  const [dragging, setDragging] = useState<{
    bedId: string;
    startX: number;
    startY: number;
    bedStartX: number;
    bedStartY: number;
  } | null>(null);

  const [panning, setPanning] = useState<{
    clientX: number;
    clientY: number;
    panStartX: number;
    panStartY: number;
    svgW: number;
    svgH: number;
  } | null>(null);

  const [hoveredBed, setHoveredBed] = useState<string | null>(null);

  // ── Coord conversion ──────────────────────────────────────────────────────
  function clientToWorld(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: pt.x, y: pt.y };
  }

  // ── Wheel zoom (cursor-centered) ──────────────────────────────────────────
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const { zoom: z, panX: px, panY: py, viewW: vw, viewH: vh } = viewRef.current;

      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 32;
      else if (e.deltaMode === 2) delta *= 600;
      const clamped = Math.max(-200, Math.min(200, delta));
      const factor = Math.pow(0.999, clamped);
      const newZoom = Math.max(0.4, Math.min(8, z * factor));

      // Keep the world point under the cursor stationary as we zoom.
      const rect = svg.getBoundingClientRect();
      const rx = (e.clientX - rect.left) / rect.width;
      const ry = (e.clientY - rect.top) / rect.height;
      const newVw = (GW + PAD * 2) / newZoom;
      const newVh = (GH + PAD * 2) / newZoom;
      setZoom(newZoom);
      setPanX(px + rx * vw - rx * newVw);
      setPanY(py + ry * vh - ry * newVh);
    };
    svg.addEventListener("wheel", handler, { passive: false });
    return () => svg.removeEventListener("wheel", handler);
  }, [GW, GH]);

  // ── Bed drag ──────────────────────────────────────────────────────────────
  function onBedPointerDown(e: React.PointerEvent, bed: Bed2D) {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const w = clientToWorld(e.clientX, e.clientY);
    const pos = positions[bed.id];
    setDragging({
      bedId: bed.id,
      startX: w.x,
      startY: w.y,
      bedStartX: pos.x,
      bedStartY: pos.y,
    });
  }

  // ── Canvas pan ────────────────────────────────────────────────────────────
  function onCanvasPointerDown(e: React.PointerEvent) {
    // Only pan if not starting on a bed (beds stop propagation).
    if (dragging) return;
    const svg = svgRef.current;
    if (!svg) return;
    svg.setPointerCapture(e.pointerId);
    const rect = svg.getBoundingClientRect();
    setPanning({
      clientX: e.clientX,
      clientY: e.clientY,
      panStartX: panX,
      panStartY: panY,
      svgW: rect.width,
      svgH: rect.height,
    });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (dragging) {
      const w = clientToWorld(e.clientX, e.clientY);
      const bed = beds.find((b) => b.id === dragging.bedId);
      if (!bed) return;
      const nx = dragging.bedStartX + (w.x - dragging.startX);
      const ny = dragging.bedStartY + (w.y - dragging.startY);
      // Snap to 1ft increments so beds line up with the lawn grid. Hold
      // Shift for a 0.1ft (~1 inch) nudge — matches the commit-time
      // precision so power users can fine-tune without lying to the DB.
      const step = e.shiftKey ? 0.1 : 1;
      const snappedX = Math.round(nx / step) * step;
      const snappedY = Math.round(ny / step) * step;
      const clampedX = Math.max(0, Math.min(GW - bed.widthFt, snappedX));
      const clampedY = Math.max(0, Math.min(GH - bed.heightFt, snappedY));
      setPositions((p) => ({ ...p, [bed.id]: { x: clampedX, y: clampedY } }));
    } else if (panning) {
      const dx = ((e.clientX - panning.clientX) / panning.svgW) * viewW;
      const dy = ((e.clientY - panning.clientY) / panning.svgH) * viewH;
      setPanX(panning.panStartX - dx);
      setPanY(panning.panStartY - dy);
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    if (dragging) {
      const bed = beds.find((b) => b.id === dragging.bedId);
      const pos = positions[dragging.bedId];
      if (bed) {
        const moved =
          Math.abs(pos.x - dragging.bedStartX) > 0.15 ||
          Math.abs(pos.y - dragging.bedStartY) > 0.15;
        if (moved) {
          startTransition(() =>
            updateBedPosition(
              dragging.bedId,
              Math.round(pos.x * 10) / 10,
              Math.round(pos.y * 10) / 10
            )
          );
        } else {
          // Treat as a click — navigate into the bed editor.
          router.push(`/garden/${garden.id}/beds/${dragging.bedId}`);
        }
      }
      setDragging(null);
    }
    if (panning) setPanning(null);
    if (e.pointerType === "touch") {
      try {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    }
  }

  function resetView() {
    setZoom(1);
    setPanX(-PAD);
    setPanY(-PAD);
  }

  function applyZoom(direction: 1 | -1) {
    const factor = direction === 1 ? 1.3 : 1 / 1.3;
    const newZoom = Math.max(0.4, Math.min(8, zoom * factor));
    const newVw = (GW + PAD * 2) / newZoom;
    const newVh = (GH + PAD * 2) / newZoom;
    // Zoom around the current viewBox center.
    setPanX(panX + (viewW - newVw) / 2);
    setPanY(panY + (viewH - newVh) / 2);
    setZoom(newZoom);
  }

  // Sort beds so the dragging one renders on top.
  const sortedBeds = dragging
    ? [...beds.filter((b) => b.id !== dragging.bedId), beds.find((b) => b.id === dragging.bedId)!]
    : beds;

  // Choose a font scale appropriate for current zoom — names should stay legible.
  const labelScale = Math.max(0.18, Math.min(0.4, 0.35 / zoom));

  return (
    <div
      className="relative w-full"
      style={{ background: "#19280e", height: "clamp(320px, 42vh, 520px)" }}
    >
      <svg
        ref={svgRef}
        viewBox={`${panX} ${panY} ${viewW} ${viewH}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        role="application"
        aria-label={`Garden top-down view. ${beds.length} bed${beds.length !== 1 ? "s" : ""}. Tap a bed to open it.`}
        style={{
          display: "block",
          touchAction: "none",
          userSelect: "none",
          cursor: dragging || panning ? "grabbing" : "grab",
        }}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <defs>
          <pattern id="g2dGrass" x="0" y="0" width="0.5" height="0.5" patternUnits="userSpaceOnUse">
            <rect width="0.5" height="0.5" fill="#4a7c3f" />
            <circle cx="0.1" cy="0.1" r="0.03" fill="#3d6b32" opacity="0.55" />
            <circle cx="0.35" cy="0.3" r="0.025" fill="#56904a" opacity="0.45" />
            <circle cx="0.22" cy="0.42" r="0.02" fill="#3d6b32" opacity="0.4" />
          </pattern>
          <pattern id="g2dSoil" x="0" y="0" width="0.3" height="0.3" patternUnits="userSpaceOnUse">
            <rect width="0.3" height="0.3" fill="#3a2818" />
            <circle cx="0.07" cy="0.08" r="0.02" fill="#241510" opacity="0.6" />
            <circle cx="0.2" cy="0.18" r="0.018" fill="#241510" opacity="0.5" />
            <circle cx="0.1" cy="0.22" r="0.015" fill="#4a3220" opacity="0.55" />
          </pattern>
          <filter id="g2dBedShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.06" />
          </filter>
        </defs>

        {/* Garden plot */}
        <rect x={0} y={0} width={GW} height={GH} fill="url(#g2dGrass)" rx={0.15} />
        <rect
          x={0}
          y={0}
          width={GW}
          height={GH}
          fill="none"
          stroke="rgba(168,216,112,0.3)"
          strokeWidth={0.05}
          rx={0.15}
        />

        {/* Foot-line grid on the grass — subtle so it doesn't compete with bed grids */}
        {Array.from({ length: Math.max(0, Math.floor(GW) - 1) }, (_, i) => (
          <line
            key={`gv${i}`}
            x1={i + 1}
            y1={0}
            x2={i + 1}
            y2={GH}
            stroke="rgba(168,216,112,0.09)"
            strokeWidth={0.02}
          />
        ))}
        {Array.from({ length: Math.max(0, Math.floor(GH) - 1) }, (_, i) => (
          <line
            key={`gh${i}`}
            x1={0}
            y1={i + 1}
            x2={GW}
            y2={i + 1}
            stroke="rgba(168,216,112,0.09)"
            strokeWidth={0.02}
          />
        ))}

        {/* Beds */}
        {sortedBeds.map((bed) => {
          const pos = positions[bed.id] ?? { x: bed.xPosition, y: bed.yPosition };
          const cellW = bed.widthFt / bed.gridCols;
          const cellH = bed.heightFt / bed.gridRows;
          const isDrag = dragging?.bedId === bed.id;
          const isHover = hoveredBed === bed.id;
          return (
            <g
              key={bed.id}
              transform={`translate(${pos.x}, ${pos.y})`}
              style={{
                filter: isDrag ? "drop-shadow(0 0.1px 0.3px rgba(0,0,0,0.5))" : undefined,
                opacity: isDrag ? 0.92 : 1,
              }}
            >
              {/* Bed shadow */}
              <rect
                x={0.04}
                y={0.06}
                width={bed.widthFt}
                height={bed.heightFt}
                fill="#000"
                opacity={0.3}
                filter="url(#g2dBedShadow)"
                rx={0.08}
              />
              {/* Soil */}
              <rect x={0} y={0} width={bed.widthFt} height={bed.heightFt} fill="#3a2818" rx={0.08} />
              <rect x={0} y={0} width={bed.widthFt} height={bed.heightFt} fill="url(#g2dSoil)" rx={0.08} />

              {/* Wood frame */}
              <rect
                x={0}
                y={0}
                width={bed.widthFt}
                height={bed.heightFt}
                fill="none"
                stroke="#C49458"
                strokeWidth={0.09}
                rx={0.08}
              />
              <rect
                x={0.04}
                y={0.04}
                width={Math.max(0, bed.widthFt - 0.08)}
                height={Math.max(0, bed.heightFt - 0.08)}
                fill="none"
                stroke="#7D5630"
                strokeWidth={0.025}
                rx={0.05}
              />

              {/* Cell grid */}
              {Array.from({ length: bed.gridCols - 1 }, (_, i) => (
                <line
                  key={`bv${i}`}
                  x1={(i + 1) * cellW}
                  y1={0}
                  x2={(i + 1) * cellW}
                  y2={bed.heightFt}
                  stroke="rgba(168,216,112,0.22)"
                  strokeWidth={0.012}
                />
              ))}
              {Array.from({ length: bed.gridRows - 1 }, (_, i) => (
                <line
                  key={`bh${i}`}
                  x1={0}
                  y1={(i + 1) * cellH}
                  x2={bed.widthFt}
                  y2={(i + 1) * cellH}
                  stroke="rgba(168,216,112,0.22)"
                  strokeWidth={0.012}
                />
              ))}

              {/* Plant cells */}
              {bed.cells.map((c) =>
                c.occupants.map((o) => {
                  const cx = c.col * cellW + cellW / 2;
                  const cy = c.row * cellH + cellH / 2;
                  const radius = Math.min(cellW, cellH) * (o.isPrimary ? 0.32 : 0.24);
                  const color = CATEGORY_COLOR[o.category] ?? "#A07640";
                  return (
                    <g key={`${c.row}-${c.col}-${o.plantingId}`}>
                      <circle
                        cx={cx}
                        cy={cy}
                        r={radius}
                        fill={color}
                        opacity={o.isPrimary ? 0.95 : 0.65}
                        stroke={o.isPrimary ? "#1C3D0A" : "none"}
                        strokeWidth={o.isPrimary ? 0.015 : 0}
                      />
                    </g>
                  );
                })
              )}

              {/* Interaction overlay — sits above grid + plants, transparent */}
              <rect
                x={0}
                y={0}
                width={bed.widthFt}
                height={bed.heightFt}
                fill="transparent"
                stroke={isHover && !isDrag ? "#A8D870" : "none"}
                strokeWidth={isHover ? 0.04 : 0}
                rx={0.08}
                style={{ cursor: isDrag ? "grabbing" : "grab" }}
                onPointerDown={(e) => onBedPointerDown(e, bed)}
                onPointerEnter={() => setHoveredBed(bed.id)}
                onPointerLeave={() => setHoveredBed(null)}
              />

              {/* Bed name */}
              <text
                x={bed.widthFt / 2}
                y={bed.heightFt / 2 + labelScale * 0.3}
                textAnchor="middle"
                fill="#f0e0c0"
                fontSize={Math.min(labelScale, bed.widthFt * 0.22, bed.heightFt * 0.45)}
                fontWeight={700}
                fontFamily="Fraunces, Georgia, serif"
                fontStyle="italic"
                style={{ pointerEvents: "none" }}
              >
                {bed.name}
              </text>
            </g>
          );
        })}

        {/* Compass rose — top-right of plot */}
        <g transform={`translate(${GW - 0.65}, 0.65)`} opacity="0.45" style={{ pointerEvents: "none" }}>
          <circle cx="0" cy="0" r="0.35" fill="none" stroke="#A8D870" strokeWidth="0.025" />
          <line x1="0" y1="-0.28" x2="0" y2="-0.05" stroke="#A8D870" strokeWidth="0.04" />
          <text x="0" y="-0.38" textAnchor="middle" fontSize="0.2" fill="#A8D870" fontFamily="IBM Plex Mono">
            N
          </text>
        </g>
      </svg>

      {/* Zoom controls — bottom-right */}
      <div className="absolute bottom-2 right-3 flex flex-col gap-1 z-10">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => applyZoom(1)}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
          style={{
            background: "rgba(0,0,0,0.45)",
            color: "rgba(168,216,112,0.9)",
            border: "1px solid rgba(168,216,112,0.18)",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => applyZoom(-1)}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
          style={{
            background: "rgba(0,0,0,0.45)",
            color: "rgba(168,216,112,0.9)",
            border: "1px solid rgba(168,216,112,0.18)",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          −
        </button>
        <div className="h-px mx-1 my-0.5" style={{ background: "rgba(255,255,255,0.15)" }} />
        <button
          type="button"
          aria-label="Reset view"
          onClick={resetView}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
          style={{
            background: "rgba(0,0,0,0.45)",
            color: "rgba(168,216,112,0.9)",
            border: "1px solid rgba(168,216,112,0.18)",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          ⌂
        </button>
      </div>

      {/* Screen reader fallback */}
      <ul className="sr-only">
        {beds.map((bed) => (
          <li key={bed.id}>
            <Link href={`/garden/${garden.id}/beds/${bed.id}`}>
              {bed.name}: {bed.plantCount} {bed.plantCount === 1 ? "plant" : "plants"}, {bed.widthFt}×{bed.heightFt} ft
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
