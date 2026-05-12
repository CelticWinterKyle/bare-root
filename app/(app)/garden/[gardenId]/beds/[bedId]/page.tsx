import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, RotateCcw } from "lucide-react";
import { BedGrid } from "@/components/canvas/BedGrid";
import { getCropRotationWarnings } from "@/lib/services/crop-rotation";

export default async function BedPage({
  params,
}: {
  params: Promise<{ gardenId: string; bedId: string }>;
}) {
  const { gardenId, bedId } = await params;
  const user = await requireUser();

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
            where: { season: { isActive: true } },
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

  // Active season for this garden
  const activeSeason = await db.season.findFirst({
    where: { gardenId, isActive: true },
  });

  // Crop rotation warnings for this bed
  const rotationWarnings = activeSeason
    ? (await getCropRotationWarnings(gardenId, activeSeason.id)).filter(
        (w) => w.bedId === bed.id
      )
    : [];

  // All plant IDs in this bed for the active season (for companion lookup)
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

      // Relations where this cell's plant is one side
      const relevant = companionRelations.filter(
        (r) => r.plantId === plantId || r.relatedId === plantId
      );

      const seen = new Set<string>();
      for (const r of relevant) {
        const otherId = r.plantId === plantId ? r.relatedId : r.plantId;
        const otherName = r.plantId === plantId ? r.related.name : r.plant.name;
        // Only warn if the other plant is actually in this bed
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

  return (
    <div className="flex flex-col justify-center" style={{ minHeight: "calc(100dvh - 120px)" }}>
    <div className="w-full px-8 pt-3 pb-4">
      {/* Compact header: back · bed name · stat chips all on one line */}
      <div className="flex items-center gap-2 flex-wrap min-h-[44px]">
        <Link
          href={`/garden/${gardenId}`}
          className="flex items-center gap-1 text-sm text-[#9E9890] hover:text-[#2D5016] transition-colors group shrink-0"
        >
          <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span className="font-medium">{bed.garden.name}</span>
        </Link>
        <span className="text-[#D8D3CB] select-none">/</span>
        <h1 className="font-display text-xl font-semibold text-[#1C1C1A]">{bed.name}</h1>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center text-xs font-medium bg-[#F5F0E8] text-[#6B6560] px-2 py-0.5 rounded-full border border-[#E8E2D9]">
            {bed.widthFt} × {bed.heightFt} ft
          </span>
          <span className="inline-flex items-center text-xs font-medium bg-[#F5F0E8] text-[#6B6560] px-2 py-0.5 rounded-full border border-[#E8E2D9]">
            {bed.gridCols} × {bed.gridRows} grid
          </span>
          <span className="inline-flex items-center text-xs font-medium bg-[#F5F0E8] text-[#6B6560] px-2 py-0.5 rounded-full border border-[#E8E2D9]">
            {bed.cellSizeIn}&quot; cells
          </span>
          {bed.garden.usdaZone && (
            <span className="inline-flex items-center text-xs font-medium bg-[#EEF6E7] text-[#4A7C2F] px-2 py-0.5 rounded-full border border-[#D4E8C4]">
              Zone {bed.garden.usdaZone}
            </span>
          )}
        </div>
      </div>

      {/* Crop rotation warnings — compact inline strip */}
      {rotationWarnings.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {rotationWarnings.map((w, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs">
              <RotateCcw className="w-3.5 h-3.5 text-yellow-600 shrink-0" />
              <span className="text-yellow-800">
                <span className="font-semibold text-yellow-900">Rotation: </span>
                {w.plantFamily} ({w.currentPlants.join(", ")}) was here in {w.seasonName}.
              </span>
            </div>
          ))}
        </div>
      )}

      <BedGrid
        bedId={bed.id}
        gardenId={gardenId}
        gridCols={bed.gridCols}
        gridRows={bed.gridRows}
        cellSizeIn={bed.cellSizeIn}
        cells={cells}
        seasonId={activeSeason?.id ?? ""}
        isPro={user.subscriptionTier === "PRO"}
        userId={user.id}
        recentPlants={recentPlants}
      />
    </div>
    </div>
  );
}
