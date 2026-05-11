import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
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
    where: { id: seasonId, gardenId, garden: { userId: user.id } },
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
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link
        href={`/garden/${gardenId}/seasons`}
        className="inline-flex items-center gap-1 text-sm text-[#6B6560] hover:text-[#2D5016] mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        {season.garden.name} · Seasons
      </Link>

      <header className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-[#1C1C1A]">{season.name}</h1>
        <p className="text-sm text-[#6B6560] mt-1">
          {season.startDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          {season.endDate && ` — ${season.endDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`}
        </p>

        {/* Season stats */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-[#E8E2D9]">
          <div>
            <p className="text-xs text-[#9E9890]">Plantings</p>
            <p className="text-xl font-semibold text-[#1C1C1A]">{totalPlantings}</p>
          </div>
          {avgRating && (
            <div>
              <p className="text-xs text-[#9E9890]">Avg rating</p>
              <p className="text-xl font-semibold text-[#1C1C1A]">{avgRating.toFixed(1)} / 5</p>
            </div>
          )}
          {growAgainList.length > 0 && (
            <div>
              <p className="text-xs text-[#9E9890]">Grow again</p>
              <p className="text-xl font-semibold text-[#4A7C2F]">{growAgainList.length}</p>
            </div>
          )}
        </div>
      </header>

      {/* Harvest by plant */}
      {summaries.some((s) => s.logCount > 0) && (
        <section className="mb-8">
          <h2 className="font-display text-lg font-semibold text-[#1C1C1A] mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#C4790A]" />
            Harvest summary
          </h2>
          <div className="space-y-2">
            {summaries
              .filter((s) => s.logCount > 0)
              .map((s) => (
                <div key={s.plantId} className="flex items-center justify-between p-3 bg-[#FFF3E8] border border-orange-100 rounded-xl">
                  <div>
                    <Link href={`/plants/${s.plantId}`} className="text-sm font-medium text-[#1C1C1A] hover:text-[#2D5016]">
                      {s.plantName}
                    </Link>
                    <p className="text-xs text-[#9E9890]">{s.beds.join(", ")}</p>
                  </div>
                  <span className="text-sm font-semibold text-[#C4790A]">
                    {s.totalHarvest} {s.unit}
                  </span>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* All plantings */}
      <section className="mb-8">
        <h2 className="font-display text-lg font-semibold text-[#1C1C1A] mb-3 flex items-center gap-2">
          <Leaf className="w-5 h-5 text-[#6B8F47]" />
          All plantings
        </h2>
        <div className="space-y-2">
          {summaries.map((s) => (
            <div key={s.plantId} className="flex items-center justify-between p-3 bg-white border border-[#E8E2D9] rounded-xl">
              <div>
                <Link href={`/plants/${s.plantId}`} className="text-sm font-medium text-[#1C1C1A] hover:text-[#2D5016]">
                  {s.plantName}
                </Link>
                <p className="text-xs text-[#9E9890]">
                  {s.status.replace(/_/g, " ").toLowerCase()} · {s.beds.join(", ")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {s.rating && (
                  <span className="text-xs text-[#C4790A]">
                    {"★".repeat(s.rating)}
                  </span>
                )}
                {s.growAgain && (
                  <span className="text-[10px] bg-[#F5F0E8] text-[#4A7C2F] font-medium px-2 py-0.5 rounded-full">
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
          <h2 className="font-display text-lg font-semibold text-[#1C1C1A] mb-3 flex items-center gap-2">
            <Star className="w-5 h-5 text-[#D4A843]" />
            Plant again next season
          </h2>
          <div className="flex flex-wrap gap-2">
            {growAgainList.map((s) => (
              <Link
                key={s.plantId}
                href={`/plants/${s.plantId}`}
                className="text-sm bg-[#F5F0E8] border border-[#E8E2D9] text-[#2D5016] px-3 py-1.5 rounded-full hover:bg-[#E8E2D9] transition-colors font-medium"
              >
                {s.plantName}
              </Link>
            ))}
          </div>
        </section>
      )}

      {totalPlantings === 0 && (
        <div className="text-center py-12 text-[#9E9890]">
          <p className="text-sm">No plantings recorded for this season.</p>
        </div>
      )}
    </div>
  );
}
