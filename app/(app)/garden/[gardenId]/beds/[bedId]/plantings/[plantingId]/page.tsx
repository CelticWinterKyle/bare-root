import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { gardenAccessFilter } from "@/lib/permissions";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { HarvestLogSection } from "@/components/tracking/HarvestLogSection";
import { PhotoGallery } from "@/components/tracking/PhotoGallery";
import { GrowthNotes } from "@/components/tracking/GrowthNotes";
import { RatingSection } from "@/components/tracking/RatingSection";
import { estimateYieldLbs } from "@/lib/services/yield";

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
      cell: { bedId, bed: { gardenId, garden: gardenAccessFilter(user.id) } },
    },
    include: {
      plant: { select: { id: true, name: true, daysToMaturity: true, category: true } },
      cell: { include: { bed: { select: { id: true, name: true, gardenId: true, cellSizeIn: true } } } },
      season: { select: { name: true } },
      harvestLogs: { orderBy: { harvestedAt: "desc" } },
      photos: { orderBy: { takenAt: "desc" } },
      growthNotes: { orderBy: { createdAt: "desc" } },
      _count: { select: { cells: true } },
    },
  });

  if (!planting) notFound();

  const totalHarvest = planting.harvestLogs.reduce((s, l) => s + l.quantity, 0);
  const harvestUnit = planting.harvestLogs[0]?.unit ?? "lbs";

  // Estimated yield from the planting's footprint (category heuristic).
  const footprintCells = planting._count.cells || 1;
  const estYieldLbs = estimateYieldLbs(
    planting.plant.category,
    footprintCells,
    planting.cell.bed.cellSizeIn
  );

  const statusLabel = planting.status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

  return (
    <div>
      <div className="px-[22px] md:px-8 pt-5 pb-4" style={{ background: "#FDFDF8", borderBottom: "1px solid #E4E4DC" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
          <Link
            href={`/garden/${gardenId}/beds/${bedId}`}
            aria-label={`Back to ${planting.cell.bed.name}`}
            // 22px visual box, padded out to a 40px hit area; negative margin keeps the layout/alignment identical.
            style={{ padding: "9px", margin: "-9px", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, textDecoration: "none" }}
          >
            <span style={{ width: "22px", height: "22px", borderRadius: "6px", background: "#F4F4EC", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "13px", color: "#6B6B5A", fontWeight: 600, lineHeight: 1 }} aria-hidden="true">‹</span>
          </Link>
          <span style={{ fontFamily: "var(--font-body)", fontSize: "12px", fontWeight: 500, color: "#6B6B5A" }}>
            {planting.cell.bed.name}
          </span>
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: 800, color: "#111109", letterSpacing: "-0.025em", lineHeight: 1, fontVariationSettings: "'opsz' 26" }}>
          <em style={{ fontStyle: "italic", color: "#1C3D0A" }}>
            <Link href={`/plants/${planting.plant.id}`} style={{ color: "inherit", textDecoration: "none" }}>
              {planting.plant.name}
            </Link>
          </em>
        </h1>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#6B6B5A", marginTop: "5px" }}>
          {planting.season.name} · {planting.cell.bed.name} · {statusLabel}
        </p>
      </div>
      <div className="px-[22px] md:px-8 py-5">

      {/* Quick stats */}
      <div className="flex flex-wrap gap-4 mb-8 pb-5 border-b border-[#E4E4DC]">
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
          {estYieldLbs != null && (
            <div>
              <p className="text-xs text-[#ADADAA]">Est. yield</p>
              <p className="text-sm font-medium text-[#3A6B20]">
                ~{estYieldLbs} lb
                <span className="text-[#ADADAA] font-normal"> est.</span>
              </p>
            </div>
          )}
          {planting.harvestLogs.length > 0 && (
            <div>
              <p className="text-xs text-[#ADADAA]">Total harvested</p>
              <p className="text-sm font-medium text-[#D4820A]">
                {totalHarvest} {harvestUnit}
                {estYieldLbs != null && harvestUnit === "lbs" && (
                  <span className="text-[#ADADAA] font-normal"> of ~{estYieldLbs} est.</span>
                )}
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

      <div className="space-y-8">
        {/* Season rating — only meaningful once the plant has actually been
            grown. Showing "how did it grow?" on a still-PLANNED plant is
            confusing, so gate it on a grown status (or an existing rating). */}
        {["HARVESTING", "HARVESTED", "FAILED"].includes(planting.status) ||
        planting.rating != null ||
        planting.growAgain != null ? (
          <RatingSection
            plantingId={plantingId}
            rating={planting.rating}
            growAgain={planting.growAgain}
          />
        ) : (
          <section>
            <h2 className="font-display text-lg font-semibold text-[#111109] mb-1">Season rating</h2>
            <p className="text-sm text-[#ADADAA]">
              You can rate this and decide whether to grow it again once it&apos;s harvested.
            </p>
          </section>
        )}

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
    </div>
  );
}
