import type { Metadata } from "next";
import { requireOwner } from "@/lib/owner";
import { getAiUsage } from "@/app/actions/admin";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { AiUsageTab } from "@/components/admin/AiUsageTab";

export const metadata: Metadata = { title: "AI usage · Admin | Bare Root" };
export const dynamic = "force-dynamic";

export default async function AdminAiPage() {
  await requireOwner();
  const usage = await getAiUsage();
  return (
    <div className="container-narrow">
      <div className="px-[22px] md:px-8 pt-6 pb-5" style={{ borderBottom: "1px solid #E4E4DC" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px, 4vw, 30px)", fontWeight: 800, color: "#111109", letterSpacing: "-0.03em", lineHeight: 1, fontVariationSettings: "'opsz' 32" }}>
          Admin
        </h1>
        <p className="mt-2 text-sm" style={{ color: "#6B6B5A" }}>
          {usage.month.runs} AI layout{usage.month.runs === 1 ? "" : "s"} this month, about ${(usage.month.costCents / 100).toFixed(2)}.
        </p>
      </div>
      <div className="px-[22px] md:px-8 py-5">
        <AdminTabs active="ai" />
        <AiUsageTab usage={usage} />
      </div>
    </div>
  );
}
