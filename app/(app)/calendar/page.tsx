import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { gardenAccessFilter } from "@/lib/permissions";
import { CalendarTimeline, type CalendarEvent } from "@/components/calendar/CalendarTimeline";
import { WeatherWidget } from "@/components/calendar/WeatherWidget";
import { FrostAlert } from "@/components/calendar/FrostAlert";
import {
  calculateStartSeedsDate,
  calculateTransplantDate,
} from "@/lib/services/planting-calendar";
import { fetchCurrentWeather, fetchForecast, hasFrostRisk } from "@/lib/api/weather";
import type { CurrentWeather, ForecastDay } from "@/lib/api/weather";
import { getSuccessionSuggestions } from "@/lib/services/succession";
import Link from "next/link";
import { MapPin, Sprout } from "lucide-react";

const THREE_HOURS = 3 * 60 * 60 * 1000;

export default async function CalendarPage() {
  const user = await requireUser();

  // Fetch all gardens with active seasons and their plantings
  const gardens = await db.garden.findMany({
    where: gardenAccessFilter(user.id),
    include: {
      beds: {
        include: {
          cells: {
            include: {
              plantings: {
                where: { season: { isActive: true } },
                include: {
                  plant: {
                    select: {
                      id: true,
                      name: true,
                      indoorStartWeeks: true,
                      transplantWeeks: true,
                      daysToMaturity: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      weatherCache: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Use the first garden with a zip for weather
  const weatherGarden = gardens.find((g) => g.locationZip);
  let current: CurrentWeather | null = null;
  let forecast: ForecastDay[] | null = null;

  if (weatherGarden) {
    const cacheAge = weatherGarden.weatherCache
      ? Date.now() - new Date(weatherGarden.weatherCache.updatedAt).getTime()
      : Infinity;

    if (cacheAge > THREE_HOURS) {
      // Refresh from API and store in cache
      const [newCurrent, newForecast] = await Promise.all([
        fetchCurrentWeather(weatherGarden.locationZip!),
        fetchForecast(weatherGarden.locationZip!),
      ]);

      if (newCurrent || newForecast) {
        await db.weatherCache.upsert({
          where: { gardenId: weatherGarden.id },
          create: {
            gardenId: weatherGarden.id,
            current: newCurrent ?? {},
            forecast: newForecast ?? [],
          },
          update: {
            current: newCurrent ?? {},
            forecast: newForecast ?? [],
          },
        });
        current = newCurrent;
        forecast = newForecast;
      }
    } else {
      // Serve from cache
      current = weatherGarden.weatherCache?.current as CurrentWeather | null;
      const rawForecast = weatherGarden.weatherCache?.forecast;
      forecast = Array.isArray(rawForecast) ? (rawForecast as ForecastDay[]) : null;
    }
  }

  // Build calendar events from all active-season plantings
  const events: CalendarEvent[] = [];
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() + 12); // show next 12 months

  for (const garden of gardens) {
    if (!garden.lastFrostDate) continue;

    for (const bed of garden.beds) {
      for (const cell of bed.cells) {
        for (const planting of cell.plantings) {
          const { plant } = planting;

          // Start seeds
          if (plant.indoorStartWeeks) {
            const d = calculateStartSeedsDate(garden.lastFrostDate, plant.indoorStartWeeks);
            if (d >= now && d <= cutoff) {
              events.push({
                date: d,
                type: "START_SEEDS",
                plantName: plant.name,
                plantId: plant.id,
                bedName: bed.name,
                gardenName: garden.name,
              });
            }
          }

          // Transplant
          if (plant.transplantWeeks != null) {
            const d = calculateTransplantDate(garden.lastFrostDate, plant.transplantWeeks);
            if (d >= now && d <= cutoff) {
              events.push({
                date: d,
                type: "TRANSPLANT",
                plantName: plant.name,
                plantId: plant.id,
                bedName: bed.name,
                gardenName: garden.name,
              });
            }
          }

          // Harvest — use stored expectedHarvestDate if set
          const harvestDate = planting.expectedHarvestDate;
          if (harvestDate && harvestDate >= now && harvestDate <= cutoff) {
            events.push({
              date: harvestDate,
              type: "HARVEST",
              plantName: plant.name,
              plantId: plant.id,
              bedName: bed.name,
              gardenName: garden.name,
            });
          }
        }
      }
    }
  }

  events.sort((a, b) => +a.date - +b.date);

  // Succession suggestions
  const allActivePlantings = gardens.flatMap((g) =>
    g.beds.flatMap((b) =>
      b.cells.flatMap((c) =>
        c.plantings.map((p) => ({
          plant: p.plant,
          plantedDate: p.plantedDate,
          expectedHarvestDate: p.expectedHarvestDate,
          bedName: b.name,
          gardenName: g.name,
        }))
      )
    )
  );
  const firstFrostDate = gardens.find((g) => g.firstFrostDate)?.firstFrostDate ?? null;
  const successionSuggestions = getSuccessionSuggestions(allActivePlantings, firstFrostDate);

  // Active planting count for frost alert
  const activePlantingCount = gardens.reduce(
    (sum, g) =>
      sum +
      g.beds.reduce(
        (s, b) => s + b.cells.reduce((c, cell) => c + cell.plantings.length, 0),
        0
      ),
    0
  );

  const hasFrost = forecast ? hasFrostRisk(forecast) : false;

  const hasNoFrostDate = gardens.some((g) => !g.lastFrostDate);
  const settingsLinkGarden =
    gardens.find((g) => !g.locationZip) ??
    gardens.find((g) => !g.lastFrostDate) ??
    gardens[0];
  const settingsHref = settingsLinkGarden
    ? `/garden/${settingsLinkGarden.id}/settings`
    : "/garden";

  return (
    <div className="container-narrow">
      {/* Page header */}
      <div className="px-[22px] md:px-8 pt-6 pb-5" style={{ borderBottom: "1px solid #E4E4DC" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#7DA84E", marginBottom: "6px" }}>
          <span style={{ display: "block", width: "16px", height: "1.5px", background: "#7DA84E", borderRadius: "1px", flexShrink: 0 }} />
          Planning
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px, 4vw, 30px)", fontWeight: 800, color: "#111109", letterSpacing: "-0.03em", lineHeight: 1, fontVariationSettings: "'opsz' 32" }}>
          Planting <em style={{ fontStyle: "italic", color: "#1C3D0A" }}>Calendar</em>
        </h1>
      </div>

      <div className="px-[22px] md:px-8 py-5">
      <div className="space-y-4 mb-8">
        {/* Frost alert */}
        {hasFrost && forecast && (
          <FrostAlert forecast={forecast} activePlantingCount={activePlantingCount} />
        )}

        {/* Weather */}
        {weatherGarden ? (
          <WeatherWidget
            current={current}
            forecast={forecast}
            locationDisplay={weatherGarden.locationDisplay ?? weatherGarden.locationZip}
          />
        ) : (
          <div className="bg-[#F4F4EC] rounded-xl border border-dashed border-[#E4E4DC] p-4 flex items-center gap-3">
            <MapPin className="w-4 h-4 text-[#ADADAA] shrink-0" />
            <p className="text-sm text-[#ADADAA]">
              Add your zip code in{" "}
              <Link href={settingsHref} className="text-[#D4820A] hover:underline">
                garden settings
              </Link>{" "}
              to see weather and frost alerts.
            </p>
          </div>
        )}
      </div>

      {/* No frost date warning */}
      {hasNoFrostDate && gardens.length > 0 && (
        <div className="mb-6 p-3 bg-[#FFF8E7] border border-yellow-200 rounded-xl text-sm text-[#6B6B5A]">
          Some gardens are missing frost dates — planting calendar events may be incomplete.{" "}
          <Link href={settingsHref} className="text-[#D4820A] hover:underline">
            Update garden settings →
          </Link>
        </div>
      )}

      {/* Succession suggestions */}
      {successionSuggestions.length > 0 && (
        <div className="mb-8">
          <h2 className="font-display text-lg font-semibold text-[#111109] mb-3 pb-2 border-b border-[#E4E4DC]">
            Succession opportunities
          </h2>
          <div className="space-y-2">
            {successionSuggestions.map((s, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 bg-[#F4F4EC] rounded-xl border border-[#E4E4DC]"
              >
                <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-white border border-[#E4E4DC]">
                  <Sprout className="w-4 h-4 text-[#7DA84E]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#111109]">
                    Plant another round of{" "}
                    <Link href={`/plants/${s.plantId}`} className="hover:text-[#1C3D0A] transition-colors">
                      {s.plantName}
                    </Link>
                  </p>
                  <p className="text-xs text-[#ADADAA] mt-0.5">
                    {s.gardenName} · {s.bedName} · {s.daysToMaturity} days ·{" "}
                    Plant by{" "}
                    {s.suggestedPlantDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
                    → harvest{" "}
                    {s.estimatedHarvest.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <CalendarTimeline events={events} activePlantingCount={activePlantingCount} />
      </div>
    </div>
  );
}
