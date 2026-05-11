import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CalendarTimeline, type CalendarEvent } from "@/components/calendar/CalendarTimeline";
import { WeatherWidget } from "@/components/calendar/WeatherWidget";
import { FrostAlert } from "@/components/calendar/FrostAlert";
import {
  calculateStartSeedsDate,
  calculateTransplantDate,
} from "@/lib/services/planting-calendar";
import { fetchCurrentWeather, fetchForecast, hasFrostRisk } from "@/lib/api/weather";
import type { CurrentWeather, ForecastDay } from "@/lib/api/weather";
import Link from "next/link";
import { MapPin } from "lucide-react";

const THREE_HOURS = 3 * 60 * 60 * 1000;

export default async function CalendarPage() {
  const user = await requireUser();

  // Fetch all gardens with active seasons and their plantings
  const gardens = await db.garden.findMany({
    where: { userId: user.id },
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

  const hasNoLocation = !weatherGarden;
  const hasNoFrostDate = gardens.some((g) => !g.lastFrostDate);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="font-display text-3xl font-semibold text-[#1C1C1A] mb-6">Calendar</h1>

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
          <div className="bg-[#F5F0E8] rounded-xl border border-dashed border-[#E8E2D9] p-4 flex items-center gap-3">
            <MapPin className="w-4 h-4 text-[#9E9890] shrink-0" />
            <p className="text-sm text-[#9E9890]">
              Add your zip code in{" "}
              <Link href="/settings" className="text-[#C4790A] hover:underline">
                garden settings
              </Link>{" "}
              to see weather and frost alerts.
            </p>
          </div>
        )}
      </div>

      {/* No frost date warning */}
      {hasNoFrostDate && gardens.length > 0 && (
        <div className="mb-6 p-3 bg-[#FFF8E7] border border-yellow-200 rounded-xl text-sm text-[#6B6560]">
          Some gardens are missing frost dates — planting calendar events may be incomplete.
        </div>
      )}

      {/* Timeline */}
      <CalendarTimeline events={events} />
    </div>
  );
}
