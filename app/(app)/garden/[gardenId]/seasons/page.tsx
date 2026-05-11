import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
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
    where: { id: gardenId, userId: user.id },
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
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link
        href={`/garden/${gardenId}`}
        className="inline-flex items-center gap-1 text-sm text-[#6B6560] hover:text-[#2D5016] mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        {garden.name}
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-semibold text-[#1C1C1A]">Seasons</h1>
        <CreateSeasonDialog gardenId={gardenId} hasActiveSeason={!!activeSeason} />
      </div>

      {/* Active season */}
      {activeSeason && (
        <div className="mb-6">
          <p className="text-xs text-[#9E9890] font-medium uppercase tracking-wide mb-2">Active</p>
          <div className="bg-white rounded-xl border border-[#2D5016]/30 p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="font-medium text-[#1C1C1A]">{activeSeason.name}</h2>
                <p className="text-xs text-[#9E9890] mt-0.5">
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
          <p className="text-xs text-[#9E9890] font-medium uppercase tracking-wide mb-2">History</p>
          {!isPro ? (
            <div className="bg-[#F5F0E8] rounded-xl border border-dashed border-[#E8E2D9] p-6 text-center">
              <Lock className="w-6 h-6 text-[#9E9890] mx-auto mb-2" />
              <p className="text-sm font-medium text-[#1C1C1A] mb-1">Season history is a Pro feature</p>
              <p className="text-xs text-[#9E9890] mb-3">
                {pastSeasons.length} past season{pastSeasons.length !== 1 ? "s" : ""} archived.
              </p>
              <Link
                href="/settings/billing"
                className="text-sm font-medium text-[#C4790A] hover:underline"
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
                  <div key={season.id} className="bg-white rounded-xl border border-[#E8E2D9] p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <Link href={`/garden/${gardenId}/seasons/${season.id}`} className="font-medium text-[#1C1C1A] hover:text-[#2D5016] transition-colors">
                          {season.name}
                        </Link>
                        <p className="text-xs text-[#9E9890] mt-0.5">
                          {season.startDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                          {season.endDate &&
                            ` — ${season.endDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`}
                        </p>
                      </div>
                      <form action={setActiveSeason.bind(null, season.id)}>
                        <button
                          type="submit"
                          className="text-xs text-[#6B8F47] hover:text-[#2D5016] font-medium"
                        >
                          Set active
                        </button>
                      </form>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[#6B6560]">
                      <span className="flex items-center gap-1">
                        <Leaf className="w-3 h-3" />
                        {season.plantings.length} planted
                      </span>
                      {avgRating && (
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3 fill-[#C4790A] text-[#C4790A]" />
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
                          <span key={plant.id} className="text-[11px] bg-[#F5F0E8] text-[#6B6560] px-2 py-0.5 rounded-full">
                            {plant.name}
                          </span>
                        ))}
                        {season.plantings.length > 8 && (
                          <span className="text-[11px] text-[#9E9890]">+{season.plantings.length - 8} more</span>
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
        <div className="text-center py-12 text-[#9E9890]">
          <p className="text-sm">No seasons yet. Create your first season to start tracking.</p>
        </div>
      )}
    </div>
  );
}

function PlantingsSummary({ plantings }: { plantings: { plant: { id: string; name: string }; status: string }[] }) {
  if (plantings.length === 0) {
    return <p className="text-xs text-[#9E9890]">No plants assigned yet.</p>;
  }
  const unique = [...new Map(plantings.map((p) => [p.plant.id, p.plant])).values()];
  return (
    <div className="flex flex-wrap gap-1">
      {unique.slice(0, 10).map((plant) => (
        <span key={plant.id} className="text-[11px] bg-[#F5F0E8] text-[#6B6560] px-2 py-0.5 rounded-full">
          {plant.name}
        </span>
      ))}
      {unique.length > 10 && (
        <span className="text-[11px] text-[#9E9890]">+{unique.length - 10} more</span>
      )}
    </div>
  );
}
