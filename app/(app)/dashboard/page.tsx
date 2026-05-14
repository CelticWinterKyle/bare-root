import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { gardenAccessFilter } from "@/lib/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Sprout, Plus, MapPin } from "lucide-react";

export default async function DashboardPage() {
  const user = await requireUser();
  if (!user.onboardingComplete) redirect("/onboarding");

  const gardens = await db.garden.findMany({
    where: gardenAccessFilter(user.id),
    include: {
      _count: { select: { beds: true } },
      seasons: { where: { isActive: true }, take: 1 },
    },
    orderBy: { createdAt: "asc" },
  });

  const firstName = user.name?.split(" ")[0];

  return (
    <div>
      {/* Page header */}
      <div className="px-[22px] md:px-8 pt-6 pb-5" style={{ borderBottom: "1px solid #E4E4DC" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#7DA84E", marginBottom: "6px" }}>
          <span style={{ display: "block", width: "16px", height: "1.5px", background: "#7DA84E", borderRadius: "1px", flexShrink: 0 }} />
          Garden Planner
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 5vw, 34px)", fontWeight: 800, color: "#111109", letterSpacing: "-0.03em", lineHeight: 0.95, fontVariationSettings: "'opsz' 36" }}>
          {firstName ? `Welcome, ${firstName}` : "Welcome back"}
        </h1>
        <p className="mt-2" style={{ color: "#6B6B5A", fontSize: "14px", fontFamily: "var(--font-body)" }}>
          {gardens.length === 1
            ? "Your garden is ready."
            : gardens.length > 1
            ? `${gardens.length} gardens planned.`
            : "Let's get growing."}
        </p>
      </div>
      <div className="px-[22px] md:px-8 py-5">

      {gardens.length === 0 ? (
        <div
          className="overflow-hidden"
          style={{
            borderRadius: "12px",
            border: "1px solid #E4E4DC",
            boxShadow: "0 2px 16px rgba(28,61,10,0.08)",
          }}
        >
          {/* Deep green header */}
          <div className="relative px-6 pt-8 pb-6" style={{ background: "#1C3D0A" }}>
            <div className="absolute inset-0" style={{
              backgroundImage: "radial-gradient(circle at 80% 20%, rgba(125,168,78,0.15) 0%, transparent 50%)",
            }} />
            <div className="relative">
              <Sprout className="w-10 h-10 mb-3" style={{ color: "rgba(168,216,112,0.6)" }} />
              <p className="font-display text-2xl font-bold" style={{ color: "#FDFDF8", letterSpacing: "-0.025em", fontVariationSettings: "'opsz' 28" }}>
                Set up your first garden
              </p>
              <p className="mt-1.5" style={{ color: "rgba(253,253,248,0.6)", fontSize: "15px" }}>
                Add your beds, map your space, and start planning.
              </p>
            </div>
          </div>
          <div className="px-6 py-4" style={{ background: "#F4F4EC" }}>
            <Link
              href="/onboarding"
              className="inline-flex items-center font-mono text-sm uppercase tracking-wider px-5 py-2.5 transition-colors"
              style={{
                background: "#1C3D0A",
                color: "#FDFDF8",
                borderRadius: "8px",
                letterSpacing: "0.1em",
                fontSize: "11px",
              }}
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
              className="block group overflow-hidden transition-all"
              style={{
                borderRadius: "12px",
                border: "1px solid #E4E4DC",
                boxShadow: "0 1px 4px rgba(28,61,10,0.04)",
                background: "#FDFDF8",
              }}
            >
              {/* Deep green header */}
              <div className="relative px-5 pt-5 pb-4" style={{ background: "#1C3D0A" }}>
                <div className="absolute inset-0" style={{
                  backgroundImage: "radial-gradient(circle at 85% 30%, rgba(125,168,78,0.12) 0%, transparent 55%)",
                }} />
                <div className="relative flex items-start justify-between gap-3">
                  <div>
                    <h2
                      className="font-display font-bold leading-tight"
                      style={{ color: "#FDFDF8", fontSize: "1.2rem", letterSpacing: "-0.02em", fontVariationSettings: "'opsz' 22" }}
                    >
                      {garden.name}
                    </h2>
                    {garden.seasons[0] && (
                      <p
                        className="font-mono uppercase mt-0.5"
                        style={{ color: "rgba(168,216,112,0.7)", fontSize: "9px", letterSpacing: "0.14em" }}
                      >
                        {garden.seasons[0].name}
                      </p>
                    )}
                  </div>
                  {garden.usdaZone && (
                    <span
                      className="shrink-0 font-mono text-xs font-medium px-2.5 py-1"
                      style={{
                        background: "rgba(253,253,248,0.1)",
                        color: "rgba(168,216,112,0.9)",
                        border: "1px solid rgba(168,216,112,0.2)",
                        borderRadius: "6px",
                        letterSpacing: "0.08em",
                        fontSize: "10px",
                      }}
                    >
                      Zone {garden.usdaZone}
                    </span>
                  )}
                </div>
              </div>

              {/* Stats row */}
              <div
                className="px-5 py-3.5 flex items-center justify-between"
                style={{ background: "#F4F4EC" }}
              >
                <div className="flex items-center gap-4" style={{ color: "#6B6B5A" }}>
                  <span className="flex items-center gap-1.5 font-mono" style={{ fontSize: "11px" }}>
                    <Sprout className="w-3.5 h-3.5" style={{ color: "#7DA84E" }} />
                    {garden._count.beds}{" "}
                    {garden._count.beds === 1 ? "bed" : "beds"}
                  </span>
                  <span className="flex items-center gap-1 font-mono" style={{ fontSize: "11px" }}>
                    <MapPin className="w-3 h-3" style={{ color: "#ADADAA" }} />
                    {garden.widthFt} × {garden.heightFt} ft
                  </span>
                </div>
                <span
                  className="font-display transition-colors"
                  style={{ color: "#7DA84E", fontSize: "18px" }}
                >
                  →
                </span>
              </div>
            </Link>
          ))}

          {user.subscriptionTier === "FREE" && gardens.length >= 1 && (
            <div
              className="p-4 text-center font-mono"
              style={{
                border: "1px dashed #D4E8BE",
                borderRadius: "10px",
                fontSize: "12px",
                color: "#6B6B5A",
                background: "#FDFDF8",
              }}
            >
              Free plan includes 1 garden.{" "}
              <Link href="/settings/billing" style={{ color: "#D4820A" }}>
                Upgrade to Pro
              </Link>{" "}
              for unlimited gardens.
            </div>
          )}

          {user.subscriptionTier === "PRO" && (
            <Link
              href="/onboarding"
              className="flex items-center justify-center gap-2 p-4 font-mono transition-colors"
              style={{
                border: "1px dashed #D4E8BE",
                borderRadius: "10px",
                fontSize: "11px",
                color: "#7DA84E",
                letterSpacing: "0.08em",
                background: "#FDFDF8",
              }}
            >
              <Plus className="w-4 h-4" />
              Add another garden
            </Link>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
