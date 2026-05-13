import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { HarvestLogSection } from "@/components/tracking/HarvestLogSection";
import { PhotoGallery } from "@/components/tracking/PhotoGallery";
import { GrowthNotes } from "@/components/tracking/GrowthNotes";

export default async function PlantingDetailPage({
  params,
}: {
  params: Promise<{ gardenId: string; bedId: string; plantingId: string }>;
}) {
  const { gardenId, bedId, plantingId } = await params;
  const user = await requireUser();

  const planting = await db.planting.findFirst({
    where: {
      id: plantingId,
      cell: { bedId, bed: { gardenId, garden: { userId: user.id } } },
    },
    include: {
      plant: { select: { id: true, name: true, daysToMaturity: true, category: true } },
      cell: { include: { bed: { select: { id: true, name: true, gardenId: true } } } },
      season: { select: { name: true } },
      harvestLogs: { orderBy: { harvestedAt: "desc" } },
      photos: { orderBy: { takenAt: "desc" } },
      growthNotes: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!planting) notFound();

  const totalHarvest = planting.harvestLogs.reduce((s, l) => s + l.quantity, 0);
  const harvestUnit = planting.harvestLogs[0]?.unit ?? "lbs";

  const statusLabel = planting.status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link
        href={`/garden/${gardenId}/beds/${bedId}`}
        className="inline-flex items-center gap-1 text-sm text-[#6B6B5A] hover:text-[#1C3D0A] mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        {planting.cell.bed.name}
      </Link>

      {/* Header */}
      <header className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold text-[#111109]">
              <Link href={`/plants/${planting.plant.id}`} className="hover:text-[#1C3D0A] transition-colors">
                {planting.plant.name}
              </Link>
            </h1>
            <p className="text-sm text-[#6B6B5A] mt-1">
              {planting.season.name} · {planting.cell.bed.name}
            </p>
          </div>
          <span className="shrink-0 text-xs px-3 py-1.5 rounded-full bg-[#F4F4EC] text-[#6B6B5A] font-medium mt-1">
            {statusLabel}
          </span>
        </div>

        {/* Quick stats */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-[#E4E4DC]">
          {planting.plantedDate && (
            <div>
              <p className="text-xs text-[#ADADAA]">Planted</p>
              <p className="text-sm font-medium text-[#111109]">
                {new Date(planting.plantedDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
            </div>
          )}
          {planting.expectedHarvestDate && (
            <div>
              <p className="text-xs text-[#ADADAA]">Est. harvest</p>
              <p className="text-sm font-medium text-[#3A6B20]">
                {new Date(planting.expectedHarvestDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
            </div>
          )}
          {planting.harvestLogs.length > 0 && (
            <div>
              <p className="text-xs text-[#ADADAA]">Total harvested</p>
              <p className="text-sm font-medium text-[#D4820A]">
                {totalHarvest} {harvestUnit}
              </p>
            </div>
          )}
          {planting.rating && (
            <div>
              <p className="text-xs text-[#ADADAA]">Rating</p>
              <p className="text-sm font-medium text-[#111109]">{"★".repeat(planting.rating)}{"☆".repeat(5 - planting.rating)}</p>
            </div>
          )}
        </div>
      </header>

      <div className="space-y-8">
        {/* Harvest logs */}
        <HarvestLogSection
          plantingId={plantingId}
          logs={planting.harvestLogs.map((l) => ({
            id: l.id,
            quantity: l.quantity,
            unit: l.unit,
            notes: l.notes,
            harvestedAt: l.harvestedAt,
          }))}
        />

        {/* Photos */}
        <PhotoGallery
          plantingId={plantingId}
          photos={planting.photos.map((p) => ({ id: p.id, url: p.url, caption: p.caption, takenAt: p.takenAt }))}
          isPro={user.subscriptionTier === "PRO"}
        />

        {/* Growth notes */}
        <GrowthNotes
          plantingId={plantingId}
          notes={planting.growthNotes.map((n) => ({ id: n.id, body: n.body, createdAt: n.createdAt }))}
        />
      </div>
    </div>
  );
}
