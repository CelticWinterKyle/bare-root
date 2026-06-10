import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPlantAction } from "@/app/actions/plants";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PlantHeroImage } from "@/components/plants/PlantHeroImage";
import { AddToBedDialog } from "@/components/plants/AddToBedDialog";
import { PlantTimingEditor } from "@/components/plants/PlantTimingEditor";
import { PlantFeasibility } from "@/components/plants/PlantFeasibility";
import { pestInfoFor } from "@/lib/services/pest-data";
import { plantsPerArea } from "@/lib/services/spacing";
import { gardenAccessFilter, gardenEditFilter } from "@/lib/permissions";
import { ChevronLeft, Clock, Droplets, Grid3x3, Ruler, Sprout, Sun } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const SUN_LABELS: Record<string, string> = {
  FULL_SUN: "Full sun (6+ hours)",
  PARTIAL_SUN: "Part sun (3–6 hours)",
  PARTIAL_SHADE: "Part shade",
  FULL_SHADE: "Full shade",
};

const WATER_LABELS: Record<string, string> = {
  LOW: "Low",
  MODERATE: "Moderate",
  HIGH: "High",
};

const CATEGORY_LABELS: Record<string, string> = {
  VEGETABLE: "Vegetable",
  FRUIT: "Fruit",
  HERB: "Herb",
  FLOWER: "Flower",
  TREE: "Tree",
  SHRUB: "Shrub",
  OTHER: "Other",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ plantId: string }>;
}): Promise<Metadata> {
  const { plantId } = await params;
  const plant = await getPlantAction(plantId);
  return {
    title: plant ? `${plant.name} | Bare Root Plant Library` : "Bare Root",
  };
}

