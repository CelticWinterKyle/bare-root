import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { gardenAccessFilter } from "@/lib/permissions";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Star, Leaf, TrendingUp } from "lucide-react";

export default async function SeasonSummaryPage({
  params,
}: {
  params: Promise<{ gardenId: string; seasonId: string }>;
}) {
  const { gardenId, seasonId } = await params;
  const user = await requireUser();

  const season = await db.season.findFirst({
    where: { id: seasonId, gardenId, garden: gardenAccessFilter(user.id) },
    include: {
      garden: { select: { name: true } },
      plantings: {
        include: {
          plant: { select: { id: true, name: true, category: true } },
          cell: { include: { bed: { select: { name: true } } } },
          harvestLogs: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!season) notFound();

  // Aggregate harvest by plant
  type PlantSummary = {
    plantId: string;
    plantName: string;
    category: string;
    beds: string[];
    totalHarvest: number;
    unit: string;
    logCount: number;
    rating: number | null;
    growAgain: boolean | null;
    status: string;
  };

  const byPlant: Record<string, PlantSummary> = {};
  for (const p of season.plantings) {
    const pid = p.plant.id;
    if (!byPlant[pid]) {
      byPlant[pid] = {
        plantId: pid,
        plantName: p.plant.name,
        category: p.plant.category,
        beds: [],
        totalHarvest: 0,
        unit: p.harvestLogs[0]?.unit ?? "lbs",
        logCount: 0,
        rating: p.rating,
        growAgain: p.growAgain,
        status: p.status,
      };
    }
    const bed = p.cell.bed.name;
    if (!byPlant[pid].beds.includes(bed)) byPlant[pid].beds.push(bed);
    for (const log of p.harvestLogs) {
      byPlant[pid].totalHarvest += log.quantity;
      byPlant[pid].logCount++;
    }
  }

  const summaries = Object.values(byPlant).sort((a, b) => b.totalHarvest - a.totalHarvest);
  const growAgainList = summaries.filter((s) => s.growAgain);
  const totalPlantings = season.plantings.length;
  const ratedCount = season.plantings.filter((p) => p.rating !== null).length;
  const avgRating = ratedCount > 0
    ? season.plantings.reduce((s, p) => s + (p.rating ?? 0), 0) / ratedCount
    : null;

  return (
    <div>
      <div className="px-[22px] md:px-8 pt-5 pb-4" style={{ background: "#FDFDF8", borderBottom: "1px solid #E4E4DC" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
          <Link
            href={`/garden/${gardenId}/seasons`}
            style={{ width: "22px", height: "22px", borderRadius: "6px", background: "#F4F4EC", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "13px", color: "#6B6B5A", fontWeight: 600, lineHeight: 1, flexShrink: 0, textDecoration: "none" }}
          >‹</Link>
          <span style={{ fontFamily: "var(--font-body)", fontSize: "12px", fontWeight: 500, color: "#6B6B5A" }}>
            {season.garden.name} · Seasons
          </span>
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: 800, color: "#111109", letterSpacing: "-0.025em", lineHeight: 1, fontVariationSettings: "'opsz' 26" }}>
          {season.name}
        </h1>
      </div>
      <div className="px-[22px] md:px-8 py-5">

      <header className="mb-8">
        <p className="text-sm text-[#6B6B5A]">
          {season.startDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          {season.endDate && ` — ${season.endDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`}
        </p>

        {/* Season stats */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-[#E4E4DC]">
          <div>
            <p className="text-xs text-[#ADADAA]">Plantings</p>
            <p className="text-xl font-semibold text-[#111109]">{totalPlantings}</p>
          </div>
          {avgRating && (
            <div>
              <p className="text-xs text-[#ADADAA]">Avg rating</p>
              <p className="text-xl font-semibold text-[#111109]">{avgRating.toFixed(1)} / 5</p>
            </div>
          )}
          {growAgainList.length > 0 && (
            <div>
              <p className="text-xs text-[#ADADAA]">Grow again</p>
              <p className="text-xl font-semibold text-[#3A6B20]">{growAgainList.length}</p>
            </div>
          )}
        </div>
      </header>

      {/* Harvest by plant */}
      {summaries.some((s) => s.logCount > 0) && (
        <section className="mb-8">
          <h2 className="font-display text-lg font-semibold text-[#111109] mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#D4820A]" />
            Harvest summary
          </h2>
          <div className="space-y-2">
            {summaries
              .filter((s) => s.logCount > 0)
              .map((s) => (
                <div key={s.plantId} className="flex items-center justify-between p-3 bg-[#FFF3E8] border border-orange-100 rounded-xl">
                  <div>
                    <Link href={`/plants/${s.plantId}`} className="text-sm font-medium text-[#111109] hover:text-[#1C3D0A]">
                      {s.plantName}
                    </Link>
                    <p className="text-xs text-[#ADADAA]">{s.beds.join(", ")}</p>
                  </div>
                  <span className="text-sm font-semibold text-[#D4820A]">
                    {s.totalHarvest} {s.unit}
                  </span>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* All plantings */}
      <section className="mb-8">
        <h2 className="font-display text-lg font-semibold text-[#111109] mb-3 flex items-center gap-2">
          <Leaf className="w-5 h-5 text-[#7DA84E]" />
          All plantings
        </h2>
        <div className="space-y-2">
          {summaries.map((s) => (
            <div key={s.plantId} className="flex items-center justify-between p-3 bg-white border border-[#E4E4DC] rounded-xl">
              <div>
                <Link href={`/plants/${s.plantId}`} className="text-sm font-medium text-[#111109] hover:text-[#1C3D0A]">
                  {s.plantName}
                </Link>
                <p className="text-xs text-[#ADADAA]">
                  {s.status.replace(/_/g, " ").toLowerCase()} · {s.beds.join(", ")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {s.rating && (
                  <span className="text-xs text-[#D4820A]">
                    {"★".repeat(s.rating)}
                  </span>
                )}
                {s.growAgain && (
                  <span className="text-[10px] bg-[#F4F4EC] text-[#3A6B20] font-medium px-2 py-0.5 rounded-full">
                    Grow again
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Grow again list */}
      {growAgainList.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-semibold text-[#111109] mb-3 flex items-center gap-2">
            <Star className="w-5 h-5 text-[#D4A843]" />
            Plant again next season
          </h2>
          <div className="flex flex-wrap gap-2">
            {growAgainList.map((s) => (
              <Link
                key={s.plantId}
                href={`/plants/${s.plantId}`}
                className="text-sm bg-[#F4F4EC] border border-[#E4E4DC] text-[#1C3D0A] px-3 py-1.5 rounded-full hover:bg-[#E4E4DC] transition-colors font-medium"
              >
                {s.plantName}
              </Link>
            ))}
          </div>
        </section>
      )}

      {totalPlantings === 0 && (
        <div className="text-center py-12 text-[#ADADAA]">
          <p className="text-sm">No plantings recorded for this season.</p>
        </div>
      )}
      </div>
    </div>
  );
}
