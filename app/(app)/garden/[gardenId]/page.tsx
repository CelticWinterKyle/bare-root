import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, Sprout, CalendarDays, Snowflake, Thermometer } from "lucide-react";
import { AddBedDialog } from "@/components/garden/AddBedDialog";
import { GardenOverview } from "@/components/canvas/GardenOverview";
import { CreateSeasonDialog } from "@/components/seasons/CreateSeasonDialog";
import { fetchCurrentWeather, fetchForecast, hasFrostRisk } from "@/lib/api/weather";
import type { CurrentWeather, ForecastDay } from "@/lib/api/weather";

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
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold text-[#1C1C1A]">
              {garden.name}
            </h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-[#6B6560]">
              {garden.usdaZone && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  Zone {garden.usdaZone}
                </span>
              )}
              {garden.lastFrostDate && (
                <span>Last frost {formatFrostDate(garden.lastFrostDate)}</span>
              )}
              <span>
                {garden.widthFt} × {garden.heightFt} ft
              </span>
            </div>
            {activeSeason && (
              <p className="text-xs text-[#9E9890] mt-1">{activeSeason.name}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/garden/${gardenId}/seasons`}
              className="flex items-center gap-1.5 text-sm text-[#6B6560] hover:text-[#2D5016] transition-colors"
            >
              <CalendarDays className="w-4 h-4" />
              {activeSeason ? activeSeason.name : "Seasons"}
            </Link>
            {!atBedLimit && <AddBedDialog gardenId={garden.id} />}
          </div>
        </div>
      </header>

      {/* Compact weather strip */}
      {weatherCurrent && (
        <div className={`flex items-center gap-3 px-4 py-2 rounded-xl mb-4 text-sm ${frostRisk ? "bg-blue-50 border border-blue-200" : "bg-[#F5F0E8] border border-[#E8E2D9]"}`}>
          {frostRisk ? (
            <Snowflake className="w-4 h-4 text-blue-500 shrink-0" />
          ) : (
            <Thermometer className="w-4 h-4 text-[#9E9890] shrink-0" />
          )}
          <span className={frostRisk ? "text-blue-800 font-medium" : "text-[#6B6560]"}>
            {weatherCurrent.temp}°F · {weatherCurrent.description}
            {frostRisk && " · Frost risk in forecast"}
          </span>
        </div>
      )}

      {/* Canvas */}
      {garden.beds.length === 0 ? (
        <div className="bg-[#F5F0E8] rounded-xl p-12 text-center border border-[#E8E2D9]">
          <Sprout className="w-10 h-10 text-[#6B8F47] mx-auto mb-3" />
          <p className="font-display text-lg text-[#2D5016] mb-1">No beds yet</p>
          <p className="text-sm text-[#6B6560] mb-4">
            Add your first raised bed to start planning.
          </p>
          <AddBedDialog gardenId={garden.id} />
        </div>
      ) : (
        <GardenOverview
          garden={{ id: garden.id, widthFt: garden.widthFt, heightFt: garden.heightFt }}
          beds={beds}
        />
      )}

      {!activeSeason && garden.beds.length > 0 && (
        <div className="mt-4 bg-[#F5F0E8] rounded-xl border border-[#E8E2D9] p-4 flex items-center justify-between">
          <p className="text-sm text-[#6B6560]">No active season — create one to start assigning plants.</p>
          <CreateSeasonDialog gardenId={garden.id} hasActiveSeason={false} />
        </div>
      )}

      {atBedLimit && (
        <div className="mt-4 rounded-xl border border-dashed border-[#E8E2D9] p-4 text-center">
          <p className="text-sm text-[#9E9890]">
            3 beds used on Free plan.{" "}
            <Link href="/settings/billing" className="text-[#C4790A] hover:underline">
              Upgrade to Pro
            </Link>{" "}
            for unlimited beds.
          </p>
        </div>
      )}
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
