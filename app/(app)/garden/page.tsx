import { requireUser } from "@/lib/auth";

export default async function GardenPage() {
  await requireUser();
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="font-display text-3xl font-semibold text-[#1C1C1A] mb-4">Garden</h1>
      <p className="text-[#6B6560]">Visual canvas — Phase 3</p>
    </div>
  );
}
