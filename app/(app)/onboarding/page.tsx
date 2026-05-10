import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function OnboardingPage() {
  const user = await requireUser();

  if (user.onboardingComplete) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-semibold text-[#2D5016]">
            Bare Root
          </h1>
          <p className="text-[#6B6560] mt-2">Let's set up your garden</p>
        </div>
        {/* Wizard steps — built in Phase 1 */}
        <div className="bg-white rounded-2xl border border-[#E8E2D9] p-8 shadow-sm">
          <p className="text-[#6B6560] text-center">
            Setup wizard coming in Phase 1...
          </p>
        </div>
      </div>
    </div>
  );
}
