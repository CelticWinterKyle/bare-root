import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, Plus, Sprout, ChevronRight } from "lucide-react";
import { AddBedDialog } from "@/components/garden/AddBedDialog";

export default async function GardenPage({
  params,
}: {
  params: Promise<{ gardenId: string }>;
}) {
  const { gardenId } = await params;
  const user = await requireUser();

  const garden = await db.garden.findFirst({
    where: { id: gardenId, userId: user.id },
    include: {
      beds: {
        include: {
          _count: { select: { cells: true } },
          cells: {
            include: {
              plantings: {
                where: { season: { isActive: true } },
                include: { plant: { select: { name: true, category: true } } },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      seasons: { where: { isActive: true }, take: 1 },
    },
  });

  if (!garden) notFound();

  const activeSeason = garden.seasons[0];
  const bedCount = garden.beds.length;
  const atBedLimit =
    user.subscriptionTier === "FREE" && bedCount >= 3;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold text-[#1C1C1A]">
              {garden.name}
            </h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-[#6B6560]">
              {garden.usdaZone && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  Zone {garden.usdaZone}
                </span>
              )}
              {garden.lastFrostDate && (
                <span>Last frost {formatFrostDate(garden.lastFrostDate)}</span>
              )}
              <span>
                {garden.widthFt} × {garden.heightFt} ft
              </span>
            </div>
            {activeSeason && (
              <p className="text-xs text-[#9E9890] mt-1">{activeSeason.name}</p>
            )}
          </div>
        </div>
      </header>

      {/* Beds */}
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-medium text-[#1C1C1A]">
            Beds{" "}
            <span className="text-[#9E9890] font-normal text-sm">
              ({bedCount}{user.subscriptionTier === "FREE" ? "/3" : ""})
            </span>
          </h2>
          {!atBedLimit && (
            <AddBedDialog gardenId={garden.id} />
          )}
        </div>

        {garden.beds.length === 0 ? (
          <div className="bg-[#F5F0E8] rounded-xl p-8 text-center border border-[#E8E2D9]">
            <Sprout className="w-10 h-10 text-[#6B8F47] mx-auto mb-3" />
            <p className="font-display text-lg text-[#2D5016] mb-1">
              No beds yet
            </p>
            <p className="text-sm text-[#6B6560]">
              Add your first raised bed to start planning.
            </p>
          </div>
        ) : (
          garden.beds.map((bed) => {
            const activePlantings = bed.cells.flatMap((c) => c.plantings);
            const filledCells = activePlantings.length;
            const totalCells = bed._count.cells;
            const pct = totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0;

            return (
              <Link
                key={bed.id}
                href={`/garden/${garden.id}/beds/${bed.id}`}
                className="flex items-center justify-between bg-white rounded-xl border border-[#E8E2D9] p-5 hover:border-[#6B8F47] hover:shadow-sm transition-all group"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-[#1C1C1A] group-hover:text-[#2D5016] transition-colors">
                      {bed.name}
                    </h3>
                    <span className="text-xs text-[#9E9890]">
                      {bed.widthFt} × {bed.heightFt} ft
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex-1 max-w-[120px] h-1.5 bg-[#E8E2D9] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#4A7C2F] rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-[#9E9890]">
                      {filledCells}/{totalCells} cells planted
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#9E9890] group-hover:text-[#2D5016] transition-colors ml-4" />
              </Link>
            );
          })
        )}

        {atBedLimit && (
          <div className="rounded-xl border border-dashed border-[#E8E2D9] p-4 text-center">
            <p className="text-sm text-[#9E9890]">
              3 beds used on Free plan.{" "}
              <Link href="/settings/billing" className="text-[#C4790A] hover:underline">
                Upgrade to Pro
              </Link>{" "}
              for unlimited beds.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function formatFrostDate(mmdd: string): string {
  const [m, d] = mmdd.split("-").map(Number);
  return new Date(2000, m - 1, d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
}
