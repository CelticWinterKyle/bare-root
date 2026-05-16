import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { gardenAccessFilter } from "@/lib/permissions";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Sprout } from "lucide-react";
import { AddBedDialog } from "@/components/garden/AddBedDialog";
import { GardenCanvasToggle } from "@/components/canvas/GardenCanvasToggle";
import { CreateSeasonDialog } from "@/components/seasons/CreateSeasonDialog";
import { fetchCurrentWeather, fetchForecast, hasFrostRisk } from "@/lib/api/weather";
import type { CurrentWeather, ForecastDay } from "@/lib/api/weather";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ gardenId: string }>;
}): Promise<Metadata> {
  const { gardenId } = await params;
  const garden = await db.garden.findUnique({ where: { id: gardenId }, select: { name: true } });
  return { title: garden ? `${garden.name} | Bare Root` : "Bare Root" };
}

export default async function GardenPage({
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
        include: {
          cells: {
            orderBy: [{ row: "asc" }, { col: "asc" }],
            include: {
              // PlantingCell is the source of truth — counts both primary
              // (anchor) cells AND footprint cells of multi-cell plants.
              // The legacy `plantings` relation only catches anchors, which
              // undercounts on beds with 2×2 tomatoes. We also pull the
              // plant category so the 2D top-down view can colour each
              // occupied cell by crop type without an extra round-trip.
              occupiedBy: {
                where: { planting: { season: { isActive: true } } },
                select: {
                  plantingId: true,
                  isPrimary: true,
                  planting: {
                    select: {
                      plant: { select: { category: true } },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      seasons: { where: { isActive: true }, take: 1 },
      weatherCache: true,
    },
  });

  if (!garden) notFound();

  const activeSeason = garden.seasons[0];
  const bedCount = garden.beds.length;

  // Bed limit follows the OWNER's tier, not the viewer's. Otherwise a
  // free-plan collaborator viewing a Pro owner's 5-bed garden would
  // mistakenly hit the 3-bed limit.
  const isOwner = garden.userId === user.id;
  const ownerTier = isOwner
    ? user.subscriptionTier
    : (await db.user.findUnique({
        where: { id: garden.userId },
        select: { subscriptionTier: true },
      }))?.subscriptionTier ?? "FREE";
  const atBedLimit = ownerTier === "FREE" && bedCount >= 3;

  let weatherCurrent: CurrentWeather | null = null;
  let weatherForecast: ForecastDay[] | null = null;
  if (garden.locationZip) {
    const THREE_HOURS = 3 * 60 * 60 * 1000;
    const cacheAge = garden.weatherCache
      ? Date.now() - new Date(garden.weatherCache.updatedAt).getTime()
      : Infinity;

    if (cacheAge > THREE_HOURS) {
      const [c, f] = await Promise.all([
        fetchCurrentWeather(garden.locationZip),
        fetchForecast(garden.locationZip),
      ]);
      weatherCurrent = c;
      weatherForecast = f;
      if (c || f) {
        await db.weatherCache.upsert({
          where: { gardenId: garden.id },
          create: { gardenId: garden.id, current: c ?? {}, forecast: f ?? [] },
          update: { current: c ?? {}, forecast: f ?? [] },
        });
      }
    } else {
      weatherCurrent = garden.weatherCache?.current as CurrentWeather | null;
      const raw = garden.weatherCache?.forecast;
      weatherForecast = Array.isArray(raw) ? (raw as ForecastDay[]) : null;
    }
  }
  const frostRisk = weatherForecast ? hasFrostRisk(weatherForecast) : false;

  const beds = garden.beds.map((bed) => ({
    id: bed.id,
    name: bed.name,
    xPosition: bed.xPosition,
    yPosition: bed.yPosition,
    widthFt: bed.widthFt,
    heightFt: bed.heightFt,
    gridCols: bed.gridCols,
    gridRows: bed.gridRows,
    // Number of CELLS occupied (so a 2×2 tomato shows as 4, not 1).
    // Matches what Robyn sees on the grid.
    plantCount: bed.cells.reduce((sum, c) => sum + c.occupiedBy.length, 0),
    // Per-cell occupancy used by the 2D top-down render — each occupied
    // cell becomes a colored square; the 3D iso view ignores this field.
    cells: bed.cells.map((c) => ({
      row: c.row,
      col: c.col,
      occupants: c.occupiedBy.map((o) => ({
        plantingId: o.plantingId,
        isPrimary: o.isPrimary,
        category: o.planting.plant.category as string,
      })),
    })),
  }));

  const totalPlantCount = beds.reduce((sum, b) => sum + b.plantCount, 0);

  const BED_ACCENTS = ["#1C3D0A", "#D4820A", "#7DA84E"];

  // ── Tag pill shared styles ─────────────────────────────────────────────────
  const tagBase: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: "9px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    padding: "3px 8px",
    borderRadius: "100px",
    border: "1px solid",
    whiteSpace: "nowrap",
  };
  const tagGreen: React.CSSProperties = { ...tagBase, color: "#1C3D0A", borderColor: "#D4E8BE", background: "#E4F0D4" };
  const tagAmber: React.CSSProperties = { ...tagBase, color: "#D4820A", borderColor: "rgba(212,130,10,0.2)", background: "#FDF2E0" };
  const tagGhost: React.CSSProperties = { ...tagBase, color: "#6B6B5A", borderColor: "#E4E4DC", background: "transparent" };

  // ── Button shared styles ───────────────────────────────────────────────────
  const btnBase: React.CSSProperties = {
    fontFamily: "var(--font-body)",
    fontSize: "12px",
    fontWeight: 600,
    padding: "7px 16px",
    borderRadius: "8px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "5px",
    border: "1.5px solid",
    textDecoration: "none",
    lineHeight: 1.2,
    flexShrink: 0,
  };
  const btnGhost: React.CSSProperties = { ...btnBase, background: "transparent", color: "#3A3A30", borderColor: "#E4E4DC" };

  return (
    <div className="container-wide">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div style={{ borderBottom: "1px solid #E4E4DC" }}>
        <div className="flex items-start justify-between gap-4 px-[22px] md:px-8 pt-6 pb-5">
          <div>
            {/* Eyebrow with dash */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#7DA84E", marginBottom: "6px" }}>
              <span style={{ display: "block", width: "16px", height: "1.5px", background: "#7DA84E", borderRadius: "1px", flexShrink: 0 }} />
              My Garden
            </div>
            {/* Title */}
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px, 4vw, 30px)", fontWeight: 800, color: "#111109", letterSpacing: "-0.03em", lineHeight: 1 }}>
              {garden.name}
            </h1>
            {/* Tag pills */}
            <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap", alignItems: "center" }}>
              {garden.usdaZone && <span style={tagGreen}>Zone {garden.usdaZone}</span>}
              {activeSeason && <span style={tagAmber}>{activeSeason.name}</span>}
              <span style={tagGhost}>{garden.widthFt} × {garden.heightFt} ft</span>
              {garden.lastFrostDate && (
                <span style={tagGhost}>Last frost {formatFrostDateShort(garden.lastFrostDate)}</span>
              )}
            </div>
          </div>

          {/* Action buttons — desktop only */}
          <div className="hidden md:flex items-start gap-2" style={{ paddingTop: "2px", flexShrink: 0 }}>
            <Link href={`/garden/${gardenId}/settings`} style={btnGhost}>
              ⚙ Settings
            </Link>
            <Link href={`/garden/${gardenId}/seasons`} style={btnGhost}>
              Seasons
            </Link>
            {!atBedLimit && <AddBedDialog gardenId={garden.id} primary />}
          </div>
        </div>

        {/* Mobile-only secondary action row */}
        <div className="md:hidden flex gap-2 px-[22px] pb-4" style={{ marginTop: "-4px" }}>
          <Link
            href={`/garden/${gardenId}/settings`}
            className="flex-1 flex items-center justify-center gap-1.5"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#3A3A30",
              padding: "7px 10px",
              borderRadius: "8px",
              border: "1px solid #E4E4DC",
              background: "#FDFDF8",
              textDecoration: "none",
            }}
          >
            ⚙ Settings
          </Link>
          <Link
            href={`/garden/${gardenId}/seasons`}
            className="flex-1 flex items-center justify-center"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#3A3A30",
              padding: "7px 10px",
              borderRadius: "8px",
              border: "1px solid #E4E4DC",
              background: "#FDFDF8",
              textDecoration: "none",
            }}
          >
            Seasons
          </Link>
        </div>
      </div>

      {/* ── Weather card — mobile only ───────────────────────────────────── */}
      <div className="md:hidden">
        {weatherCurrent ? (
          <div style={{ margin: "12px 22px", padding: "14px 16px", background: "#1C3D0A", borderRadius: "12px", display: "flex", alignItems: "center", gap: "12px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", right: "-20px", top: "-20px", width: "100px", height: "100px", borderRadius: "50%", background: "#3A6B20", opacity: 0.35 }} />
            <div style={{ position: "absolute", right: "20px", bottom: "-30px", width: "70px", height: "70px", borderRadius: "50%", background: "#7DA84E", opacity: 0.2 }} />
            <div style={{ fontFamily: "var(--font-display)", fontSize: "36px", fontWeight: 300, color: "white", lineHeight: 1, position: "relative", zIndex: 1 }}>
              {weatherCurrent.temp}<sup style={{ fontSize: "16px" }}>°</sup>
            </div>
            <div style={{ flex: 1, position: "relative", zIndex: 1 }}>
              <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.8)", fontWeight: 500, textTransform: "capitalize" }}>{weatherCurrent.description}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", marginTop: "2px" }}>
                {garden.usdaZone ? `Zone ${garden.usdaZone}` : ""}{garden.locationZip ? ` · ${garden.locationZip}` : ""}
              </div>
            </div>
            {frostRisk && (
              <div style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "8px", padding: "4px 8px", fontFamily: "var(--font-mono)", fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#A8D8FF", zIndex: 1, position: "relative" }}>
                ⚠ Frost Risk
              </div>
            )}
          </div>
        ) : (
          <div style={{ margin: "12px 22px", padding: "14px 16px", background: "#1C3D0A", borderRadius: "12px", display: "flex", alignItems: "center", gap: "12px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", right: "-20px", top: "-20px", width: "100px", height: "100px", borderRadius: "50%", background: "#3A6B20", opacity: 0.35 }} />
            <div style={{ fontFamily: "var(--font-display)", fontSize: "36px", fontWeight: 300, color: "rgba(255,255,255,0.2)", lineHeight: 1, position: "relative", zIndex: 1 }}>
              —<sup style={{ fontSize: "16px" }}>°</sup>
            </div>
            <div style={{ flex: 1, position: "relative", zIndex: 1 }}>
              <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>
                {garden.locationZip ? "Weather unavailable" : "No location set"}
              </div>
              {!garden.locationZip && (
                <Link href={`/garden/${gardenId}/settings`} style={{ fontFamily: "var(--font-mono)", fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#A8D870", textDecoration: "none", marginTop: "2px", display: "block" }}>
                  Add zip code →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Canvas ───────────────────────────────────────────────────────── */}
      {garden.beds.length === 0 ? (
        <div className="mx-[22px] my-3 md:mx-8 md:my-5">
          <div style={{ borderRadius: "12px", padding: "48px 32px", textAlign: "center", background: "#F4F4EC", border: "1px solid #E4E4DC" }}>
            <Sprout style={{ width: "40px", height: "40px", margin: "0 auto 12px", color: "#7DA84E" }} />
            <p style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 700, color: "#1C3D0A", marginBottom: "6px" }}>
              No beds yet
            </p>
            <p style={{ fontSize: "14px", color: "#6B6B5A", marginBottom: "16px" }}>
              Add your first raised bed to start planning.
            </p>
            <AddBedDialog gardenId={garden.id} />
          </div>
        </div>
      ) : (
        <>
          {/* Canvas card */}
          <div className="md:border-b" style={{ borderColor: "#E4E4DC" }}>
            <div className="md:px-8 md:pt-5 md:pb-5">
              <div
                className="relative overflow-hidden rounded-xl mx-[22px] my-3 md:mx-0 md:my-0"
                style={{ border: "1.5px solid #E4E4DC", background: "#19280e", boxShadow: "0 2px 16px rgba(28,61,10,0.1), inset 0 0 0 1px rgba(255,255,255,0.04)" }}
              >
                {/* Frosted topbar — mobile only */}
                <div
                  className="md:hidden absolute top-0 left-0 right-0 z-[2] flex items-center justify-between"
                  style={{ height: "28px", background: "rgba(253,253,248,0.92)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", padding: "0 10px", borderBottom: "1px solid rgba(228,228,220,0.8)" }}
                >
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", textTransform: "uppercase", letterSpacing: "0.14em", color: "#6B6B5A" }}>Garden Canvas</span>
                  <div style={{ display: "flex", gap: "3px" }}>
                    {(["⊕", "⊖", "⟳"] as const).map((icon) => (
                      <div key={icon} style={{ width: "20px", height: "20px", borderRadius: "4px", background: "rgba(244,244,236,0.8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", color: "#6B6B5A" }}>
                        {icon}
                      </div>
                    ))}
                  </div>
                </div>
                <GardenCanvasToggle
                  garden={{ id: garden.id, widthFt: garden.widthFt, heightFt: garden.heightFt }}
                  beds={beds}
                />
              </div>
            </div>
          </div>

          {/* ── Stats bar — desktop only ───────────────────────────────── */}
          <div
            className="hidden md:grid"
            style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr", borderBottom: "1px solid #E4E4DC" }}
          >
            <div style={{ padding: "14px 20px", borderRight: "1px solid #E4E4DC" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "26px", fontWeight: 800, color: "#111109", lineHeight: 1, letterSpacing: "-0.02em" }}>{bedCount}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#6B6B5A", marginTop: "3px" }}>Raised Beds</div>
            </div>
            <div style={{ padding: "14px 20px", borderRight: "1px solid #E4E4DC" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "26px", fontWeight: 800, color: "#111109", lineHeight: 1, letterSpacing: "-0.02em" }}>{totalPlantCount}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#6B6B5A", marginTop: "3px" }}>Active Plants</div>
            </div>
            <div style={{ padding: "14px 20px", borderRight: "1px solid #E4E4DC" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "26px", fontWeight: 800, color: "#D4820A", lineHeight: 1, letterSpacing: "-0.02em" }}>
                {garden.lastFrostDate ? formatFrostDateShort(garden.lastFrostDate) : "—"}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#6B6B5A", marginTop: "3px" }}>Last Frost</div>
            </div>
            <div style={{ padding: "14px 20px" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "26px", fontWeight: 800, color: "#111109", lineHeight: 1, letterSpacing: "-0.02em" }}>
                {weatherCurrent ? `${weatherCurrent.temp}°` : "—"}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#6B6B5A", marginTop: "3px" }}>Current Temp</div>
            </div>
          </div>

          {/* ── Bed tiles ──────────────────────────────────────────────── */}
          <div className="md:px-8 md:pt-4 md:pb-5">
            {/* Mobile section header */}
            <div className="md:hidden flex items-center justify-between px-[22px] pt-4 pb-2">
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 700, color: "#111109", letterSpacing: "-0.02em" }}>Beds</h2>
              {!atBedLimit && <AddBedDialog gardenId={garden.id} />}
            </div>

            {/* Responsive bed list/grid */}
            <div className="md:grid md:grid-cols-2 md:gap-[10px]">
              {beds.map((bed, index) => (
                <Link
                  key={bed.id}
                  href={`/garden/${gardenId}/beds/${bed.id}`}
                  className="block no-underline mx-[22px] mb-2 md:mx-0 md:mb-0"
                  style={{ textDecoration: "none" }}
                >
                  <div
                    className="relative overflow-hidden rounded-[10px] flex md:block"
                    style={{ border: "1.5px solid #E4E4DC", background: "#FDFDF8", boxShadow: "0 1px 4px rgba(28,61,10,0.04)" }}
                  >
                    {/* Left color bar */}
                    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "4px", background: BED_ACCENTS[index % 3] }} />
                    {/* Content */}
                    <div className="flex-1 flex items-center md:block" style={{ paddingLeft: "20px", paddingRight: "14px", paddingTop: "12px", paddingBottom: "12px" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 800, color: "#111109", letterSpacing: "-0.015em" }}>
                          {bed.name}
                        </div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", letterSpacing: "0.08em", textTransform: "uppercase", color: "#6B6B5A", marginTop: "3px" }}>
                          {bed.widthFt} × {bed.heightFt} ft · {activeSeason?.name ?? "No season"}
                        </div>
                        {/* Plant count — desktop (below meta) */}
                        <div className="hidden md:block" style={{ fontSize: "13px", fontWeight: 600, color: "#7DA84E", marginTop: "5px" }}>
                          {bed.plantCount} {bed.plantCount === 1 ? "plant" : "plants"}
                        </div>
                      </div>
                      {/* Plant count — mobile (right side) */}
                      <div className="md:hidden flex-shrink-0 flex flex-col items-end justify-center gap-1">
                        <div style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 800, color: "#111109", lineHeight: 1 }}>
                          {bed.plantCount}
                        </div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#6B6B5A" }}>
                          plants
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}

              {/* Add Bed tile — desktop only */}
              {!atBedLimit && (
                <div className="hidden md:block">
                  <AddBedDialog gardenId={garden.id} asTile />
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Footer notices ───────────────────────────────────────────────── */}
      <div className="px-[22px] md:px-8 pb-8">
        {!activeSeason && garden.beds.length > 0 && (
          <div style={{ marginTop: "16px", borderRadius: "12px", padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", background: "#F4F4EC", border: "1px solid #E4E4DC", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <p style={{ fontSize: "14px", color: "#111109", fontWeight: 500 }}>No active season</p>
              <p style={{ fontSize: "13px", color: "#6B6B5A", marginTop: "2px" }}>
                Seasons track your plantings across a growing period (e.g. Spring 2026). Create one to start assigning plants to your beds.
              </p>
            </div>
            <CreateSeasonDialog gardenId={garden.id} hasActiveSeason={false} />
          </div>
        )}

        {atBedLimit && (
          <div style={{ marginTop: "16px", borderRadius: "12px", padding: "16px", textAlign: "center", border: "1px dashed #D4E8BE" }}>
            <p style={{ fontSize: "14px", color: "#ADADAA" }}>
              3 beds used on Free plan.{" "}
              <Link href="/settings/billing" style={{ color: "#D4820A" }}>
                Upgrade to Pro
              </Link>{" "}
              for unlimited beds.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function formatFrostDateShort(mmdd: string): string {
  const [m, d] = mmdd.split("-").map(Number);
  return new Date(2000, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
