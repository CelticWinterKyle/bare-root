import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPlantAction } from "@/app/actions/plants";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PlantHeroImage } from "@/components/plants/PlantHeroImage";
import { AddToBedDialog } from "@/components/plants/AddToBedDialog";
import { gardenEditFilter } from "@/lib/permissions";

const SUN_LABELS: Record<string, string> = {
  FULL_SUN: "☀️ Full sun (6+ hours)",
  PARTIAL_SUN: "⛅ Part sun (3–6 hours)",
  PARTIAL_SHADE: "🌥️ Part shade",
  FULL_SHADE: "☁️ Full shade",
};

const WATER_LABELS: Record<string, string> = {
  LOW: "💧 Low",
  MODERATE: "💧💧 Moderate",
  HIGH: "💧💧💧 High",
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
  const userGardens = await db.garden.findMany({
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
              plantings: {
                where: { season: { isActive: true } },
                select: { id: true },
                take: 1,
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const gardensForPicker = userGardens.map((g) => ({
    id: g.id,
    name: g.name,
    hasActiveSeason: g.seasons.length > 0,
    beds: g.beds.map((b) => ({
      id: b.id,
      name: b.name,
      widthFt: b.widthFt,
      heightFt: b.heightFt,
      emptyCellCount: b.cells.filter((c) => c.plantings.length === 0).length,
    })),
  }));

  return (
    <div>
      {/* Back header */}
      <div className="px-[22px] md:px-8 pt-5 pb-4" style={{ background: "#FDFDF8", borderBottom: "1px solid #E4E4DC" }}>
        <div className="max-w-3xl mx-auto" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Link
            href="/plants"
            style={{ width: "22px", height: "22px", borderRadius: "6px", background: "#F4F4EC", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "13px", color: "#6B6B5A", fontWeight: 600, lineHeight: 1, flexShrink: 0, textDecoration: "none" }}
          >‹</Link>
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

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {plant.daysToMaturity && (
          <Stat label="Days to maturity" value={`${plant.daysToMaturity} days`} />
        )}
        {plant.spacingInches && (
          <Stat label="Spacing" value={`${plant.spacingInches}"`} />
        )}
        {plant.sunRequirement && (
          <Stat label="Sun" value={SUN_LABELS[plant.sunRequirement] ?? plant.sunRequirement} />
        )}
        {plant.waterRequirement && (
          <Stat label="Water" value={WATER_LABELS[plant.waterRequirement] ?? plant.waterRequirement} />
        )}
      </div>

      {/* Growing details */}
      {(plant.plantFamily || plant.plantingSeasons?.length > 0 || plant.soilPhRange || plant.indoorStartWeeks) && (
        <div className="bg-white rounded-xl border border-[#E4E4DC] p-5 mb-4">
          <h2 className="font-medium text-[#111109] mb-3">Growing details</h2>
          <dl className="space-y-2">
            {plant.plantFamily && <Detail label="Plant family" value={plant.plantFamily} />}
            {plant.plantingSeasons?.length > 0 && (
              <Detail label="Planting seasons" value={plant.plantingSeasons.join(", ")} />
            )}
            {plant.soilPhRange && <Detail label="Soil pH" value={plant.soilPhRange} />}
            {plant.indoorStartWeeks && (
              <Detail label="Start indoors" value={`${plant.indoorStartWeeks} weeks before last frost`} />
            )}
            {plant.transplantWeeks && (
              <Detail label="Transplant" value={`${plant.transplantWeeks} weeks after last frost`} />
            )}
            {plant.harvestMonths?.length > 0 && (
              <Detail label="Harvest season" value={plant.harvestMonths.join(", ")} />
            )}
          </dl>
        </div>
      )}

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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#F4F4EC] rounded-xl p-3 border border-[#E4E4DC]">
      <p className="text-xs text-[#ADADAA] mb-0.5">{label}</p>
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