export default async function PlantDetailPage({
  params,
}: {
  params: Promise<{ plantId: string }>;
}) {
  const { plantId } = await params;
  const user = await requireUser();

  const plant = await getPlantAction(plantId);
  if (!plant) notFound();

  const beneficial = plant.companions ?? [];
  const harmful = plant.antagonists ?? [];

  // Gardens for the "Add to a bed" picker. Only includes gardens the user
  // can write to (owner or EDITOR collaborator) — viewers can't plant.
  // Includes bed sizes + empty cell counts so the picker can show
  // "All cells planted" inline.
  const userGardensQuery = db.garden.findMany({
    where: gardenEditFilter(user.id),
    select: {
      id: true,
      name: true,
      lastFrostDate: true,
      firstFrostDate: true,
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
              // Use occupiedBy (PlantingCell join) so footprint cells of
              // multi-cell plants count as occupied, not just the anchor.
              // Otherwise a 2×2 tomato makes only its anchor look planted
              // and AddToBedDialog reports the bed as more empty than it is.
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
  });

  // Where this plant is growing right now — active-season plantings across
  // every garden the user can VIEW (viewers included). Bounded; powers the
  // "In your garden" section.
  const [userGardens, activePlantings] = await Promise.all([
    userGardensQuery,
    db.planting.findMany({
      where: {
        plantId,
        season: { isActive: true },
        cell: { bed: { garden: gardenAccessFilter(user.id) } },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        variety: true,
        cell: {
          select: {
            bed: {
              select: {
                id: true,
                name: true,
                gardenId: true,
                garden: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  // Frost dates from the user's first garden that has them — powers the
  // "how can I grow this now?" guidance.
  const frostGarden = userGardens.find((g) => g.firstFrostDate || g.lastFrostDate);
  const frost = {
    lastFrostDate: frostGarden?.lastFrostDate ?? null,
    firstFrostDate: frostGarden?.firstFrostDate ?? null,
  };

  const gardensForPicker = userGardens.map((g) => ({
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

  return (
    <div>
      {/* Back header */}
      <div className="px-[22px] md:px-8 pt-5 pb-4" style={{ background: "#FDFDF8", borderBottom: "1px solid #E4E4DC" }}>
        <div className="max-w-3xl mx-auto" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Link
            href="/plants"
            aria-label="Back to plant library"
            style={{ width: "22px", height: "22px", borderRadius: "6px", background: "#F4F4EC", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#6B6B5A", flexShrink: 0, textDecoration: "none" }}
          ><ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden="true" /></Link>
          <span style={{ fontFamily: "var(--font-body)", fontSize: "12px", fontWeight: 500, color: "#6B6B5A" }}>Plant Library</span>
        </div>
      </div>
      <div className="px-[22px] md:px-8 py-5">
      <div className="max-w-3xl mx-auto">

      {/* Hero */}
      <div className="rounded-2xl border border-[#E4E4DC] overflow-hidden mb-4">
        <PlantHeroImage imageUrl={plant.imageUrl} name={plant.name} category={plant.category} />
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-semibold text-[#111109]">
                {plant.name}
              </h1>
              {plant.scientificName && (
                <p className="text-sm text-[#ADADAA] italic mt-0.5">
                  {plant.scientificName}
                </p>
              )}
            </div>
            <span className="shrink-0 text-xs font-medium bg-[#F4F4EC] text-[#1C3D0A] px-2.5 py-1 rounded-full">
              {CATEGORY_LABELS[plant.category]}
            </span>
          </div>

          {plant.description && (
            <p className="text-sm text-[#6B6B5A] mt-4 leading-relaxed">
              {plant.description}
            </p>
          )}

          <div className="mt-5">
            <AddToBedDialog
              plantId={plant.id}
              plantName={plant.name}
              gardens={gardensForPicker}
            />
          </div>
        </div>
      </div>

      {/* In your garden — where this plant is growing right now */}
      {activePlantings.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E4E4DC] p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Sprout className="w-4 h-4 text-[#7DA84E] shrink-0" />
            <h2 className="font-medium text-[#111109]">
              In your garden
              <span className="text-[#6B6B5A] font-normal">
                {" — "}{activePlantings.length} planted right now
              </span>
            </h2>
          </div>
          <div className="space-y-1.5">
            {activePlantings.map((p) => (
              <Link
                key={p.id}
                href={`/garden/${p.cell.bed.gardenId}/beds/${p.cell.bed.id}`}
                className="flex items-baseline justify-between gap-3 rounded-lg border border-[#E4E4DC] bg-[#FDFDF8] px-3 py-2 hover:border-[#7DA84E] transition-colors no-underline"
              >
                <span className="text-sm font-medium text-[#1C3D0A] truncate">
                  {p.cell.bed.name}
                  {p.variety && (
                    <span className="text-[#6B6B5A] font-normal"> · {p.variety}</span>
                  )}
                </span>
                <span className="text-xs text-[#ADADAA] shrink-0">
                  {p.cell.bed.garden.name} →
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* How can I grow this now? */}
      <PlantFeasibility plant={plant} frost={frost} className="mb-4" />

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {plant.daysToMaturity && (
          <Stat icon={Clock} label="Days to maturity" value={`${plant.daysToMaturity} days`} />
        )}
        {plant.spacingInches && (
          <Stat icon={Ruler} label="Spacing" value={`${plant.spacingInches}"`} />
        )}
        {plant.sunRequirement && (
          <Stat icon={Sun} label="Sun" value={SUN_LABELS[plant.sunRequirement] ?? plant.sunRequirement} />
        )}
        {plant.waterRequirement && (
          <Stat icon={Droplets} label="Water" value={WATER_LABELS[plant.waterRequirement] ?? plant.waterRequirement} />
        )}
        {(() => {
          if (!plant.spacingInches) return null;
          // Capacity for a representative bed: the user's first bed if they
          // have one, else a standard 4×8 ft bed at 12" cells.
          const firstBed = gardensForPicker.flatMap((g) => g.beds)[0];
          const w = firstBed?.widthFt ?? 4;
          const h = firstBed?.heightFt ?? 8;
          const count = plantsPerArea(plant.spacingInches, w, h, 12);
          if (count <= 0) return null;
          return (
            <Stat
              icon={Grid3x3}
              label="Fits per bed"
              value={`~${count} in ${w}×${h} ft`}
            />
          );
        })()}
      </div>

      {/* Planting timing — editable, drives the calendar + reminders */}
      <PlantTimingEditor
        plantId={plant.id}
        daysToMaturity={plant.daysToMaturity}
        indoorStartWeeks={plant.indoorStartWeeks}
        transplantWeeks={plant.transplantWeeks}
        estimated={plant.timingEstimated}
      />

      {/* Growing details */}
      {(plant.plantFamily || plant.plantingSeasons?.length > 0 || plant.soilPhRange || plant.harvestMonths?.length > 0) && (
        <div className="bg-white rounded-xl border border-[#E4E4DC] p-5 mb-4">
          <h2 className="font-medium text-[#111109] mb-3">Growing details</h2>
          <dl className="space-y-2">
            {plant.plantFamily && <Detail label="Plant family" value={plant.plantFamily} />}
            {plant.plantingSeasons?.length > 0 && (
              <Detail label="Planting seasons" value={plant.plantingSeasons.join(", ")} />
            )}
            {plant.soilPhRange && <Detail label="Soil pH" value={plant.soilPhRange} />}
            {plant.harvestMonths?.length > 0 && (
              <Detail label="Harvest season" value={plant.harvestMonths.join(", ")} />
            )}
          </dl>
        </div>
      )}

      {/* Pests & diseases — informational; always has curated fallback */}
      {(() => {
        const { pests, diseases } = pestInfoFor(
          plant.category,
          plant.name,
          plant.commonPests,
          plant.commonDiseases
        );
        if (pests.length === 0 && diseases.length === 0) return null;
        return (
          <div className="bg-white rounded-xl border border-[#E4E4DC] p-5 mb-4">
            <h2 className="font-medium text-[#111109] mb-1">Pests &amp; diseases</h2>
            <p className="text-xs text-[#ADADAA] mb-3">Common issues to watch for with this plant.</p>
            {pests.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-[#B85C3A] uppercase tracking-wide mb-2">Common pests</p>
                <div className="flex flex-wrap gap-2">
                  {pests.map((p) => (
                    <span key={p} className="px-2.5 py-1 bg-[#FBF0EE] text-[#7A2A18] text-sm rounded-full">{p}</span>
                  ))}
                </div>
              </div>
            )}
            {diseases.length > 0 && (
              <div>
                <p className="text-xs font-medium text-[#92700A] uppercase tracking-wide mb-2">Common diseases</p>
                <div className="flex flex-wrap gap-2">
                  {diseases.map((d) => (
                    <span key={d} className="px-2.5 py-1 bg-[#FFF8E7] text-[#7A4A0A] text-sm rounded-full">{d}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Companion planting */}
      {(beneficial.length > 0 || harmful.length > 0) && (
        <div className="bg-white rounded-xl border border-[#E4E4DC] p-5">
          <h2 className="font-medium text-[#111109] mb-3">Companion planting</h2>
          {beneficial.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-[#3A6B20] uppercase tracking-wide mb-2">
                Beneficial companions
              </p>
              <div className="flex flex-wrap gap-2">
                {beneficial.map((r) => (
                  <Link
                    key={r.id}
                    href={`/plants/${r.relatedId}`}
                    className="px-2.5 py-1 bg-[#F4F4EC] text-[#1C3D0A] text-sm rounded-full hover:bg-[#E4E4DC] transition-colors"
                  >
                    ✓ {r.related.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {harmful.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[#B85C3A] uppercase tracking-wide mb-2">
                Avoid planting near
              </p>
              <div className="flex flex-wrap gap-2">
                {harmful.map((r) => (
                  <Link
                    key={r.id}
                    href={`/plants/${r.plantId}`}
                    className="px-2.5 py-1 bg-red-50 text-[#B85C3A] text-sm rounded-full hover:bg-red-100 transition-colors"
                  >
                    ✗ {r.plant.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon?: LucideIcon; label: string; value: string }) {
  return (
    <div className="bg-[#F4F4EC] rounded-xl p-3 border border-[#E4E4DC]">
      <p className="flex items-center gap-1 text-xs text-[#ADADAA] mb-0.5">
        {Icon && <Icon className="w-3 h-3 shrink-0 text-[#6B6B5A]" aria-hidden="true" />}
        {label}
      </p>
      <p className="text-sm font-medium text-[#111109]">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm gap-4">
      <dt className="text-[#ADADAA] shrink-0">{label}</dt>
      <dd className="text-[#111109] text-right">{value}</dd>
    </div>
  );
}
