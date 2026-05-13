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
          <h1 className="font-display text-3xl font-semibold text-[#1C3D0A]">
            Bare Root
          </h1>
          <p className="text-[#6B6B5A] mt-2">Let's set up your garden</p>
        </div>
        <WizardShell />
      </div>
    </div>
  );
}
