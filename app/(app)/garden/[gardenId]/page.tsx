import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, Sprout, CalendarDays, Snowflake, Thermometer, Settings } from "lucide-react";
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

  return (
    <div>
      <div className="max-w-3xl mx-auto px-4 pt-8 pb-6">
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono uppercase mb-1" style={{ fontSize: "9px", color: "#7DA84E", letterSpacing: "0.18em" }}>
              Garden
            </p>
            <h1
              className="font-display font-bold leading-none"
              style={{ fontSize: "2rem", color: "#111109", letterSpacing: "-0.03em", fontVariationSettings: "'opsz' 36" }}
            >
              {garden.name}
            </h1>
            <div className="flex items-center gap-3 mt-1.5 font-mono" style={{ fontSize: "11px", color: "#6B6B5A" }}>
              {garden.usdaZone && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" style={{ color: "#ADADAA" }} />
                  Zone {garden.usdaZone}
                </span>
              )}
              {garden.lastFrostDate && (
                <span>Last frost {formatFrostDate(garden.lastFrostDate)}</span>
              )}
              <span>{garden.widthFt} × {garden.heightFt} ft</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-1">
            <Link
              href={`/garden/${gardenId}/seasons`}
              className="flex items-center gap-1.5 font-mono transition-colors"
              style={{ fontSize: "11px", color: "#6B6B5A", letterSpacing: "0.04em" }}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              {activeSeason ? activeSeason.name : "Seasons"}
            </Link>
            {!atBedLimit && <AddBedDialog gardenId={garden.id} />}
            <Link
              href={`/garden/${gardenId}/settings`}
              className="transition-colors"
              style={{ color: "#ADADAA" }}
              aria-label="Garden settings"
            >
              <Settings className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Weather strip */}
      {weatherCurrent ? (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl mb-6 relative overflow-hidden"
          style={{
            background: frostRisk ? "#1A3055" : "#1C3D0A",
            border: `1px solid ${frostRisk ? "#2A4875" : "#2A5010"}`,
          }}
        >
          <div
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full pointer-events-none"
            style={{ width: 80, height: 80, background: frostRisk ? "rgba(100,160,255,0.08)" : "rgba(125,168,78,0.12)" }}
          />
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: frostRisk ? "rgba(100,160,255,0.15)" : "rgba(125,168,78,0.15)" }}
          >
            {frostRisk ? (
              <Snowflake className="w-4 h-4" style={{ color: "#7EB8F5" }} />
            ) : (
              <Thermometer className="w-4 h-4" style={{ color: "#A8D870" }} />
            )}
          </div>
          <div className="flex-1 min-w-0 relative">
            <p className="text-sm font-semibold" style={{ color: "#FDFDF8" }}>
              {weatherCurrent.temp}°F · <span className="capitalize">{weatherCurrent.description}</span>
            </p>
            {frostRisk && (
              <p className="text-xs mt-0.5 font-medium" style={{ color: "rgba(126,184,245,0.85)" }}>
                Frost risk in the next 72 hours — protect tender plants
              </p>
            )}
          </div>
          {weatherCurrent.icon && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`https://openweathermap.org/img/wn/${weatherCurrent.icon}.png`}
              alt={weatherCurrent.description}
              width={40}
              height={40}
              className="shrink-0 -my-1 relative"
            />
          )}
        </div>
      ) : (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl mb-6"
          style={{ background: "#F4F4EC", border: "1px solid #E4E4DC" }}
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#EAEADE" }}>
            <Thermometer className="w-4 h-4" style={{ color: "#ADADAA" }} />
          </div>
          <p className="text-sm" style={{ color: "#6B6B5A" }}>
            {garden.locationZip
              ? "Weather data temporarily unavailable."
              : <>
                  Add a zip code in{" "}
                  <Link href={`/garden/${gardenId}/settings`} style={{ color: "#7DA84E" }} className="underline transition-colors">
                    garden settings
                  </Link>
                  {" "}for local weather and frost alerts.
                </>
            }
          </p>
        </div>
      )}

      </div>

      {/* Canvas */}
      {garden.beds.length === 0 ? (
        <div className="max-w-3xl mx-auto px-4">
          <div
            className="rounded-xl p-12 text-center"
            style={{ background: "#F4F4EC", border: "1px solid #E4E4DC" }}
          >
            <Sprout className="w-10 h-10 mx-auto mb-3" style={{ color: "#7DA84E" }} />
            <p className="font-display text-lg font-semibold mb-1" style={{ color: "#1C3D0A", fontVariationSettings: "'opsz' 22" }}>
              No beds yet
            </p>
            <p className="text-sm mb-4" style={{ color: "#6B6B5A" }}>
              Add your first raised bed to start planning.
            </p>
            <AddBedDialog gardenId={garden.id} />
          </div>
        </div>
      ) : (
        <div className="px-4">
          <GardenOverview
            garden={{ id: garden.id, widthFt: garden.widthFt, heightFt: garden.heightFt }}
            beds={beds}
          />
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 pb-8">
        {!activeSeason && garden.beds.length > 0 && (
          <div
            className="mt-4 rounded-xl p-4 flex items-center justify-between gap-4"
            style={{ background: "#F4F4EC", border: "1px solid #E4E4DC" }}
          >
            <p className="text-sm" style={{ color: "#6B6B5A" }}>No active season — create one to start assigning plants.</p>
            <CreateSeasonDialog gardenId={garden.id} hasActiveSeason={false} />
          </div>
        )}

        {atBedLimit && (
          <div className="mt-4 rounded-xl p-4 text-center" style={{ border: "1px dashed #D4E8BE" }}>
            <p className="text-sm" style={{ color: "#ADADAA" }}>
              3 beds used on Free plan.{" "}
              <Link href="/settings/billing" style={{ color: "#D4820A" }} className="hover:underline">
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
