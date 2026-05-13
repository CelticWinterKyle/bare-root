import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Sprout, CalendarDays, Settings } from "lucide-react";
import { AddBedDialog } from "@/components/garden/AddBedDialog";
import { GardenOverview } from "@/components/canvas/GardenOverview";
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
    where: { id: gardenId, userId: user.id },
    include: {
      beds: {
        include: {
          cells: {
            include: {
              plantings: {
                where: { season: { isActive: true } },
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
  const atBedLimit = user.subscriptionTier === "FREE" && bedCount >= 3;

  // Compact weather strip — fetch if stale or missing
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
    plantCount: bed.cells.reduce((sum, c) => sum + c.plantings.length, 0),
  }));

  // Split garden name into italic first word + rest
  const nameParts = garden.name.trim().split(/\s+/);
  const nameFirst = nameParts[0];
  const nameRest = nameParts.slice(1).join(" ");

  const BED_ACCENTS = ["#1C3D0A", "#D4820A", "#7DA84E"];

  return (
    <div>
      {/* Page hero */}
      <div style={{ padding: "24px 22px 20px", background: "#FDFDF8", borderBottom: "1px solid #E4E4DC" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
          <div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#7DA84E", marginBottom: "6px" }}>
              My Garden
            </p>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "34px",
                fontWeight: 800,
                color: "#111109",
                letterSpacing: "-0.03em",
                lineHeight: 0.95,
                fontVariationSettings: "'opsz' 36",
              }}
            >
              <em style={{ fontStyle: "italic", color: "#1C3D0A" }}>{nameFirst}</em>
              {nameRest ? <> {nameRest}</> : null}
            </h1>
            {/* Tag pills */}
            <div style={{ display: "flex", gap: "6px", marginTop: "10px", flexWrap: "wrap" as const, alignItems: "center" }}>
              {garden.usdaZone && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "#1C3D0A", border: "1.5px solid #D4E8BE", background: "#E4F0D4", padding: "3px 8px", borderRadius: "100px" }}>
                  Zone {garden.usdaZone}
                </span>
              )}
              {activeSeason && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "#D4820A", border: "1.5px solid rgba(212,130,10,0.3)", background: "#FDF2E0", padding: "3px 8px", borderRadius: "100px" }}>
                  {activeSeason.name}
                </span>
              )}
              {garden.lastFrostDate && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "#6B6B5A", border: "1.5px solid #E4E4DC", background: "transparent", padding: "3px 8px", borderRadius: "100px" }}>
                  Last frost {formatFrostDate(garden.lastFrostDate)}
                </span>
              )}
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "#ADADAA", padding: "3px 0" }}>
                {garden.widthFt} × {garden.heightFt} ft
              </span>
            </div>
          </div>
          {/* Header actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, marginTop: "4px" }}>
            <Link
              href={`/garden/${gardenId}/seasons`}
              style={{ display: "flex", alignItems: "center", gap: "6px", fontFamily: "var(--font-mono)", fontSize: "11px", color: "#6B6B5A", letterSpacing: "0.04em", textDecoration: "none" }}
            >
              <CalendarDays style={{ width: "14px", height: "14px" }} />
              {activeSeason ? activeSeason.name : "Seasons"}
            </Link>
            {!atBedLimit && <AddBedDialog gardenId={garden.id} />}
            <Link
              href={`/garden/${gardenId}/settings`}
              style={{ color: "#ADADAA" }}
              aria-label="Garden settings"
            >
              <Settings style={{ width: "16px", height: "16px" }} />
            </Link>
          </div>
        </div>
      </div>

      {/* Weather card */}
      {weatherCurrent ? (
        <div
          style={{
            margin: "12px 22px",
            padding: "14px 16px",
            background: "#1C3D0A",
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", right: "-20px", top: "-20px", width: "100px", height: "100px", borderRadius: "50%", background: "#3A6B20", opacity: 0.35 }} />
          <div style={{ position: "absolute", right: "20px", bottom: "-30px", width: "70px", height: "70px", borderRadius: "50%", background: "#7DA84E", opacity: 0.2 }} />

          <div style={{ fontFamily: "var(--font-display)", fontSize: "36px", fontWeight: 300, color: "white", lineHeight: 1, position: "relative", zIndex: 1 }}>
            {weatherCurrent.temp}<sup style={{ fontSize: "16px" }}>°</sup>
          </div>

          <div style={{ flex: 1, position: "relative", zIndex: 1 }}>
            <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.8)", fontWeight: 500, textTransform: "capitalize" as const }}>
              {weatherCurrent.description}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", textTransform: "uppercase" as const, letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", marginTop: "2px" }}>
              {garden.usdaZone ? `Zone ${garden.usdaZone}` : ""}{garden.locationZip ? ` · ${garden.locationZip}` : ""}
            </div>
          </div>

          {frostRisk && (
            <div style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "8px", padding: "4px 8px", fontFamily: "var(--font-mono)", fontSize: "9px", textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "#A8D8FF", zIndex: 1, position: "relative" as const }}>
              ⚠ Frost Risk
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            margin: "12px 22px", padding: "14px 16px",
            background: "#1C3D0A", borderRadius: "12px",
            display: "flex", alignItems: "center", gap: "12px",
            position: "relative", overflow: "hidden",
          }}
        >
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
            {garden.locationZip && (
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginTop: "2px" }}>
                {garden.usdaZone ? `Zone ${garden.usdaZone}` : ""}{garden.locationZip ? ` · ${garden.locationZip}` : ""}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Canvas */}
      {garden.beds.length === 0 ? (
        <div style={{ margin: "12px 22px" }}>
          <div
            style={{ borderRadius: "12px", padding: "48px 32px", textAlign: "center", background: "#F4F4EC", border: "1px solid #E4E4DC" }}
          >
            <Sprout style={{ width: "40px", height: "40px", margin: "0 auto 12px", color: "#7DA84E" }} />
            <p style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 700, color: "#1C3D0A", marginBottom: "6px", fontVariationSettings: "'opsz' 22" }}>
              No beds yet
            </p>
            <p style={{ fontSize: "14px", color: "#6B6B5A", marginBottom: "16px" }}>
              Add your first raised bed to start planning.
            </p>
            <AddBedDialog gardenId={garden.id} />
          </div>
        </div>
      ) : (
        <div style={{ margin: "12px 22px", borderRadius: "12px", overflow: "hidden", border: "1.5px solid #E4E4DC", position: "relative", boxShadow: "0 2px 16px rgba(28,61,10,0.08)" }}>
          {/* Frosted topbar overlay */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "28px", background: "rgba(253,253,248,0.92)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px", borderBottom: "1px solid rgba(228,228,220,0.8)", zIndex: 2 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", textTransform: "uppercase" as const, letterSpacing: "0.14em", color: "#6B6B5A" }}>Garden Canvas</span>
            <Link href={`/garden/${gardenId}/settings`} style={{ fontFamily: "var(--font-mono)", fontSize: "8px", textTransform: "uppercase" as const, letterSpacing: "0.1em", color: "#ADADAA", textDecoration: "none" }}>
              {garden.name}
            </Link>
          </div>
          <GardenOverview
            garden={{ id: garden.id, widthFt: garden.widthFt, heightFt: garden.heightFt }}
            beds={beds}
          />
        </div>
      )}

      {/* Beds section */}
      {garden.beds.length > 0 && (
        <>
          <div style={{ padding: "16px 22px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 700, color: "#111109", letterSpacing: "-0.02em" }}>Beds</h2>
            {!atBedLimit && <AddBedDialog gardenId={garden.id} />}
          </div>

          {beds.map((bed, index) => (
            <Link
              key={bed.id}
              href={`/garden/${gardenId}/beds/${bed.id}`}
              style={{ textDecoration: "none", display: "block", margin: "0 22px 8px" }}
            >
              <div style={{ borderRadius: "10px", overflow: "hidden", border: "1px solid #E4E4DC", background: "#FDFDF8", display: "flex", cursor: "pointer", boxShadow: "0 1px 4px rgba(28,61,10,0.04)" }}>
                <div style={{ width: "4px", flexShrink: 0, background: BED_ACCENTS[index % 3] }} />
                <div style={{ flex: 1, padding: "12px 14px", display: "flex", flexDirection: "column" as const, gap: "3px" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 700, color: "#111109", letterSpacing: "-0.01em" }}>{bed.name}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", textTransform: "uppercase" as const, letterSpacing: "0.06em", color: "#6B6B5A" }}>
                    {bed.widthFt} × {bed.heightFt} ft · {activeSeason?.name ?? "No season"}
                  </div>
                </div>
                <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column" as const, alignItems: "flex-end", justifyContent: "center", gap: "4px" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 800, color: "#111109", lineHeight: 1 }}>{bed.plantCount}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", textTransform: "uppercase" as const, letterSpacing: "0.1em", color: "#6B6B5A" }}>plants</div>
                </div>
              </div>
            </Link>
          ))}
        </>
      )}

      <div style={{ maxWidth: "768px", margin: "0 auto", padding: "0 22px 32px" }}>
        {!activeSeason && garden.beds.length > 0 && (
          <div
            style={{ marginTop: "16px", borderRadius: "12px", padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", background: "#F4F4EC", border: "1px solid #E4E4DC" }}
          >
            <p style={{ fontSize: "14px", color: "#6B6B5A" }}>No active season — create one to start assigning plants.</p>
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

function formatFrostDate(mmdd: string): string {
  const [m, d] = mmdd.split("-").map(Number);
  return new Date(2000, m - 1, d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
}
