"use client";
import { useRef, useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { updateBedPosition } from "@/app/actions/garden";

const SCALE = 50;

// Earthy bed palette — cycling through warm greens and ambers
const BED_PALETTES = [
  { fill: "#2D5016", stroke: "#4A7C2F", light: "rgba(45,80,22,0.12)" },
  { fill: "#6B8F47", stroke: "#8FA86B", light: "rgba(107,143,71,0.12)" },
  { fill: "#C4790A", stroke: "#D4A843", light: "rgba(196,121,10,0.10)" },
  { fill: "#4A7C2F", stroke: "#6B8F47", light: "rgba(74,124,47,0.12)" },
  { fill: "#8B6914", stroke: "#A07820", light: "rgba(139,105,20,0.10)" },
  { fill: "#2D5016", stroke: "#4A7C2F", light: "rgba(45,80,22,0.12)" },
];

type Bed = {
  id: string;
  name: string;
  xPosition: number;
  yPosition: number;
  widthFt: number;
  heightFt: number;
  plantCount: number;
};

type Garden = { id: string; widthFt: number; heightFt: number };

export function GardenOverview({ garden, beds }: { garden: Garden; beds: Bed[] }) {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<{
    bedId: string;
    startMouseX: number;
    startMouseY: number;
    startBedX: number;
    startBedY: number;
  } | null>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(
    Object.fromEntries(beds.map((b) => [b.id, { x: b.xPosition, y: b.yPosition }]))
  );
  const [hoveredBed, setHoveredBed] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const svgWidth = garden.widthFt * SCALE;
  const svgHeight = garden.heightFt * SCALE;

  function getSvgCoords(e: React.PointerEvent) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (svgWidth / rect.width),
      y: (e.clientY - rect.top) * (svgHeight / rect.height),
    };
  }

  function onBedPointerDown(e: React.PointerEvent, bed: Bed) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const coords = getSvgCoords(e);
    setDragging({
      bedId: bed.id,
      startMouseX: coords.x,
      startMouseY: coords.y,
      startBedX: positions[bed.id]?.x ?? bed.xPosition,
      startBedY: positions[bed.id]?.y ?? bed.yPosition,
    });
  }

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const coords = getSvgCoords(e);
      const dx = coords.x - dragging.startMouseX;
      const dy = coords.y - dragging.startMouseY;
      const newX = Math.max(0, dragging.startBedX + dx / SCALE);
      const newY = Math.max(0, dragging.startBedY + dy / SCALE);
      setPositions((prev) => ({ ...prev, [dragging.bedId]: { x: newX, y: newY } }));
    },
    [dragging] // eslint-disable-line react-hooks/exhaustive-deps
  );

  function onPointerUp(e: React.PointerEvent) {
    if (!dragging) return;
    const pos = positions[dragging.bedId];
    const moved = Math.abs(pos.x - dragging.startBedX) > 0.1 || Math.abs(pos.y - dragging.startBedY) > 0.1;
    if (moved) {
      startTransition(() => {
        updateBedPosition(dragging.bedId, Math.round(pos.x * 10) / 10, Math.round(pos.y * 10) / 10);
      });
    } else {
      router.push(`/garden/${garden.id}/beds/${dragging.bedId}`);
    }
    setDragging(null);
  }

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-[#E8E2D9] shadow-sm bg-[#F5F0E8]">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        width="100%"
        style={{ display: "block", userSelect: "none", cursor: dragging ? "grabbing" : "default" }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <defs>
          {/* Grass texture pattern */}
          <pattern id="soil" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="#EDE8DF" />
            <circle cx="2" cy="2" r="0.6" fill="#DDD8CF" />
            <circle cx="6" cy="6" r="0.6" fill="#DDD8CF" />
            <circle cx="6" cy="2" r="0.4" fill="#E4DFD6" />
          </pattern>

          {/* Drop shadow filter */}
          <filter id="bed-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="rgba(0,0,0,0.18)" />
          </filter>
          <filter id="bed-shadow-hover" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="rgba(0,0,0,0.25)" />
          </filter>
          <filter id="bed-shadow-drag" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="2" dy="8" stdDeviation="6" floodColor="rgba(0,0,0,0.3)" />
          </filter>
        </defs>

        {/* Ground */}
        <rect width={svgWidth} height={svgHeight} fill="url(#soil)" />

        {/* Subtle grid lines */}
        {Array.from({ length: Math.floor(garden.widthFt) + 1 }, (_, i) => (
          <line key={`v${i}`} x1={i * SCALE} y1={0} x2={i * SCALE} y2={svgHeight}
            stroke="#DDD8CF" strokeWidth={0.75} strokeDasharray="3,4" />
        ))}
        {Array.from({ length: Math.floor(garden.heightFt) + 1 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={i * SCALE} x2={svgWidth} y2={i * SCALE}
            stroke="#DDD8CF" strokeWidth={0.75} strokeDasharray="3,4" />
        ))}

        {/* Beds */}
        {beds.map((bed, idx) => {
          const pos = positions[bed.id] ?? { x: bed.xPosition, y: bed.yPosition };
          const x = pos.x * SCALE;
          const y = pos.y * SCALE;
          const w = bed.widthFt * SCALE;
          const h = bed.heightFt * SCALE;
          const palette = BED_PALETTES[idx % BED_PALETTES.length];
          const isDragging = dragging?.bedId === bed.id;
          const isHovered = hoveredBed === bed.id && !isDragging;

          return (
            <g
              key={bed.id}
              style={{ cursor: isDragging ? "grabbing" : "grab" }}
              filter={isDragging ? "url(#bed-shadow-drag)" : isHovered ? "url(#bed-shadow-hover)" : "url(#bed-shadow)"}
              onPointerDown={(e) => onBedPointerDown(e, bed)}
              onPointerEnter={() => !dragging && setHoveredBed(bed.id)}
              onPointerLeave={() => setHoveredBed(null)}
              opacity={isDragging ? 0.92 : 1}
            >
              {/* Wood border (outer) */}
              <rect
                x={x} y={y} width={w} height={h}
                rx={6} ry={6}
                fill="#A07820"
                stroke="#8B6914"
                strokeWidth={3}
              />
              {/* Soil interior */}
              <rect
                x={x + 5} y={y + 5} width={w - 10} height={h - 10}
                rx={3} ry={3}
                fill={palette.light}
                stroke={palette.stroke}
                strokeWidth={1.5}
              />
              {/* Plant fill overlay */}
              {bed.plantCount > 0 && (
                <rect
                  x={x + 5} y={y + 5}
                  width={(w - 10) * Math.min(1, bed.plantCount / Math.max(1, (bed.widthFt * bed.heightFt)))}
                  height={h - 10}
                  rx={3} ry={3}
                  fill={palette.fill}
                  fillOpacity={0.18}
                />
              )}
              {/* Bed name */}
              <text
                x={x + w / 2}
                y={y + h / 2 - (bed.plantCount > 0 ? 9 : 0)}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={palette.fill}
                fontSize={Math.min(15, Math.max(9, w / (bed.name.length * 0.75)))}
                fontWeight="700"
                fontFamily="Georgia, serif"
                style={{ pointerEvents: "none" }}
              >
                {bed.name}
              </text>
              {/* Plant count */}
              {bed.plantCount > 0 && (
                <text
                  x={x + w / 2}
                  y={y + h / 2 + 11}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={palette.fill}
                  fillOpacity={0.75}
                  fontSize={9}
                  fontFamily="system-ui, sans-serif"
                  style={{ pointerEvents: "none" }}
                >
                  {bed.plantCount} {bed.plantCount === 1 ? "plant" : "plants"}
                </text>
              )}
              {/* Dimension badge */}
              <text
                x={x + 6} y={y + h - 5}
                fill={palette.fill}
                fillOpacity={0.55}
                fontSize={7.5}
                fontFamily="system-ui, sans-serif"
                style={{ pointerEvents: "none" }}
              >
                {bed.widthFt}×{bed.heightFt}ft
              </text>
              {/* Hover indicator arrow */}
              {(isHovered || isDragging) && (
                <text
                  x={x + w - 6} y={y + h - 5}
                  textAnchor="end"
                  fill={palette.fill}
                  fillOpacity={0.7}
                  fontSize={8}
                  fontFamily="system-ui, sans-serif"
                  style={{ pointerEvents: "none" }}
                >
                  open →
                </text>
              )}
            </g>
          );
        })}

        {/* Empty state */}
        {beds.length === 0 && (
          <text
            x={svgWidth / 2} y={svgHeight / 2}
            textAnchor="middle" dominantBaseline="middle"
            fill="#9E9890" fontSize={14}
            fontFamily="Georgia, serif"
          >
            Add a bed to get started
          </text>
        )}
      </svg>
      <p className="text-[11px] text-center text-[#9E9890] py-2 bg-[#EDE8DF]">
        Drag to reposition · Tap to open
      </p>
    </div>
  );
}
