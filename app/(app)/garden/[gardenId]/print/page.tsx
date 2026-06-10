import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { gardenAccessFilter } from "@/lib/permissions";
import { PrintButton } from "@/components/print/PrintButton";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ gardenId: string }>;
}): Promise<Metadata> {
  const { gardenId } = await params;
  const garden = await db.garden.findUnique({ where: { id: gardenId }, select: { name: true } });
  return { title: garden ? `Print · ${garden.name} | Bare Root` : "Bare Root" };
}

/**
 * Print-first garden plan: header (name, season, frost dates), a minimal
 * black-on-white SVG plot map, then one plain HTML table per bed with the
 * plant + variety in each occupied cell. Pinned-in-the-shed material —
 * everything interactive carries .print-hide, and the app chrome (header,
 * sidebar, bottom nav) is removed via the @media print block below.
 */
export default async function GardenPrintPage({
  params,
}: {
  params: Promise<{ gardenId: string }>;
}) {
  const { gardenId } = await params;
  const user = await requireUser();

  const garden = await db.garden.findFirst({
    where: { id: gardenId, ...gardenAccessFilter(user.id) },
    include: {
      beds: {
        orderBy: { createdAt: "asc" },
        include: {
          cells: {
            orderBy: [{ row: "asc" }, { col: "asc" }],
            include: {
              // Same source of truth as the bed page: PlantingCell covers
              // both anchor cells and footprint cells of multi-cell plants.
              occupiedBy: {
                where: { planting: { season: { isActive: true } } },
                select: {
                  isPrimary: true,
                  planting: {
                    select: { variety: true, plant: { select: { name: true } } },
                  },
                },
              },
            },
          },
        },
      },
      seasons: { where: { isActive: true }, take: 1 },
    },
  });

  if (!garden) notFound();

  const activeSeason = garden.seasons[0] ?? null;
  const printedOn = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  // ── Plot map geometry (same fit math as the dashboard mini-SVG) ──────────
  const svgW = 800;
  const svgH = 380;
  const pad = 24;
  const scale = Math.min((svgW - pad * 2) / garden.widthFt, (svgH - pad * 2) / garden.heightFt);
  const offsetX = (svgW - garden.widthFt * scale) / 2;
  const offsetY = (svgH - garden.heightFt * scale) / 2;

  const mono: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: "9px",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#555",
  };

  return (
    <div className="print-root" style={{ background: "white", minHeight: "100%", color: "#111" }}>
      <style>{`
        @page { margin: 0.5in; }
        @media print {
          /* Remove app chrome: mobile header, desktop sidebar, bottom nav,
             and fixed overlays (PWA prompt, toasts). */
          header, nav, aside, .fixed { display: none !important; }
          .print-hide { display: none !important; }
          body * { visibility: hidden; }
          .print-root, .print-root * { visibility: visible; }
          main { overflow: visible !important; padding: 0 !important; }
          .print-bed { break-inside: avoid; }
        }
      `}</style>

      <div style={{ maxWidth: "780px", margin: "0 auto", padding: "24px 22px 48px" }}>
        {/* Screen-only controls */}
        <div className="print-hide" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <Link
            href={`/garden/${gardenId}`}
            style={{ fontSize: "13px", color: "#6B6B5A", textDecoration: "none" }}
          >
            ← Back to garden
          </Link>
          <PrintButton />
        </div>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{ borderBottom: "2px solid #111", paddingBottom: "12px", marginBottom: "16px" }}>
          <div style={{ ...mono, marginBottom: "4px" }}>Bare Root · Garden plan · Printed {printedOn}</div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "28px", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.05, color: "#111" }}>
            {garden.name}
          </h1>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 18px", marginTop: "8px", ...mono, fontSize: "10px" }}>
            {activeSeason && <span>Season: {activeSeason.name}</span>}
            <span>Plot: {garden.widthFt} × {garden.heightFt} ft</span>
            {garden.usdaZone && <span>Zone {garden.usdaZone}</span>}
            {garden.lastFrostDate && <span>Last frost: {formatFrostDate(garden.lastFrostDate)}</span>}
            {garden.firstFrostDate && <span>First frost: {formatFrostDate(garden.firstFrostDate)}</span>}
          </div>
        </div>

        {/* ── Plot map ────────────────────────────────────────────────────── */}
        {garden.beds.length > 0 && (
          <div style={{ marginBottom: "24px" }}>
            <svg
              viewBox={`0 0 ${svgW} ${svgH}`}
              preserveAspectRatio="xMidYMid meet"
              style={{ width: "100%", height: "auto", display: "block" }}
            >
              <rect
                x={offsetX}
                y={offsetY}
                width={garden.widthFt * scale}
                height={garden.heightFt * scale}
                fill="white"
                stroke="#111"
                strokeWidth="1.5"
                strokeDasharray="6 4"
                rx={4}
              />
              {garden.beds.map((bed) => {
                const bx = offsetX + bed.xPosition * scale;
                const by = offsetY + bed.yPosition * scale;
                const bw = bed.widthFt * scale;
                const bh = bed.heightFt * scale;
                return (
                  <g key={bed.id}>
                    <rect x={bx} y={by} width={bw} height={bh} fill="#F4F4EC" stroke="#111" strokeWidth="1.5" rx={3} />
                    <text
                      x={bx + bw / 2}
                      y={by + bh / 2}
                      textAnchor="middle"
                      fill="#111"
                      fontSize="13"
                      fontWeight="700"
                      fontFamily="Fraunces, Georgia, serif"
                      fontStyle="italic"
                    >
                      {bed.name}
                    </text>
                    <text
                      x={bx + bw / 2}
                      y={by + bh / 2 + 14}
                      textAnchor="middle"
                      fill="#555"
                      fontSize="9"
                      fontFamily="IBM Plex Mono, monospace"
                    >
                      {bed.widthFt}×{bed.heightFt} ft
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}

        {/* ── Per-bed grids ───────────────────────────────────────────────── */}
        {garden.beds.length === 0 ? (
          <p style={{ fontSize: "14px", color: "#555" }}>No beds in this garden yet.</p>
        ) : (
          garden.beds.map((bed) => {
            // (row,col) → first occupant. Footprint cells render the plant
            // name in gray so multi-cell plants read as one block.
            const occupants = new Map<
              string,
              { name: string; variety: string | null; isPrimary: boolean }
            >();
            for (const cell of bed.cells) {
              const o = cell.occupiedBy[0];
              if (o) {
                occupants.set(`${cell.row}-${cell.col}`, {
                  name: o.planting.plant.name,
                  variety: o.planting.variety,
                  isPrimary: o.isPrimary,
                });
              }
            }
            return (
              <div key={bed.id} className="print-bed" style={{ marginBottom: "22px" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "6px" }}>
                  <h2 style={{ fontFamily: "var(--font-display)", fontSize: "17px", fontWeight: 800, color: "#111", letterSpacing: "-0.015em" }}>
                    {bed.name}
                  </h2>
                  <span style={{ ...mono, fontSize: "9px" }}>
                    {bed.widthFt} × {bed.heightFt} ft · {bed.gridRows} × {bed.gridCols} grid
                  </span>
                </div>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    tableLayout: "fixed",
                  }}
                >
                  <tbody>
                    {Array.from({ length: bed.gridRows }, (_, row) => (
                      <tr key={row}>
                        {Array.from({ length: bed.gridCols }, (_, col) => {
                          const occ = occupants.get(`${row}-${col}`);
                          return (
                            <td
                              key={col}
                              style={{
                                border: "1px solid #111",
                                padding: "4px 5px",
                                height: "40px",
                                verticalAlign: "top",
                                fontSize: "10px",
                                lineHeight: 1.25,
                                wordBreak: "break-word",
                              }}
                            >
                              {occ &&
                                (occ.isPrimary ? (
                                  <>
                                    <span style={{ fontWeight: 700, color: "#111" }}>{occ.name}</span>
                                    {occ.variety && (
                                      <span style={{ display: "block", fontStyle: "italic", color: "#555" }}>
                                        {occ.variety}
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <span style={{ color: "#999" }}>{occ.name}</span>
                                ))}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })
        )}

        {/* Footer rule */}
        <div style={{ borderTop: "1px solid #111", marginTop: "8px", paddingTop: "6px", ...mono, fontSize: "8px" }}>
          {garden.name}{activeSeason ? ` · ${activeSeason.name}` : ""} · bareroot
        </div>
      </div>
    </div>
  );
}

function formatFrostDate(mmdd: string): string {
  const [m, d] = mmdd.split("-").map(Number);
  return new Date(2000, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
