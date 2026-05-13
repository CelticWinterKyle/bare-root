import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, RotateCcw } from "lucide-react";
import { BedGrid } from "@/components/canvas/BedGrid";
import { SeasonSelector } from "@/components/seasons/SeasonSelector";
import { getCropRotationWarnings } from "@/lib/services/crop-rotation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ gardenId: string; bedId: string }>;
}): Promise<Metadata> {
  const { bedId } = await params;
  const bed = await db.bed.findUnique({
    where: { id: bedId },
    select: { name: true, garden: { select: { name: true } } },
  });
  return {
    title: bed ? `${bed.name} — ${bed.garden.name} | Bare Root` : "Bare Root",
  };
}

export default async function BedPage({
  params,
  searchParams,
}: {
  params: Promise<{ gardenId: string; bedId: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const { gardenId, bedId } = await params;
  const { season: seasonParam } = await searchParams;
  const user = await requireUser();

  // Fetch all seasons so we can offer the selector
  const allSeasons = await db.season.findMany({
    where: { gardenId },
    orderBy: { startDate: "desc" },
  });

  const viewingSeason =
    allSeasons.find((s) => s.id === seasonParam) ??
    allSeasons.find((s) => s.isActive) ??
    null;

  const bed = await db.bed.findFirst({
    where: { id: bedId, gardenId, garden: { userId: user.id } },
    include: {
      garden: {
        select: {
          id: true,
          name: true,
          usdaZone: true,
          lastFrostDate: true,
          firstFrostDate: true,
        },
      },
      cells: {
        include: {
          plantings: {
            where: viewingSeason ? { seasonId: viewingSeason.id } : { season: { isActive: true } },
            include: {
              plant: {
                select: {
                  id: true,
                  name: true,
                  category: true,
                  imageUrl: true,
                  daysToMaturity: true,
                },
              },
            },
          },
        },
        orderBy: [{ row: "asc" }, { col: "asc" }],
      },
    },
  });

  if (!bed) notFound();

  // Crop rotation warnings for this bed
  const rotationWarnings = viewingSeason
    ? (await getCropRotationWarnings(gardenId, viewingSeason.id)).filter(
        (w) => w.bedId === bed.id
      )
    : [];

  // All plant IDs in this bed for the viewing season (for companion lookup)
  const bedPlantIds = [
    ...new Set(
      bed.cells.flatMap((cell) => cell.plantings.map((p) => p.plantId))
    ),
  ];

  // Companion relations involving any plant in the bed (bidirectional)
  const companionRelations =
    bedPlantIds.length > 0
      ? await db.companionRelation.findMany({
          where: {
            OR: [
              { plantId: { in: bedPlantIds } },
              { relatedId: { in: bedPlantIds } },
            ],
          },
          include: {
            plant: { select: { id: true, name: true } },
            related: { select: { id: true, name: true } },
          },
        })
      : [];

  // Recent plants used in this garden (for plant picker suggestions)
  const recentPlantings = await db.planting.findMany({
    where: { cell: { bed: { gardenId } } },
    include: {
      plant: {
        select: {
          id: true,
          name: true,
          category: true,
          imageUrl: true,
          daysToMaturity: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    distinct: ["plantId"],
  });
  const recentPlants = recentPlantings.map((p) => p.plant);

  // Build cell data with companion warnings
  const cells = bed.cells.map((cell) => {
    const rawPlanting = cell.plantings[0] ?? null;

    let warnings: { type: "BENEFICIAL" | "HARMFUL"; plantName: string; notes: string | null }[] = [];

    if (rawPlanting) {
      const plantId = rawPlanting.plantId;

      const relevant = companionRelations.filter(
        (r) => r.plantId === plantId || r.relatedId === plantId
      );

      const seen = new Set<string>();
      for (const r of relevant) {
        const otherId = r.plantId === plantId ? r.relatedId : r.plantId;
        const otherName = r.plantId === plantId ? r.related.name : r.plant.name;
        if (!bedPlantIds.includes(otherId) || otherId === plantId) continue;
        const key = `${r.type}-${otherId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        warnings.push({ type: r.type as "BENEFICIAL" | "HARMFUL", plantName: otherName, notes: r.notes });
      }
    }

    return {
      id: cell.id,
      row: cell.row,
      col: cell.col,
      sunLevel: cell.sunLevel,
      planting: rawPlanting
        ? {
            id: rawPlanting.id,
            status: rawPlanting.status,
            plant: rawPlanting.plant,
            plantedDate: rawPlanting.plantedDate,
            transplantDate: rawPlanting.transplantDate,
            expectedHarvestDate: rawPlanting.expectedHarvestDate,
          }
        : null,
      warnings,
    };
  });

  const isPro = user.subscriptionTier === "PRO";

  return (
    <div
      className="w-full px-8 py-8 flex flex-col justify-center"
      style={{ minHeight: "calc(100dvh - 120px)" }}
    >
      {/* Compact header: back · bed name · stat chips — centered */}
      <div className="max-w-3xl mx-auto mb-6">
        {/* Row 1: back link + bed name + season selector */}
        <div className="flex items-center gap-2 min-h-[44px]">
          <Link
            href={`/garden/${gardenId}`}
            className="flex items-center gap-1 text-sm transition-colors group shrink-0"
            style={{ color: "#ADADAA" }}
          >
            <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span className="font-medium">{bed.garden.name}</span>
          </Link>
          <span className="select-none" style={{ color: "#E4E4DC" }}>/</span>
          <h1 className="font-display text-xl font-semibold" style={{ color: "#111109", fontVariationSettings: "'opsz' 22" }}>{bed.name}</h1>
          {allSeasons.length > 1 && (
            <div className="ml-auto">
              <Suspense>
                <SeasonSelector
                  seasons={allSeasons}
                  selectedId={viewingSeason?.id ?? ""}
                  isPro={isPro}
                />
              </Suspense>
            </div>
          )}
        </div>
        {/* Row 2: chips */}
        <div className="flex items-center gap-1.5 flex-wrap mt-1">
          <span className="inline-flex items-center font-mono text-xs px-2 py-0.5 rounded-full" style={{ background: "#F4F4EC", color: "#6B6B5A", border: "1px solid #E4E4DC" }}>
            {bed.widthFt} × {bed.heightFt} ft
          </span>
          <span className="hidden sm:inline-flex items-center font-mono text-xs px-2 py-0.5 rounded-full" style={{ background: "#F4F4EC", color: "#6B6B5A", border: "1px solid #E4E4DC" }}>
            {bed.gridCols} × {bed.gridRows} grid
          </span>
          <span className="hidden sm:inline-flex items-center font-mono text-xs px-2 py-0.5 rounded-full" style={{ background: "#F4F4EC", color: "#6B6B5A", border: "1px solid #E4E4DC" }}>
            {bed.cellSizeIn}&quot; cells
            {bed.cellSizeIn < 12 && (
              <span className="ml-1" style={{ color: "#ADADAA" }}>({Math.round((12 / bed.cellSizeIn) ** 2)}/sq ft)</span>
            )}
          </span>
          {bed.garden.usdaZone && (
            <span className="inline-flex items-center font-mono text-xs px-2 py-0.5 rounded-full" style={{ background: "#E4F0D4", color: "#3A6B20", border: "1px solid #D4E8BE" }}>
              Zone {bed.garden.usdaZone}
            </span>
          )}
        </div>

        {/* Crop rotation warnings */}
        {rotationWarnings.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {rotationWarnings.map((w, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: "#FDF2E0", border: "1px solid rgba(212,130,10,0.25)" }}>
                <RotateCcw className="w-3.5 h-3.5 shrink-0" style={{ color: "#D4820A" }} />
                <span style={{ color: "#7A4A0A" }}>
                  <span className="font-semibold">Crop rotation: </span>
                  {w.plantFamily} ({w.currentPlants.join(", ")}) grew here in {w.seasonName}.{" "}
                  <span style={{ color: "#A06010" }}>Consider a different plant family to prevent disease buildup.</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <BedGrid
        bedId={bed.id}
        gardenId={gardenId}
        gridCols={bed.gridCols}
        gridRows={bed.gridRows}
        cellSizeIn={bed.cellSizeIn}
        cells={cells}
        seasonId={viewingSeason?.id ?? ""}
        isPro={isPro}
        userId={user.id}
        recentPlants={recentPlants}
      />
    </div>
  );
}
