import type { Metadata } from "next";
import { requireOwner } from "@/lib/owner";
import { getSystem } from "@/app/actions/admin";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { SystemTab } from "@/components/admin/SystemTab";

export const metadata: Metadata = { title: "System · Admin | Bare Root" };
export const dynamic = "force-dynamic";

export default async function AdminSystemPage() {
  await requireOwner();
  const system = await getSystem();
  const problems = system.crons.filter((c) => c.overdue || c.lastOk === false).length;
  const links = {
    vercelLogs: "https://vercel.com/celticwinterkyles-projects/bare-root/logs",
    vercelAnalytics: "https://vercel.com/celticwinterkyles-projects/bare-root/analytics",
    sentry: process.env.SENTRY_ORG_URL ?? "https://sentry.io",
    resend: "https://resend.com/emails",
    stripe: (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live") ? "https://dashboard.stripe.com" : "https://dashboard.stripe.com/test",
    clerk: "https://dashboard.clerk.com",
  };
  return (
    <div className="container-narrow">
      <div className="px-[22px] md:px-8 pt-6 pb-5" style={{ borderBottom: "1px solid #E4E4DC" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px, 4vw, 30px)", fontWeight: 800, color: "#111109", letterSpacing: "-0.03em", lineHeight: 1, fontVariationSettings: "'opsz' 32" }}>
          Admin
        </h1>
        <p className="mt-2 text-sm" style={{ color: "#6B6B5A" }}>
          {problems === 0 ? "All four scheduled jobs are on time." : `${problems} scheduled job${problems === 1 ? "" : "s"} need${problems === 1 ? "s" : ""} a look.`}
        </p>
      </div>
      <div className="px-[22px] md:px-8 py-5">
        <AdminTabs active="system" />
        <SystemTab system={system} links={links} />
      </div>
    </div>
  );
}
