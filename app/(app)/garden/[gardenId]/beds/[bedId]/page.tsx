import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { BedGrid } from "@/components/canvas/BedGrid";
import { SeasonSelector } from "@/components/seasons/SeasonSelector";
import { EditBedDialog } from "@/components/garden/EditBedDialog";
import { getCropRotationWarnings } from "@/lib/services/crop-rotation";
import { gardenAccessFilter } from "@/lib/permissions";

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
  searchParams: Promise<{ season?: string; plant?: string }>;
}) {
  const { gardenId, bedId } = await params;
  const { season: seasonParam, plant: plantParam } = await searchParams;
  const user = await requireUser();

  // If we arrived from the plant detail page with ?plant=ID, pre-load the
  // plant so the bed grid can show a "Tap an empty cell to plant X" banner
  // and skip the picker search step.
  const prefillPlant = plantParam
    ? await db.plantLibrary.findFirst({
        where: {
          id: plantParam,
          OR: [{ customForUserId: null }, { customForUserId: user.id }],
        },
        select: { id: true, name: true, category: true, imageUrl: true, daysToMaturity: true, spacingInches: true },
      })
    : null;

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
    where: { id: bedId, gardenId, garden: gardenAccessFilter(user.id) },
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
          // PlantingCell is the source of truth for "what's growing in this
          // cell?" — it covers both primary (anchor) cells and footprint
          // cells of multi-cell plants. Filtered to the viewing season.
          occupiedBy: {
            where: {
              planting: viewingSeason
                ? { seasonId: viewingSeason.id }
                : { season: { isActive: true } },
            },
            include: {
              planting: {
                include: {
                  plant: {
                    select: {
                      id: true,
                      name: true,
                      category: true,
                      imageUrl: true,
                      daysToMaturity: true,
                      spacingInches: true,
                    },
                  },
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

  // All plant IDs in this bed for the viewing season (for companion lookup).
  // Pull from occupiedBy so multi-cell plants count once and footprint cells
  // contribute too.
  const bedPlantIds = [
    ...new Set(
      bed.cells.flatMap((cell) => cell.occupiedBy.map((oc) => oc.planting.plantId))
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
          spacingInches: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    distinct: ["plantId"],
  });
  const recentPlants = recentPlantings.map((p) => p.plant);

  // Build cell data with companion warnings. Per cell, occupiedBy is at
  // most one entry for the viewing season (enforced in app code by
  // assignPlant). That entry tells us whether this cell is the anchor
  // (isPrimary) or a footprint cell — and only the anchor renders the
  // plant label / status pill / interactive detail panel.
  const cells = bed.cells.map((cell) => {
    const occ = cell.occupiedBy[0] ?? null;
    const isPrimary = occ?.isPrimary ?? false;
    const rawPlanting = occ && isPrimary ? occ.planting : null;

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
            variety: rawPlanting.variety,
            notes: rawPlanting.notes,
          }
        : null,
      // Footprint info: when this cell is part of a multi-cell planting but
      // ISN'T the anchor. The grid renderer uses these to color the cell to
      // match its anchor and to route taps to the anchor's detail panel.
      footprint:
        occ && !isPrimary
          ? {
              plantingId: occ.planting.id,
              primaryCellId: occ.planting.cellId,
              status: occ.planting.status,
            }
          : null,
      warnings,
    };
  });

  const isPro = user.subscriptionTier === "PRO";

  const bedNameParts = bed.name.trim().split(/\s+/);
  const bedNameFirst = bedNameParts[0];
  const bedNameRest = bedNameParts.slice(1).join(" ");

  return (
    <div className="container-wide w-full flex flex-col">
      {/* Header — grid-header-clean */}
      <div className="px-[22px] md:px-8 pt-5 pb-4" style={{ background: "#FDFDF8", borderBottom: "1px solid #E4E4DC" }}>
        {/* Back row */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
          <Link
            href={`/garden/${gardenId}`}
            style={{
              width: "22px", height: "22px", borderRadius: "6px",
              background: "#F4F4EC", display: "inline-flex", alignItems: "center",
              justifyContent: "center", fontSize: "13px", color: "#6B6B5A",
              fontWeight: 600, lineHeight: 1, flexShrink: 0, textDecoration: "none",
            }}
          >‹</Link>
          <span style={{ fontFamily: "var(--font-body)", fontSize: "12px", fontWeight: 500, color: "#6B6B5A" }}>
            {bed.garden.name}
          </span>
          {allSeasons.length > 1 && (
            <div style={{ marginLeft: "auto" }}>
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
        {/* Bed title + edit */}
        <div className="flex items-center gap-3">
          <h1 style={{
            fontFamily: "var(--font-display)", fontSize: "26px", fontWeight: 800,
            color: "#111109", letterSpacing: "-0.025em", lineHeight: 1,
            fontVariationSettings: "'opsz' 28",
          }}>
            <em style={{ fontStyle: "italic", color: "#1C3D0A" }}>{bedNameFirst}</em>
            {bedNameRest ? ` ${bedNameRest}` : null}
          </h1>
          <EditBedDialog
            bedId={bed.id}
            gardenId={gardenId}
            initial={{
              name: bed.name,
              widthFt: bed.widthFt,
              heightFt: bed.heightFt,
              cellSizeIn: bed.cellSizeIn,
              // Count distinct anchor plantings (footprint cells share an
              // anchor so we don't double-count multi-cell plants).
              plantingCount: new Set(
                bed.cells.flatMap((c) =>
                  c.occupiedBy.filter((oc) => oc.isPrimary).map((oc) => oc.planting.id)
                )
              ).size,
            }}
          />
        </div>
        {/* Sub — mono meta */}
        <p style={{
          fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.1em",
          textTransform: "uppercase", color: "#6B6B5A", marginTop: "5px",
        }}>
          {bed.widthFt} × {bed.heightFt} ft · {bed.gridCols} × {bed.gridRows} grid · {bed.cellSizeIn}&quot; cells
          {bed.garden.usdaZone ? ` · Zone ${bed.garden.usdaZone}` : ""}
        </p>
        {/* Crop rotation warnings */}
        {rotationWarnings.length > 0 && (
          <div className="mt-3 space-y-1.5">
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

      {/* BedGrid — full width, no extra padding */}
      <div className="flex-1 w-full">
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
          prefillPlant={prefillPlant}
        />
      </div>
    </div>
  );
}
