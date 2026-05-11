"use client";
import { useRef, useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { updateBedPosition } from "@/app/actions/garden";

const SCALE = 50; // pixels per foot in viewBox

type Bed = {
  id: string;
  name: string;
  xPosition: number;
  yPosition: number;
  widthFt: number;
  heightFt: number;
  plantCount: number;
};

type Garden = {
  id: string;
  widthFt: number;
  heightFt: number;
};

const CATEGORY_COLORS = [
  "#4A7C2F", "#6B8F47", "#8FA86B", "#C4790A", "#7AB648", "#2D5016",
];

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
  const [, startTransition] = useTransition();

  const svgWidth = garden.widthFt * SCALE;
  const svgHeight = garden.heightFt * SCALE;

  function getSvgCoords(e: React.PointerEvent) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const scaleX = svgWidth / rect.width;
    const scaleY = svgHeight / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
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
    [dragging]
  );

  function onPointerUp(e: React.PointerEvent) {
    if (!dragging) return;
    const pos = positions[dragging.bedId];
    const moved =
      Math.abs(pos.x - dragging.startBedX) > 0.1 ||
      Math.abs(pos.y - dragging.startBedY) > 0.1;

    if (moved) {
      startTransition(() => {
        updateBedPosition(dragging.bedId, Math.round(pos.x * 10) / 10, Math.round(pos.y * 10) / 10);
      });
    } else {
      // It was a click, not a drag
      router.push(`/garden/${garden.id}/beds/${dragging.bedId}`);
    }
    setDragging(null);
  }

  return (
    <div className="w-full rounded-xl overflow-hidden border border-[#E8E2D9] bg-[#F5F0E8]">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        width="100%"
        style={{ display: "block", userSelect: "none", cursor: dragging ? "grabbing" : "default" }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {/* Grid lines */}
        {Array.from({ length: Math.floor(garden.widthFt) + 1 }, (_, i) => (
          <line key={`v${i}`} x1={i * SCALE} y1={0} x2={i * SCALE} y2={svgHeight} stroke="#E8E2D9" strokeWidth={0.5} />
        ))}
        {Array.from({ length: Math.floor(garden.heightFt) + 1 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={i * SCALE} x2={svgWidth} y2={i * SCALE} stroke="#E8E2D9" strokeWidth={0.5} />
        ))}

        {/* Beds */}
        {beds.map((bed, idx) => {
          const pos = positions[bed.id] ?? { x: bed.xPosition, y: bed.yPosition };
          const x = pos.x * SCALE;
          const y = pos.y * SCALE;
          const w = bed.widthFt * SCALE;
          const h = bed.heightFt * SCALE;
          const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
          const isDragging = dragging?.bedId === bed.id;

          return (
            <g
              key={bed.id}
              style={{ cursor: "grab" }}
              onPointerDown={(e) => onBedPointerDown(e, bed)}
              opacity={isDragging ? 0.8 : 1}
            >
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                rx={4}
                fill={color}
                fillOpacity={0.15}
                stroke={color}
                strokeWidth={2}
              />
              {/* Label */}
              <text
                x={x + w / 2}
                y={y + h / 2 - (bed.plantCount > 0 ? 8 : 0)}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={color}
                fontSize={Math.min(14, w / bed.name.length * 1.4)}
                fontWeight="600"
                fontFamily="serif"
                style={{ pointerEvents: "none" }}
              >
                {bed.name}
              </text>
              {bed.plantCount > 0 && (
                <text
                  x={x + w / 2}
                  y={y + h / 2 + 10}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={color}
                  fontSize={10}
                  fillOpacity={0.8}
                  style={{ pointerEvents: "none" }}
                >
                  {bed.plantCount} plant{bed.plantCount !== 1 ? "s" : ""}
                </text>
              )}
              {/* Dimension label */}
              <text
                x={x + 4}
                y={y + h - 4}
                fill={color}
                fontSize={8}
                fillOpacity={0.6}
                style={{ pointerEvents: "none" }}
              >
                {bed.widthFt}×{bed.heightFt}ft
              </text>
            </g>
          );
        })}

        {/* Empty state */}
        {beds.length === 0 && (
          <text
            x={svgWidth / 2}
            y={svgHeight / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#9E9890"
            fontSize={14}
          >
            Add a bed to get started
          </text>
        )}
      </svg>
      <p className="text-xs text-center text-[#9E9890] py-2">
        Drag beds to reposition · Click to open
      </p>
    </div>
  );
}
