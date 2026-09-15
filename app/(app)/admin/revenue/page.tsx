import type { Metadata } from "next";
import { requireOwner } from "@/lib/owner";
import { getRevenue } from "@/app/actions/admin";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { RevenueTab } from "@/components/admin/RevenueTab";

export const metadata: Metadata = { title: "Revenue · Admin | Bare Root" };
export const dynamic = "force-dynamic";

export default async function AdminRevenuePage() {
  await requireOwner();
  const revenue = await getRevenue();
  return (
    <div className="container-narrow">
      <div className="px-[22px] md:px-8 pt-6 pb-5" style={{ borderBottom: "1px solid #E4E4DC" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px, 4vw, 30px)", fontWeight: 800, color: "#111109", letterSpacing: "-0.03em", lineHeight: 1, fontVariationSettings: "'opsz' 32" }}>
          Admin
        </h1>
        <p className="mt-2 text-sm" style={{ color: "#6B6B5A" }}>
          {revenue.error ? "Couldn't reach Stripe." : `$${(revenue.mrrCents / 100).toFixed(2)} a month from ${revenue.active} paying subscription${revenue.active === 1 ? "" : "s"}.`}
        </p>
      </div>
      <div className="px-[22px] md:px-8 py-5">
        <AdminTabs active="revenue" />
        <RevenueTab revenue={revenue} />
      </div>
    </div>
  );
}
