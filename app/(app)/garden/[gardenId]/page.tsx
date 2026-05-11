import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, Plus, Sprout } from "lucide-react";
import { AddBedDialog } from "@/components/garden/AddBedDialog";
import { GardenOverview } from "@/components/canvas/GardenOverview";

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
          cells: {
            include: {
              plantings: {
                where: { season: { isActive: true } },
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
  const atBedLimit = user.subscriptionTier === "FREE" && bedCount >= 3;

  const beds = garden.beds.map((bed) => ({
    id: bed.id,
    name: bed.name,
    xPosition: bed.xPosition,
    yPosition: bed.yPosition,
    widthFt: bed.widthFt,
    heightFt: bed.heightFt,
    plantCount: bed.cells.reduce((sum, c) => sum + c.plantings.length, 0),
  }));

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
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
          <div className="flex items-center gap-2">
            {!atBedLimit && <AddBedDialog gardenId={garden.id} />}
          </div>
        </div>
      </header>

      {/* Canvas */}
      {garden.beds.length === 0 ? (
        <div className="bg-[#F5F0E8] rounded-xl p-12 text-center border border-[#E8E2D9]">
          <Sprout className="w-10 h-10 text-[#6B8F47] mx-auto mb-3" />
          <p className="font-display text-lg text-[#2D5016] mb-1">No beds yet</p>
          <p className="text-sm text-[#6B6560] mb-4">
            Add your first raised bed to start planning.
          </p>
          <AddBedDialog gardenId={garden.id} />
        </div>
      ) : (
        <GardenOverview
          garden={{ id: garden.id, widthFt: garden.widthFt, heightFt: garden.heightFt }}
          beds={beds}
        />
      )}

      {atBedLimit && (
        <div className="mt-4 rounded-xl border border-dashed border-[#E8E2D9] p-4 text-center">
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
  );
}

function formatFrostDate(mmdd: string): string {
  const [m, d] = mmdd.split("-").map(Number);
  return new Date(2000, m - 1, d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
}
