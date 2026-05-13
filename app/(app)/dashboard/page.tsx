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

  const firstName = user.name?.split(" ")[0];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <header className="mb-8">
        <p
          className="font-mono uppercase tracking-widest mb-1"
          style={{ fontSize: "10px", color: "#8B7A60", letterSpacing: "0.2em" }}
        >
          Garden Planner
        </p>
        <h1
          className="font-display font-bold leading-none"
          style={{ fontSize: "2.25rem", color: "#231A0D", fontVariationSettings: "'opsz' 42" }}
        >
          {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        </h1>
        <p className="mt-1.5" style={{ color: "#8B7A60", fontFamily: "var(--font-crimson-pro)", fontSize: "17px" }}>
          {gardens.length === 1
            ? "Your garden is ready."
            : gardens.length > 1
            ? `${gardens.length} gardens.`
            : "Let's get growing."}
        </p>
      </header>

      {gardens.length === 0 ? (
        <div
          className="overflow-hidden paper-grain"
          style={{
            borderRadius: "4px",
            border: "1px solid #D4C8A8",
            boxShadow: "0 2px 12px rgba(35,26,13,0.1)",
          }}
        >
          {/* Green header band */}
          <div className="relative px-6 pt-8 pb-6" style={{ background: "#2D5016" }}>
            <WoodlinePattern />
            <div className="relative">
              <Sprout className="w-10 h-10 mb-3" style={{ color: "rgba(245,237,218,0.6)" }} />
              <p className="font-display text-2xl font-bold" style={{ color: "#F5EDDA", fontVariationSettings: "'opsz' 28" }}>
                Set up your first garden
              </p>
              <p className="mt-1" style={{ color: "rgba(245,237,218,0.65)", fontFamily: "var(--font-crimson-pro)", fontSize: "16px" }}>
                Add your beds, map your space, and start planning.
              </p>
            </div>
          </div>
          <div className="px-6 py-4" style={{ background: "#EDE3C8" }}>
            <Link
              href="/onboarding"
              className="inline-flex items-center font-mono text-sm uppercase tracking-wider px-5 py-2.5 transition-colors"
              style={{
                background: "#2D5016",
                color: "#F5EDDA",
                borderRadius: "3px",
                letterSpacing: "0.1em",
                fontSize: "12px",
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
              className="block group overflow-hidden transition-all paper-grain"
              style={{
                borderRadius: "4px",
                border: "1px solid #D4C8A8",
                boxShadow: "0 1px 6px rgba(35,26,13,0.08)",
              }}
            >
              {/* Dark green header */}
              <div className="relative px-5 pt-5 pb-4" style={{ background: "#2D5016" }}>
                <WoodlinePattern />
                <div className="relative flex items-start justify-between gap-3">
                  <div>
                    <h2
                      className="font-display font-bold leading-tight"
                      style={{ color: "#F5EDDA", fontSize: "1.25rem", fontVariationSettings: "'opsz' 22" }}
                    >
                      {garden.name}
                    </h2>
                    {garden.seasons[0] && (
                      <p
                        className="font-mono uppercase mt-0.5"
                        style={{ color: "rgba(245,237,218,0.5)", fontSize: "10px", letterSpacing: "0.12em" }}
                      >
                        {garden.seasons[0].name}
                      </p>
                    )}
                  </div>
                  {garden.usdaZone && (
                    <span
                      className="shrink-0 font-mono text-xs font-medium px-2.5 py-1"
                      style={{
                        background: "rgba(245,237,218,0.12)",
                        color: "rgba(245,237,218,0.8)",
                        border: "1px solid rgba(245,237,218,0.2)",
                        borderRadius: "2px",
                        letterSpacing: "0.08em",
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
                style={{ background: "#EDE3C8" }}
              >
                <div className="flex items-center gap-4" style={{ color: "#8B7A60" }}>
                  <span className="flex items-center gap-1.5 font-mono" style={{ fontSize: "12px" }}>
                    <Sprout className="w-3.5 h-3.5" style={{ color: "#4A7C2F" }} />
                    {garden._count.beds}{" "}
                    {garden._count.beds === 1 ? "bed" : "beds"}
                  </span>
                  <span className="flex items-center gap-1 font-mono" style={{ fontSize: "12px" }}>
                    <MapPin className="w-3 h-3" style={{ color: "#8B7A60" }} />
                    {garden.widthFt} × {garden.heightFt} ft
                  </span>
                </div>
                <span
                  className="font-display transition-colors"
                  style={{ color: "#8B7A60", fontSize: "18px" }}
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
                border: "1px dashed #D4C8A8",
                borderRadius: "4px",
                fontSize: "13px",
                color: "#8B7A60",
              }}
            >
              Free plan includes 1 garden.{" "}
              <Link href="/settings/billing" style={{ color: "#C4790A" }}>
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
                border: "1px dashed #D4C8A8",
                borderRadius: "4px",
                fontSize: "12px",
                color: "#8B7A60",
                letterSpacing: "0.08em",
              }}
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

function WoodlinePattern() {
  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundImage:
          "repeating-linear-gradient(0deg,transparent,transparent 18px,rgba(245,237,218,0.04) 18px,rgba(245,237,218,0.04) 19px)," +
          "repeating-linear-gradient(90deg,transparent,transparent 18px,rgba(245,237,218,0.04) 18px,rgba(245,237,218,0.04) 19px)",
      }}
    />
  );
}
