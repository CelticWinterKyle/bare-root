import { requireUser } from "@/lib/auth";

export default async function SettingsPage() {
  await requireUser();
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="font-display text-3xl font-semibold text-[#1C1C1A] mb-4">Settings</h1>
      <p className="text-[#6B6560]">Account settings — Phase 10</p>
    </div>
  );
}
