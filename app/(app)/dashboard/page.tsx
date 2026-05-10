import { requireUser } from "@/lib/auth";
import Link from "next/link";

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-[#1C1C1A]">
          Welcome back{user.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-[#6B6560] mt-1">Your gardens are ready.</p>
      </header>

      {/* Placeholder — gardens load here in Phase 1 */}
      <div className="bg-[#F5F0E8] rounded-xl p-8 text-center border border-[#E8E2D9]">
        <p className="font-display text-lg text-[#2D5016] mb-2">
          Set up your first garden
        </p>
        <p className="text-sm text-[#6B6560] mb-4">
          Tell us about your space and we'll build your planting plan.
        </p>
        <Link
          href="/onboarding"
          className="inline-flex bg-[#2D5016] text-white px-6 py-3 rounded-lg text-sm font-medium hover:bg-[#3d6b1e] transition-colors"
        >
          Start setup →
        </Link>
      </div>
    </div>
  );
}
