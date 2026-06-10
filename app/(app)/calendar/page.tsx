import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { gardenAccessFilter, gardenEditFilter } from "@/lib/permissions";
import { SuccessionActions } from "@/components/calendar/SuccessionActions";
import { AddToBedDialog } from "@/components/plants/AddToBedDialog";
import { CalendarTimeline, type CalendarEvent } from "@/components/calendar/CalendarTimeline";
import { WeatherWidget } from "@/components/calendar/WeatherWidget";
import { FrostAlert } from "@/components/calendar/FrostAlert";
import {
  calculateStartSeedsDate,
  calculateTransplantDate,
} from "@/lib/services/planting-calendar";
import { hasFrostRisk } from "@/lib/api/weather";
import type { CurrentWeather, ForecastDay } from "@/lib/api/weather";
import { getGardenWeather } from "@/lib/services/garden-weather";
import { getSuccessionSuggestions } from "@/lib/services/succession";
import { getStartOptions } from "@/lib/services/planting-feasibility";
import Link from "next/link";
import { MapPin, Sprout } from "lucide-react";

export default async function CalendarPage() {
  const user = await requireUser();

  // Gardens (for weather/frost settings) + active-season plantings queried
  // directly — the old garden→beds→cells→plantings include shipped the whole
  // tree just to extract plantings.
  const [gardens, plantings, editableGardens] = await Promise.all([
    db.garden.findMany({
      where: gardenAccessFilter(user.id),
      include: { weatherCache: true },
      orderBy: { createdAt: "asc" },
    }),
    db.planting.findMany({
      where: {
        season: { isActive: true },
        cell: { bed: { garden: gardenAccessFilter(user.id) } },
      },
      select: {
        plantedDate: true,
        expectedHarvestDate: true,
        variety: true,
        plant: {
          select: {
            id: true,
            name: true,
            indoorStartWeeks: true,
            transplantWeeks: true,
            daysToMaturity: true,
          },
        },
        cell: { select: { bed: { select: { id: true, name: true, gardenId: true } } } },
      },
      // Match the old garden-tree iteration order so first-seen dedupes
      // (planNow) resolve against the same garden.
      orderBy: { cell: { bed: { garden: { createdAt: "asc" } } } },
    }),
    // Writable gardens + beds for the "Plant it" bed-choice dialog on the
    // suggestion cards (same shape as the plant detail page's picker query —
    // occupiedBy so footprint cells of multi-cell plants count as occupied).
    db.garden.findMany({
      where: gardenEditFilter(user.id),
      select: {
        id: true,
        name: true,
        seasons: { where: { isActive: true }, select: { id: true } },
        beds: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            name: true,
            widthFt: true,
            heightFt: true,
            cells: {
              select: {
                id: true,
                occupiedBy: {
                  where: { planting: { season: { isActive: true } } },
                  select: { plantingId: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const gardenById = new Map(gardens.map((g) => [g.id, g]));

  const gardensForPicker = editableGardens.map((g) => ({
    id: g.id,
    name: g.name,
    hasActiveSeason: g.seasons.length > 0,
    beds: g.beds.map((b) => ({
      id: b.id,
      name: b.name,
      widthFt: b.widthFt,
      heightFt: b.heightFt,
      emptyCellCount: b.cells.filter((c) => c.occupiedBy.length === 0).length,
    })),
  }));

  // Use the first garden with a zip for weather (stale-while-revalidate:
  // only the first-ever view blocks on the OpenWeather fetch).
  const weatherGarden = gardens.find((g) => g.locationZip);
  let current: CurrentWeather | null = null;
  let forecast: ForecastDay[] | null = null;

  if (weatherGarden) {
    ({ current, forecast } = await getGardenWeather(
      weatherGarden.id,
      weatherGarden.locationZip!,
      weatherGarden.weatherCache
    ));
  }

  // Build calendar events from all active-season plantings, DEDUPED:
  // multiple cells of the same plant in the same bed on the same date used
  // to produce N identical rows. Aggregate by (type, plant, bed, day) and
  // carry a count so the timeline can show "Basil ×5".
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() + 12); // show next 12 months

  const eventMap = new Map<string, CalendarEvent>();
  function addEvent(e: CalendarEvent) {
    const dayKey = e.date.toISOString().slice(0, 10);
    // Variety is deliberately NOT part of the dedupe key — grouping stays by
    // plant so the list doesn't explode. The variety label survives only if
    // every planting in the group shares it; mixed groups drop it.
    const key = `${e.type}|${e.plantId}|${e.bedId}|${dayKey}`;
    const existing = eventMap.get(key);
    if (existing) {
      existing.count = (existing.count ?? 1) + 1;
      if (existing.variety !== e.variety) existing.variety = null;
    } else {
      eventMap.set(key, { ...e, count: 1 });
    }
  }

  for (const planting of plantings) {
    const bed = planting.cell.bed;
    const garden = gardenById.get(bed.gardenId);
    if (!garden?.lastFrostDate) continue;

    const { plant } = planting;
    const base = {
      plantName: plant.name,
      variety: planting.variety || null,
      plantId: plant.id,
      bedId: bed.id,
      bedName: bed.name,
      gardenId: garden.id,
      gardenName: garden.name,
    };

    // Start seeds
    if (plant.indoorStartWeeks) {
      const d = calculateStartSeedsDate(garden.lastFrostDate, plant.indoorStartWeeks);
      if (d >= now && d <= cutoff) {
        addEvent({ date: d, type: "START_SEEDS", ...base });
      }
    }

    // Transplant
    if (plant.transplantWeeks != null) {
      const d = calculateTransplantDate(garden.lastFrostDate, plant.transplantWeeks);
      if (d >= now && d <= cutoff) {
        addEvent({ date: d, type: "TRANSPLANT", ...base });
      }
    }

    // Harvest — use stored expectedHarvestDate if set
    const harvestDate = planting.expectedHarvestDate;
    if (harvestDate && harvestDate >= now && harvestDate <= cutoff) {
      addEvent({ date: harvestDate, type: "HARVEST", ...base });
    }
  }

  const events: CalendarEvent[] = Array.from(eventMap.values()).sort((a, b) => +a.date - +b.date);

  // Succession suggestions
  const allActivePlantings = plantings.map((p) => ({
    plant: p.plant,
    plantedDate: p.plantedDate,
    expectedHarvestDate: p.expectedHarvestDate,
    bedName: p.cell.bed.name,
    gardenId: p.cell.bed.gardenId,
    gardenName: gardenById.get(p.cell.bed.gardenId)?.name ?? "",
  }));
  const firstFrostDate = gardens.find((g) => g.firstFrostDate)?.firstFrostDate ?? null;
  const successionSuggestions = getSuccessionSuggestions(allActivePlantings, firstFrostDate);

  // "What you can plant now" — for each distinct planned plant, the start
  // method we'd recommend right now (anchored to today, not next spring).
  const planNow: { plantId: string; plantName: string; summary: string; thisSeason: boolean }[] = [];
  const seenPlant = new Set<string>();
  for (const planting of plantings) {
    const garden = gardenById.get(planting.cell.bed.gardenId);
    if (!garden) continue;
    const p = planting.plant;
    if (seenPlant.has(p.id) || p.daysToMaturity == null) continue;
    seenPlant.add(p.id);
    const f = getStartOptions(
      p,
      { lastFrostDate: garden.lastFrostDate, firstFrostDate: garden.firstFrostDate },
      now
    );
    planNow.push({
      plantId: p.id,
      plantName: p.name,
      summary: f.recommendedOption.summary,
      thisSeason: f.recommendedThisSeason,
    });
  }
  planNow.sort((a, b) => Number(b.thisSeason) - Number(a.thisSeason));

  // Active planting count for frost alert
  const activePlantingCount = plantings.length;

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

      <div className="px-[22px] md:px-8 py-5 animate-fade-rise">
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
          Some gardens are missing frost dates, so planting calendar events may be incomplete.{" "}
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
                  <SuccessionActions
                    plantId={s.plantId}
                    plantName={s.plantName}
                    gardenId={s.gardenId}
                    suggestedDate={s.suggestedPlantDate}
                    gardens={gardensForPicker}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* What you can plant now */}
      {planNow.length > 0 && (
        <div className="mb-8">
          <h2 className="font-display text-lg font-semibold text-[#111109] mb-3 pb-2 border-b border-[#E4E4DC]">
            What you can plant now
          </h2>
          <div className="space-y-2">
            {planNow.map((r) => (
              <div
                key={r.plantId}
                className="flex items-center justify-between gap-3 p-3 bg-[#F4F4EC] rounded-xl border border-[#E4E4DC]"
              >
                <Link
                  href={`/plants/${r.plantId}`}
                  className="text-sm font-medium text-[#111109] hover:text-[#1C3D0A] transition-colors shrink-0"
                >
                  {r.plantName}
                </Link>
                <span
                  className="flex-1 text-xs text-right"
                  style={{ color: r.thisSeason ? "#3A6B20" : "#ADADAA" }}
                >
                  {r.summary}
                </span>
                <div className="shrink-0">
                  <AddToBedDialog
                    compact
                    plantId={r.plantId}
                    plantName={r.plantName}
                    gardens={gardensForPicker}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <CalendarTimeline
        events={events}
        activePlantingCount={activePlantingCount}
        currentYear={now.getFullYear()}
      />
      </div>
    </div>
  );
}
