import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { gardenAccessFilter } from "@/lib/permissions";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Leaf, Star, Lock } from "lucide-react";
import { CreateSeasonDialog } from "@/components/seasons/CreateSeasonDialog";
import { EndSeasonDialog } from "@/components/seasons/EndSeasonDialog";
import { setActiveSeason } from "@/app/actions/seasons";

export default async function SeasonsPage({
  params,
}: {
  params: Promise<{ gardenId: string }>;
}) {
  const { gardenId } = await params;
  const user = await requireUser();

  const garden = await db.garden.findFirst({
    where: { id: gardenId, ...gardenAccessFilter(user.id) },
    include: {
      seasons: {
        orderBy: { startDate: "desc" },
        include: {
          plantings: {
            include: {
              plant: { select: { id: true, name: true } },
              cell: true,
            },
          },
        },
      },
    },
  });

  if (!garden) notFound();

  const isPro = user.subscriptionTier === "PRO";
  const activeSeason = garden.seasons.find((s) => s.isActive);
  const pastSeasons = garden.seasons.filter((s) => !s.isActive);

  return (
    <div>
      <div className="px-[22px] md:px-8 pt-5 pb-4" style={{ background: "#FDFDF8", borderBottom: "1px solid #E4E4DC" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
          <Link
            href={`/garden/${gardenId}`}
            style={{ width: "22px", height: "22px", borderRadius: "6px", background: "#F4F4EC", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "13px", color: "#6B6B5A", fontWeight: 600, lineHeight: 1, flexShrink: 0, textDecoration: "none" }}
          >‹</Link>
          <span style={{ fontFamily: "var(--font-body)", fontSize: "12px", fontWeight: 500, color: "#6B6B5A" }}>
            {garden.name}
          </span>
          <div style={{ marginLeft: "auto" }}>
            <CreateSeasonDialog gardenId={gardenId} hasActiveSeason={!!activeSeason} />
          </div>
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: 800, color: "#111109", letterSpacing: "-0.025em", lineHeight: 1, fontVariationSettings: "'opsz' 26" }}>
          Seasons
        </h1>
      </div>
      <div className="px-[22px] md:px-8 py-5">

      {/* Active season */}
      {activeSeason && (
        <div className="mb-6">
          <p className="text-xs text-[#ADADAA] font-medium uppercase tracking-wide mb-2">Active</p>
          <div className="bg-white rounded-xl border border-[#1C3D0A]/30 p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="font-medium text-[#111109]">{activeSeason.name}</h2>
                <p className="text-xs text-[#ADADAA] mt-0.5">
                  Started {activeSeason.startDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </p>
              </div>
              <EndSeasonDialog
                seasonId={activeSeason.id}
                seasonName={activeSeason.name}
                plantings={activeSeason.plantings.map((p) => ({
                  id: p.id,
                  plantName: p.plant.name,
                  status: p.status,
                  rating: p.rating,
                  growAgain: p.growAgain,
                }))}
              />
            </div>
            <PlantingsSummary plantings={activeSeason.plantings} />
          </div>
        </div>
      )}

      {/* Past seasons */}
      {pastSeasons.length > 0 && (
        <div>
          <p className="text-xs text-[#ADADAA] font-medium uppercase tracking-wide mb-2">History</p>
          {!isPro ? (
            <div className="bg-[#F4F4EC] rounded-xl border border-dashed border-[#E4E4DC] p-6 text-center">
              <Lock className="w-6 h-6 text-[#ADADAA] mx-auto mb-2" />
              <p className="text-sm font-medium text-[#111109] mb-1">Season history is a Pro feature</p>
              <p className="text-xs text-[#ADADAA] mb-3">
                {pastSeasons.length} past season{pastSeasons.length !== 1 ? "s" : ""} archived.
              </p>
              <Link
                href="/settings/billing"
                className="text-sm font-medium text-[#D4820A] hover:underline"
              >
                Upgrade to Pro to view
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {pastSeasons.map((season) => {
                const ratedCount = season.plantings.filter((p) => p.rating !== null).length;
                const growAgainCount = season.plantings.filter((p) => p.growAgain).length;
                const avgRating =
                  ratedCount > 0
                    ? season.plantings.reduce((s, p) => s + (p.rating ?? 0), 0) / ratedCount
                    : null;

                return (
                  <div key={season.id} className="bg-white rounded-xl border border-[#E4E4DC] p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <Link href={`/garden/${gardenId}/seasons/${season.id}`} className="font-medium text-[#111109] hover:text-[#1C3D0A] transition-colors">
                          {season.name}
                        </Link>
                        <p className="text-xs text-[#ADADAA] mt-0.5">
                          {season.startDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                          {season.endDate &&
                            ` — ${season.endDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`}
                        </p>
                      </div>
                      <form action={setActiveSeason.bind(null, season.id)}>
                        <button
                          type="submit"
                          className="text-xs text-[#7DA84E] hover:text-[#1C3D0A] font-medium"
                        >
                          Set active
                        </button>
                      </form>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[#6B6B5A]">
                      <span className="flex items-center gap-1">
                        <Leaf className="w-3 h-3" />
                        {season.plantings.length} planted
                      </span>
                      {avgRating && (
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3 fill-[#D4820A] text-[#D4820A]" />
                          {avgRating.toFixed(1)} avg
                        </span>
                      )}
                      {growAgainCount > 0 && (
                        <span>{growAgainCount} grow again</span>
                      )}
                    </div>
                    {season.plantings.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {[...new Map(season.plantings.map((p) => [p.plant.id, p.plant])).values()].slice(0, 8).map((plant) => (
                          <span key={plant.id} className="text-[11px] bg-[#F4F4EC] text-[#6B6B5A] px-2 py-0.5 rounded-full">
                            {plant.name}
                          </span>
                        ))}
                        {season.plantings.length > 8 && (
                          <span className="text-[11px] text-[#ADADAA]">+{season.plantings.length - 8} more</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {garden.seasons.length === 0 && (
        <div className="text-center py-12 text-[#ADADAA]">
          <p className="text-sm">No seasons yet. Create your first season to start tracking.</p>
        </div>
      )}
      </div>
    </div>
  );
}

function PlantingsSummary({ plantings }: { plantings: { plant: { id: string; name: string }; status: string }[] }) {
  if (plantings.length === 0) {
    return <p className="text-xs text-[#ADADAA]">No plants assigned yet.</p>;
  }
  const unique = [...new Map(plantings.map((p) => [p.plant.id, p.plant])).values()];
  return (
    <div className="flex flex-wrap gap-1">
      {unique.slice(0, 10).map((plant) => (
        <span key={plant.id} className="text-[11px] bg-[#F4F4EC] text-[#6B6B5A] px-2 py-0.5 rounded-full">
          {plant.name}
        </span>
      ))}
      {unique.length > 10 && (
        <span className="text-[11px] text-[#ADADAA]">+{unique.length - 10} more</span>
      )}
    </div>
  );
}
