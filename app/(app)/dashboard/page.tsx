import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Sprout, Plus, MapPin } from "lucide-react";

export default async function DashboardPage() {
  const user = await requireUser();
  if (!user.onboardingComplete) redirect("/onboarding");

  const gardens = await db.garden.findMany({
    where: { userId: user.id },
    include: {
      _count: { select: { beds: true } },
      seasons: { where: { isActive: true }, take: 1 },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-[#1C1C1A]">
          Welcome back{user.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-[#6B6560] mt-1">
          {gardens.length === 1
            ? "Your garden is ready."
            : gardens.length > 1
            ? `${gardens.length} gardens.`
            : "Let's get growing."}
        </p>
      </header>

      {gardens.length === 0 ? (
        <div className="rounded-2xl overflow-hidden border border-[#E8E2D9] shadow-sm">
          <div className="relative px-6 pt-8 pb-6 bg-gradient-to-br from-[#2D5016] to-[#4A7C2F]">
            <GridPattern />
            <div className="relative">
              <Sprout className="w-10 h-10 text-white/70 mb-3" />
              <p className="font-display text-2xl font-semibold text-white mb-1">
                Set up your first garden
              </p>
              <p className="text-white/70 text-sm">
                Add your beds, map your space, and start planning.
              </p>
            </div>
          </div>
          <div className="px-6 py-4 bg-white">
            <Link
              href="/onboarding"
              className="inline-flex bg-[#2D5016] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#3d6b1e] transition-colors"
            >
              Start setup →
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {gardens.map((garden) => (
            <Link
              key={garden.id}
              href={`/garden/${garden.id}`}
              className="block group rounded-2xl overflow-hidden border border-[#E8E2D9] hover:border-[#6B8F47] hover:shadow-md transition-all"
            >
              {/* Green header band */}
              <div className="relative px-5 pt-5 pb-4 bg-gradient-to-br from-[#2D5016] to-[#4A7C2F]">
                <GridPattern />
                <div className="relative flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl font-semibold text-white leading-tight">
                      {garden.name}
                    </h2>
                    {garden.seasons[0] && (
                      <p className="text-white/65 text-xs mt-0.5 font-medium">
                        {garden.seasons[0].name}
                      </p>
                    )}
                  </div>
                  {garden.usdaZone && (
                    <span className="shrink-0 text-xs font-semibold bg-white/15 text-white/90 px-2.5 py-1 rounded-full border border-white/20">
                      Zone {garden.usdaZone}
                    </span>
                  )}
                </div>
              </div>

              {/* Stats row */}
              <div className="px-5 py-3.5 bg-white flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-[#6B6560]">
                  <span className="flex items-center gap-1.5">
                    <Sprout className="w-3.5 h-3.5 text-[#6B8F47]" />
                    {garden._count.beds}{" "}
                    {garden._count.beds === 1 ? "bed" : "beds"}
                  </span>
                  {garden.usdaZone && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#9E9890]" />
                      <span className="text-[#9E9890]">{garden.widthFt} × {garden.heightFt} ft</span>
                    </span>
                  )}
                  {!garden.usdaZone && (
                    <span className="text-[#9E9890]">{garden.widthFt} × {garden.heightFt} ft</span>
                  )}
                </div>
                <span className="text-[#9E9890] group-hover:text-[#2D5016] text-sm transition-colors">
                  →
                </span>
              </div>
            </Link>
          ))}

          {user.subscriptionTier === "FREE" && gardens.length >= 1 && (
            <div className="rounded-xl border border-dashed border-[#E8E2D9] p-4 text-center">
              <p className="text-sm text-[#9E9890]">
                Free plan includes 1 garden.{" "}
                <Link href="/settings/billing" className="text-[#C4790A] hover:underline">
                  Upgrade to Pro
                </Link>{" "}
                for unlimited gardens.
              </p>
            </div>
          )}

          {user.subscriptionTier === "PRO" && (
            <Link
              href="/onboarding"
              className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#E8E2D9] p-4 text-sm text-[#6B6560] hover:text-[#2D5016] hover:border-[#6B8F47] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add another garden
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function GridPattern() {
  return (
    <div
      className="absolute inset-0 opacity-[0.07]"
      style={{
        backgroundImage:
          "repeating-linear-gradient(0deg,transparent,transparent 20px,#fff 20px,#fff 21px)," +
          "repeating-linear-gradient(90deg,transparent,transparent 20px,#fff 20px,#fff 21px)",
      }}
    />
  );
}
