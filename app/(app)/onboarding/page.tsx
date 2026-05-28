import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { WizardShell } from "@/components/wizard/WizardShell";

export default async function OnboardingPage() {
  const user = await requireUser();
  // Only send completed users to the dashboard if they actually have a
  // garden. A user who deleted all their gardens lands here from the empty
  // dashboard CTA and must be allowed back into the wizard — otherwise the
  // two pages bounce each other in a loop with no way to create a garden.
  const gardenCount = await db.garden.count({ where: { userId: user.id } });
  if (user.onboardingComplete && gardenCount > 0) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-semibold text-[#1C3D0A]">
            Bare Root
          </h1>
          <p className="text-[#6B6B5A] mt-2">Let&apos;s set up your garden</p>
        </div>
        <WizardShell />
      </div>
    </div>
  );
}
