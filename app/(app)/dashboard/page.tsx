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
    include: { _count: { select: { beds: true } }, seasons: { where: { isActive: true }, take: 1 } },
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
        <div className="bg-[#F5F0E8] rounded-xl p-8 text-center border border-[#E8E2D9]">
          <Sprout className="w-10 h-10 text-[#6B8F47] mx-auto mb-3" />
          <p className="font-display text-lg text-[#2D5016] mb-2">
            Set up your first garden
          </p>
          <Link
            href="/onboarding"
            className="inline-flex bg-[#2D5016] text-white px-6 py-3 rounded-lg text-sm font-medium hover:bg-[#3d6b1e] transition-colors"
          >
            Start setup →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {gardens.map((garden) => (
            <Link
              key={garden.id}
              href={`/garden/${garden.id}`}
              className="block bg-white rounded-xl border border-[#E8E2D9] p-5 hover:border-[#6B8F47] hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-display text-lg font-semibold text-[#1C1C1A] group-hover:text-[#2D5016] transition-colors">
                    {garden.name}
                  </h2>
                  <div className="flex items-center gap-3 mt-1 text-sm text-[#6B6560]">
                    {garden.usdaZone && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        Zone {garden.usdaZone}
                      </span>
                    )}
                    <span>
                      {garden._count.beds}{" "}
                      {garden._count.beds === 1 ? "bed" : "beds"}
                    </span>
                    <span>
                      {garden.widthFt} × {garden.heightFt} ft
                    </span>
                  </div>
                  {garden.seasons[0] && (
                    <p className="text-xs text-[#9E9890] mt-1">
                      {garden.seasons[0].name}
                    </p>
                  )}
                </div>
                <span className="text-[#9E9890] group-hover:text-[#2D5016] transition-colors mt-0.5">
                  →
                </span>
              </div>
            </Link>
          ))}

          {user.subscriptionTier === "FREE" && gardens.length >= 1 && (
            <div className="rounded-xl border border-dashed border-[#E8E2D9] p-5 text-center">
              <p className="text-sm text-[#9E9890]">
                Free plan includes 1 garden.{" "}
                <Link href="/settings/billing" className="text-[#C4790A] hover:underline">
                  Upgrade to Pro
                </Link>{" "}
                for unlimited gardens.
              </p>
            </div>
          )}

          {(user.subscriptionTier === "PRO" || gardens.length === 0) && (
            <Link
              href="/onboarding"
              className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#E8E2D9] p-5 text-sm text-[#6B6560] hover:text-[#2D5016] hover:border-[#6B8F47] transition-colors"
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
