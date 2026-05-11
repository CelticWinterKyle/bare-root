"use client";
import { useRef, useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBedPosition } from "@/app/actions/garden";
import { RotateCcw, RotateCw, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

// ─── Projection constants ─────────────────────────────────────────────────────
// RADIUS / VERT maintain the same visual scale as the original TW/TH at az = π/4
const TW = 50;
const TH = 25;
const RADIUS = TW * Math.SQRT2;  // ≈ 70.7  — half-tile width per ft (general)
const VERT   = TH * Math.SQRT2;  // ≈ 35.4  — used to derive EL_SCALE
const BED_H = 0.5;               // bed wall height (ft)
const BOARD = 0.15;              // wood frame board width (ft)
const DRAG_LIFT = 0.4;           // extra z when dragging
const INITIAL_AZ = Math.PI / 4;  // classic isometric start azimuth
const ROT_PX = 0.006;            // radians of azimuth per drag pixel
// Elevation (tilt) — controls vertical viewing angle
const INITIAL_EL = Math.atan(1 / Math.SQRT2); // ≈ 35.26° — true isometric
const MIN_EL = 0.35;             // ≈ 20° — dramatic but walls still visible
const MAX_EL = 1.05;             // ≈ 60° — steep but perspective intact
const TILT_PX = 0.003;           // radians of elevation per drag pixel
// EL_SCALE is chosen so the view at INITIAL_EL exactly matches the old VERT/Z_SCALE look
const EL_SCALE = VERT / Math.sin(INITIAL_EL); // ≈ 61.2

// ─── Colors ───────────────────────────────────────────────────────────────────
const LAWN       = "#4a7c3f";
const LAWN_DARK  = "#3d6b32";
const LAWN_LIGHT = "#56904a";
const WOOD_TOP   = "#C49458";
const WOOD_SIDE1 = "#5A3A18"; // y-axis face (darkest — "south" when az=π/4)
const WOOD_SIDE2 = "#7D5630"; // x-axis face (medium — "east" when az=π/4)
const SOIL       = "#3d2b1f";
const SOIL_DARK  = "#2d1f14";
const LABEL_CLR  = "#f0e0c0";
const DOT_OUTER  = "#2d5a1b";
const DOT_INNER  = "#4a8a2e";

// ─── Pure math ────────────────────────────────────────────────────────────────
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Bed = {
  id: string; name: string;
  xPosition: number; yPosition: number;
  widthFt: number; heightFt: number;
  plantCount: number;
};
type Garden = { id: string; widthFt: number; heightFt: number };

// ─── Component ────────────────────────────────────────────────────────────────
export function GardenOverview({ garden, beds }: { garden: Garden; beds: Bed[] }) {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const [, startTransition] = useTransition();

  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(
    () => Object.fromEntries(beds.map((b) => [b.id, { x: b.xPosition, y: b.yPosition }]))
  );
  const [hoveredBed, setHoveredBed] = useState<string | null>(null);

  const [dragging, setDragging] = useState<{
    bedId: string;
    worldStartX: number; worldStartY: number;
    bedStartX: number; bedStartY: number;
  } | null>(null);

  const [azimuth, setAzimuth] = useState(INITIAL_AZ);
  const [elevation, setElevation] = useState(INITIAL_EL);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  const [gesture, setGesture] = useState<{
    startClientX: number; startClientY: number;
    startAzimuth: number;
    startElevation: number;
  } | null>(null);

  const GW = garden.widthFt;
  const GH = garden.heightFt;

  // ── View geometry ──────────────────────────────────────────────────────────
  // viewBox sized to contain garden at any azimuth + maximum elevation
  const DIAG = Math.sqrt(GW * GW + GH * GH);
  const viewW = Math.ceil(DIAG * RADIUS) + 200;
  const viewH = Math.ceil(DIAG * EL_SCALE * Math.sin(MAX_EL)) + 200; // sized for MAX_EL, not 90°
  const vbW = viewW / zoom;
  const vbH = viewH / zoom;

  // Current projection trig
  const COS_AZ = Math.cos(azimuth);
  const SIN_AZ = Math.sin(azimuth);
  const COS_EL = Math.cos(elevation);
  const SIN_EL = Math.sin(elevation);

  // Keep garden center locked to viewBox center as azimuth/elevation changes
  const gardenCx = (GW / 2 * COS_AZ - GH / 2 * SIN_AZ) * RADIUS;
  const gardenCy = (GW / 2 * SIN_AZ + GH / 2 * COS_AZ) * SIN_EL * EL_SCALE;
  const originX = viewW / 2 - gardenCx;
  const originY = viewH / 2 - gardenCy;

  // ── Projection helpers ─────────────────────────────────────────────────────
  function pr(x: number, y: number, z = 0) {
    return {
      sx: (x * COS_AZ - y * SIN_AZ) * RADIUS,
      sy: ((x * SIN_AZ + y * COS_AZ) * SIN_EL - z * COS_EL) * EL_SCALE,
    };
  }

  function ppts(coords: [number, number, (number | undefined)?][]): string {
    return coords.map(([x, y, z = 0]) => {
      const { sx, sy } = pr(x, y, z ?? 0);
      return `${sx},${sy}`;
    }).join(" ");
  }

  // Inverse projection: screen coords → world coords (z=0 floor plane)
  function isoToWorld(sx: number, sy: number) {
    const U = sx / RADIUS;
    const V = sy / (SIN_EL * EL_SCALE);
    return {
      x: U * COS_AZ + V * SIN_AZ,
      y: V * COS_AZ - U * SIN_AZ,
    };
  }

  function getSvgPoint(e: React.PointerEvent) {
    const svg = svgRef.current;
    if (!svg) return { sx: 0, sy: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { sx: 0, sy: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { sx: p.x - originX, sy: p.y - originY };
  }

  // ── Wheel zoom (non-passive) ───────────────────────────────────────────────
  const viewStateRef = useRef({ zoom, panX, panY, vbW, vbH });
  viewStateRef.current = { zoom, panX, panY, vbW, vbH };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const { zoom: z, panX: px, panY: py, vbW: vw, vbH: vh } = viewStateRef.current;
      const newZ = Math.max(0.4, Math.min(8, z * (e.deltaY < 0 ? 1.13 : 0.87)));
      const rect = svg.getBoundingClientRect();
      const rx = (e.clientX - rect.left) / rect.width;
      const ry = (e.clientY - rect.top) / rect.height;
      const newVw = viewW / newZ;
      const newVh = viewH / newZ;
      setZoom(newZ);
      setPanX(px + rx * vw - rx * newVw);
      setPanY(py + ry * vh - ry * newVh);
    };
    svg.addEventListener("wheel", handler, { passive: false });
    return () => svg.removeEventListener("wheel", handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Zoom controls ─────────────────────────────────────────────────────────
  function applyZoom(newZ: number) {
    const z = Math.max(0.4, Math.min(8, newZ));
    const newVw = viewW / z;
    const newVh = viewH / z;
    setPanX(panX + (vbW - newVw) / 2);
    setPanY(panY + (vbH - newVh) / 2);
    setZoom(z);
  }

  function resetView() {
    setZoom(1); setPanX(0); setPanY(0);
  }

  // ── Pointer handlers ──────────────────────────────────────────────────────
  function onBedPointerDown(e: React.PointerEvent, bed: Bed) {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const { sx, sy } = getSvgPoint(e);
    const { x, y } = isoToWorld(sx, sy);
    const pos = positions[bed.id] ?? { x: bed.xPosition, y: bed.yPosition };
    setDragging({
      bedId: bed.id,
      worldStartX: x, worldStartY: y,
      bedStartX: pos.x, bedStartY: pos.y,
    });
  }

  function onSvgPointerDown(e: React.PointerEvent) {
    if (dragging) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setGesture({
      startClientX: e.clientX, startClientY: e.clientY,
      startAzimuth: azimuth,
      startElevation: elevation,
    });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (dragging) {
      const { sx, sy } = getSvgPoint(e);
      const { x, y } = isoToWorld(sx, sy);
      const newX = Math.max(0, dragging.bedStartX + (x - dragging.worldStartX));
      const newY = Math.max(0, dragging.bedStartY + (y - dragging.worldStartY));
      setPositions((prev) => ({ ...prev, [dragging.bedId]: { x: newX, y: newY } }));
    } else if (gesture) {
      const dx = e.clientX - gesture.startClientX;
      const dy = e.clientY - gesture.startClientY;
      // Horizontal → pan (azimuth rotation) — negative so dragging right spins scene right
      setAzimuth(gesture.startAzimuth - dx * ROT_PX);
      // Vertical → tilt (elevation angle) — positive so dragging down tilts toward overhead
      setElevation(Math.max(MIN_EL, Math.min(MAX_EL, gesture.startElevation + dy * TILT_PX)));
    }
  }

  function onPointerUp() {
    if (dragging) {
      const pos = positions[dragging.bedId];
      const bed = beds.find((b) => b.id === dragging.bedId);
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
          router.push(`/garden/${garden.id}/beds/${dragging.bedId}`);
        }
      }
      setDragging(null);
    }
    setGesture(null);
  }

  // ── Z-sort: depth = x·sin(az) + y·cos(az), ascending (back first) ────────
  const sorted = [...beds]
    .filter((b) => !dragging || b.id !== dragging.bedId)
    .sort((a, b) => {
      const pa = positions[a.id] ?? { x: a.xPosition, y: a.yPosition };
      const pb = positions[b.id] ?? { x: b.xPosition, y: b.yPosition };
      const dA = (pa.x + a.widthFt / 2) * SIN_AZ + (pa.y + a.heightFt / 2) * COS_AZ;
      const dB = (pb.x + b.widthFt / 2) * SIN_AZ + (pb.y + b.heightFt / 2) * COS_AZ;
      return dA - dB;
    });
  const dBed = dragging ? beds.find((b) => b.id === dragging.bedId) : null;
  const renderList = dBed ? [...sorted, dBed] : sorted;

  const isBusy = !!dragging || !!gesture;

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden border shadow-xl flex flex-col"
      style={{ background: "#19280e", borderColor: "#2a4018" }}
    >
      <div className="relative" style={{ height: "clamp(380px, 55vw, 720px)" }}>
      <svg
        ref={svgRef}
        viewBox={`${panX} ${panY} ${vbW} ${vbH}`}
        width="100%"
        height="100%"
        style={{
          position: "absolute",
          inset: 0,
          display: "block",
          userSelect: "none",
          touchAction: "none",
          cursor: isBusy ? "grabbing" : "grab",
        }}
        onPointerDown={onSvgPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <defs>
          <pattern id="grass-tex" x="0" y="0" width="18" height="9" patternUnits="userSpaceOnUse">
            <rect width="18" height="9" fill={LAWN} />
            <ellipse cx="4"  cy="4.5" rx="1.8" ry="1.1" fill={LAWN_DARK}  opacity="0.4" />
            <ellipse cx="13" cy="2"   rx="1.2" ry="0.8" fill={LAWN_LIGHT} opacity="0.35" />
            <ellipse cx="9"  cy="7"   rx="1.4" ry="0.9" fill={LAWN_DARK}  opacity="0.3" />
            <ellipse cx="16" cy="5.5" rx="0.9" ry="0.6" fill={LAWN_LIGHT} opacity="0.25" />
          </pattern>
          <pattern id="soil-tex" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
            <rect width="12" height="12" fill={SOIL} />
            <circle cx="3"   cy="3"   r="1.3" fill={SOIL_DARK} opacity="0.6" />
            <circle cx="8.5" cy="7"   r="1.1" fill={SOIL_DARK} opacity="0.5" />
            <circle cx="5"   cy="9.5" r="0.8" fill="#4a3325"   opacity="0.4" />
            <circle cx="10"  cy="2"   r="0.7" fill={SOIL_DARK} opacity="0.35" />
          </pattern>
          <filter id="shd-n" x="-25%" y="-25%" width="160%" height="160%">
            <feDropShadow dx="3" dy="6" stdDeviation="3.5" floodColor="#000" floodOpacity="0.32" />
          </filter>
          <filter id="shd-h" x="-30%" y="-30%" width="170%" height="170%">
            <feDropShadow dx="5" dy="9" stdDeviation="5" floodColor="#000" floodOpacity="0.4" />
          </filter>
          <filter id="shd-d" x="-40%" y="-40%" width="185%" height="185%">
            <feDropShadow dx="8" dy="16" stdDeviation="9" floodColor="#000" floodOpacity="0.48" />
          </filter>
          <filter id="txt-shd" x="-10%" y="-30%" width="120%" height="160%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000" floodOpacity="0.8" />
          </filter>
        </defs>

        <g transform={`translate(${originX}, ${originY})`}>
          {/* Lawn surface */}
          <polygon points={ppts([[0,0],[GW,0],[GW,GH],[0,GH]])} fill="url(#grass-tex)" />
          <polygon points={ppts([[0,0],[GW,0],[GW,GH],[0,GH]])} fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth={1.5} />

          {renderList.map((bed) => {
            const pos = positions[bed.id] ?? { x: bed.xPosition, y: bed.yPosition };
            const bx = pos.x, by = pos.y;
            const W = bed.widthFt, D = bed.heightFt;
            const isD = dragging?.bedId === bed.id;
            const isH = hoveredBed === bed.id && !isD;
            const Z = isD ? BED_H + DRAG_LIFT : BED_H;

            // ── Dynamic face visibility based on viewer direction ─────────────
            // y-axis face: south (SIN>0) or north (SIN<0)
            // x-axis face: east (COS>0) or west (COS<0)
            // Colors: y-face = darkest (WOOD_SIDE1), x-face = medium (WOOD_SIDE2)
            const yFace = COS_AZ >= 0
              ? ppts([[bx,by+D,0],[bx+W,by+D,0],[bx+W,by+D,Z],[bx,by+D,Z]])
              : ppts([[bx+W,by,0],[bx,by,0],[bx,by,Z],[bx+W,by,Z]]);
            const xFace = SIN_AZ >= 0
              ? ppts([[bx+W,by,0],[bx+W,by+D,0],[bx+W,by+D,Z],[bx+W,by,Z]])
              : ppts([[bx,by+D,0],[bx,by,0],[bx,by,Z],[bx,by+D,Z]]);

            // ── Top face ─────────────────────────────────────────────────────
            const nBoard  = ppts([[bx,by,Z],[bx+W,by,Z],[bx+W,by+BOARD,Z],[bx,by+BOARD,Z]]);
            const sBoard  = ppts([[bx,by+D-BOARD,Z],[bx+W,by+D-BOARD,Z],[bx+W,by+D,Z],[bx,by+D,Z]]);
            const wBoard  = ppts([[bx,by,Z],[bx+BOARD,by,Z],[bx+BOARD,by+D,Z],[bx,by+D,Z]]);
            const eBoard  = ppts([[bx+W-BOARD,by,Z],[bx+W,by,Z],[bx+W,by+D,Z],[bx+W-BOARD,by+D,Z]]);
            const soil    = ppts([[bx+BOARD,by+BOARD,Z],[bx+W-BOARD,by+BOARD,Z],[bx+W-BOARD,by+D-BOARD,Z],[bx+BOARD,by+D-BOARD,Z]]);
            const topLine = ppts([[bx,by,Z],[bx+W,by,Z],[bx+W,by+D,Z],[bx,by+D,Z]]);

            // ── Plant dots (seeded, stable) ──────────────────────────────────
            const rng = mulberry32(hashStr(bed.id));
            const dotCount = bed.plantCount > 0 ? Math.min(24, Math.max(3, bed.plantCount * 2)) : 0;
            const dots = Array.from({ length: dotCount }, () => ({
              wx: bx + BOARD + rng() * (W - BOARD * 2),
              wy: by + BOARD + rng() * (D - BOARD * 2),
            }));

            // ── Label ────────────────────────────────────────────────────────
            const lp = pr(bx + W / 2, by + D / 2, Z + 0.1);
            const fs = Math.min(22, Math.max(10, (W * TW * 0.55) / Math.max(2, bed.name.length)));

            return (
              <g
                key={bed.id}
                filter={`url(#${isD ? "shd-d" : isH ? "shd-h" : "shd-n"})`}
                style={{ cursor: isD ? "grabbing" : "grab" }}
                onPointerDown={(e) => onBedPointerDown(e, bed)}
                onPointerEnter={() => !dragging && setHoveredBed(bed.id)}
                onPointerLeave={() => setHoveredBed(null)}
              >
                {/* Side faces (drawn before top so top covers them) */}
                <polygon points={yFace} fill={WOOD_SIDE1} />
                <polygon points={xFace} fill={WOOD_SIDE2} />

                {/* Wood frame boards on top surface */}
                <polygon points={nBoard} fill={WOOD_TOP} />
                <polygon points={sBoard} fill={WOOD_TOP} />
                <polygon points={wBoard} fill={WOOD_TOP} />
                <polygon points={eBoard} fill={WOOD_TOP} />

                {/* Soil */}
                <polygon points={soil} fill="url(#soil-tex)" />

                {/* Plant dots */}
                {dots.map((d, i) => {
                  const p = pr(d.wx, d.wy, Z);
                  return (
                    <g key={i} style={{ pointerEvents: "none" }}>
                      <circle cx={p.sx} cy={p.sy} r={4.5} fill={DOT_OUTER} opacity={0.88} />
                      <circle cx={p.sx - 1} cy={p.sy - 1} r={2} fill={DOT_INNER} opacity={0.75} />
                    </g>
                  );
                })}

                {/* Hover highlight */}
                {(isH || isD) && (
                  <polygon points={topLine} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth={2} />
                )}

                {/* Label */}
                <text
                  x={lp.sx} y={lp.sy}
                  textAnchor="middle" dominantBaseline="middle"
                  fill={LABEL_CLR} fontSize={fs} fontWeight="600"
                  fontFamily="Georgia, 'Times New Roman', serif"
                  filter="url(#txt-shd)"
                  style={{ pointerEvents: "none" }}
                >
                  {bed.name}
                </text>
                {bed.plantCount > 0 && (
                  <text
                    x={lp.sx} y={lp.sy + fs + 2}
                    textAnchor="middle" dominantBaseline="middle"
                    fill={LABEL_CLR} fillOpacity={0.6}
                    fontSize={Math.max(8, fs * 0.68)}
                    fontFamily="system-ui, sans-serif"
                    style={{ pointerEvents: "none" }}
                  >
                    {bed.plantCount} {bed.plantCount === 1 ? "plant" : "plants"}
                  </text>
                )}
              </g>
            );
          })}

          {beds.length === 0 && (() => {
            const c = pr(GW / 2, GH / 2);
            return (
              <text
                x={c.sx} y={c.sy}
                textAnchor="middle" dominantBaseline="middle"
                fill="rgba(255,255,255,0.4)" fontSize={14}
                fontFamily="Georgia, serif"
              >
                Add a bed to get started
              </text>
            );
          })()}
        </g>
      </svg>

      {/* Controls */}
      <div className="absolute bottom-2 right-3 flex flex-col gap-1 z-10">
        {([
          { icon: RotateCcw, label: "Rotate left",  fn: () => { setAzimuth((a) => a + Math.PI / 2); resetView(); } },
          { icon: RotateCw,  label: "Rotate right", fn: () => { setAzimuth((a) => a - Math.PI / 2); resetView(); } },
          null,
          { icon: ZoomIn,    label: "Zoom in",  fn: () => applyZoom(zoom * 1.35) },
          { icon: ZoomOut,   label: "Zoom out", fn: () => applyZoom(zoom / 1.35) },
          null,
          { icon: Maximize2, label: "Reset",    fn: () => { resetView(); setAzimuth(INITIAL_AZ); setElevation(INITIAL_EL); } },
        ] as const).map((ctrl, i) =>
          ctrl === null ? (
            <div key={i} className="h-px mx-1 my-0.5" style={{ background: "rgba(255,255,255,0.15)" }} />
          ) : (
            <button
              key={i}
              onClick={ctrl.fn}
              title={ctrl.label}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", color: "rgba(255,255,255,0.7)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.7)";
                (e.currentTarget as HTMLButtonElement).style.color = "#fff";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.45)";
                (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.7)";
              }}
            >
              <ctrl.icon size={13} />
            </button>
          )
        )}
      </div>
      </div>

      <p
        className="text-[11px] text-center py-2 border-t select-none"
        style={{ color: "#6b8f47", borderColor: "#2a4018", background: "#19280e" }}
      >
        Drag left/right to rotate · Drag up/down to tilt · Scroll to zoom
      </p>
    </div>
  );
}
