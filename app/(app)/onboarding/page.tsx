import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { WizardShell } from "@/components/wizard/WizardShell";

export default async function OnboardingPage() {
  const user = await requireUser();
  if (user.onboardingComplete) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-semibold text-[#2D5016]">
            Bare Root
          </h1>
          <p className="text-[#6B6560] mt-2">Let's set up your garden</p>
        </div>
        <WizardShell />
      </div>
    </div>
  );
}
