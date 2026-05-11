import { requireUser } from "@/lib/auth";
import { getPlantAction } from "@/app/actions/plants";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, Leaf } from "lucide-react";

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

export default async function PlantDetailPage({
  params,
}: {
  params: Promise<{ plantId: string }>;
}) {
  const { plantId } = await params;
  await requireUser();

  const plant = await getPlantAction(plantId);
  if (!plant) notFound();

  const beneficial = plant.companions ?? [];
  const harmful = plant.antagonists ?? [];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link
        href="/plants"
        className="inline-flex items-center gap-1 text-sm text-[#6B6560] hover:text-[#2D5016] mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Plant Library
      </Link>

      {/* Hero */}
      <div className="bg-white rounded-2xl border border-[#E8E2D9] overflow-hidden mb-4">
        {plant.imageUrl ? (
          <div className="aspect-[16/7] relative">
            <Image
              src={plant.imageUrl}
              alt={plant.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 672px"
            />
          </div>
        ) : (
          <div className="aspect-[16/7] bg-[#F5F0E8] flex items-center justify-center">
            <Leaf className="w-12 h-12 text-[#E8E2D9]" />
          </div>
        )}
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-semibold text-[#1C1C1A]">
                {plant.name}
              </h1>
              {plant.scientificName && (
                <p className="text-sm text-[#9E9890] italic mt-0.5">
                  {plant.scientificName}
                </p>
              )}
            </div>
            <span className="shrink-0 text-xs font-medium bg-[#F5F0E8] text-[#2D5016] px-2.5 py-1 rounded-full">
              {CATEGORY_LABELS[plant.category]}
            </span>
          </div>

          {plant.description && (
            <p className="text-sm text-[#6B6560] mt-4 leading-relaxed">
              {plant.description}
            </p>
          )}
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
        <div className="bg-white rounded-xl border border-[#E8E2D9] p-5 mb-4">
          <h2 className="font-medium text-[#1C1C1A] mb-3">Growing details</h2>
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
        <div className="bg-white rounded-xl border border-[#E8E2D9] p-5">
          <h2 className="font-medium text-[#1C1C1A] mb-3">Companion planting</h2>
          {beneficial.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-[#4A7C2F] uppercase tracking-wide mb-2">
                Beneficial companions
              </p>
              <div className="flex flex-wrap gap-2">
                {beneficial.map((r) => (
                  <Link
                    key={r.id}
                    href={`/plants/${r.relatedId}`}
                    className="px-2.5 py-1 bg-[#F5F0E8] text-[#2D5016] text-sm rounded-full hover:bg-[#E8E2D9] transition-colors"
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
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#F5F0E8] rounded-xl p-3 border border-[#E8E2D9]">
      <p className="text-xs text-[#9E9890] mb-0.5">{label}</p>
      <p className="text-sm font-medium text-[#1C1C1A]">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm gap-4">
      <dt className="text-[#9E9890] shrink-0">{label}</dt>
      <dd className="text-[#1C1C1A] text-right">{value}</dd>
    </div>
  );
}
