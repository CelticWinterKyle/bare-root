import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { BedGrid } from "@/components/canvas/BedGrid";

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
          }
        : null,
      warnings,
    };
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link
        href={`/garden/${gardenId}`}
        className="inline-flex items-center gap-1 text-sm text-[#6B6560] hover:text-[#2D5016] mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        {bed.garden.name}
      </Link>

      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold text-[#1C1C1A]">
          {bed.name}
        </h1>
        <p className="text-[#6B6560] text-sm mt-1">
          {bed.widthFt} × {bed.heightFt} ft · {bed.gridCols} × {bed.gridRows} grid ·{" "}
          {bed.cellSizeIn}&quot; cells
        </p>
      </header>

      <BedGrid
        bedId={bed.id}
        gardenId={gardenId}
        gridCols={bed.gridCols}
        gridRows={bed.gridRows}
        cellSizeIn={bed.cellSizeIn}
        cells={cells}
        seasonId={activeSeason?.id ?? ""}
        userId={user.id}
        recentPlants={recentPlants}
      />
    </div>
  );
}
