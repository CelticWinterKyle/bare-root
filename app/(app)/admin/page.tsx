import type { Metadata } from "next";
import Link from "next/link";
import { requireOwner } from "@/lib/owner";
import { getOverview } from "@/app/actions/admin";
import { AdminTabs } from "@/components/admin/AdminTabs";

export const metadata: Metadata = { title: "Overview · Admin | Bare Root" };
export const dynamic = "force-dynamic";

const INK = "#111109";
const MUTED = "#6B6B5A";
const RULE = "#E4E4DC";

function Tile({ label, value, sub, href }: { label: string; value: string; sub?: string; href: string }) {
  return (
    <Link href={href} className="block rounded-lg px-3.5 py-3 bg-white hover:bg-[#FDFDF8]" style={{ border: `1px solid ${RULE}` }}>
      <div className="text-[11.5px]" style={{ color: MUTED }}>{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, letterSpacing: "-0.02em", color: INK, fontVariantNumeric: "tabular-nums", lineHeight: 1.15 }}>{value}</div>
      {sub && <div className="text-[11.5px] font-mono" style={{ color: "#3A6B20" }}>{sub}</div>}
    </Link>
  );
}

export default async function AdminOverviewPage() {
  await requireOwner();
  const o = await getOverview();
  const warn = o.needsYou.filter((n) => n.kind === "warn").length;
  return (
    <div className="container-narrow">
      <div className="px-[22px] md:px-8 pt-6 pb-5" style={{ borderBottom: "1px solid #E4E4DC" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px, 4vw, 30px)", fontWeight: 800, color: "#111109", letterSpacing: "-0.03em", lineHeight: 1, fontVariationSettings: "'opsz' 32" }}>
          Admin
        </h1>
        <p className="mt-2 text-sm" style={{ color: MUTED }}>
          {warn === 0 ? "Everything's running." : `${warn} item${warn === 1 ? "" : "s"} want${warn === 1 ? "s" : ""} a decision.`}
        </p>
      </div>
      <div className="px-[22px] md:px-8 py-5 space-y-4">
        <AdminTabs active="overview" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <Tile label="Users" value={String(o.users.total)} sub={o.users.newThisWeek ? `+${o.users.newThisWeek} this week` : "none new this week"} href="/admin" />
          <Tile label="On Pro" value={String(o.users.pro)} sub={o.users.trialing ? `${o.users.trialing} trialing` : undefined} href="/admin/revenue" />
          <Tile label="AI runs this month" value={String(o.ai.runsThisMonth)} sub={`≈ $${(o.ai.costCents / 100).toFixed(2)}`} href="/admin/ai" />
          <Tile label="Reminders sent, 7d" value={String(o.reminders.sent7d)} sub={o.reminders.held ? `${o.reminders.held} held` : "none held"} href="/admin/system" />
        </div>
        <div className="grid md:grid-cols-[1.3fr_1fr] gap-2.5">
          <div className="rounded-lg px-3.5 py-3 bg-white" style={{ border: `1px solid ${RULE}` }}>
            <div className="text-[12.5px] font-semibold mb-2" style={{ color: INK }}>This week</div>
            {o.thisWeek.length === 0 ? (
              <div className="text-[13px]" style={{ color: MUTED }}>Quiet. No sign-ups, feedback or harvests in the last seven days.</div>
            ) : (
              <ul className="space-y-1.5">
                {o.thisWeek.map((e, i) => (
                  <li key={i} className="flex gap-3 text-[13px]" style={{ color: "#3A3A30" }}>
                    <span className="shrink-0 w-9 text-[11.5px]" style={{ color: MUTED }}>{new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(new Date(e.at))}</span>
                    <span>{e.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-lg px-3.5 py-3 bg-white" style={{ border: `1px solid ${RULE}` }}>
            <div className="text-[12.5px] font-semibold mb-2" style={{ color: INK }}>Needs you</div>
            <ul className="space-y-1.5">
              {o.needsYou.map((n, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px]" style={{ color: "#3A3A30" }}>
                  <span className="mt-[6px] inline-block w-[7px] h-[7px] rounded-full shrink-0" style={{ background: n.kind === "warn" ? "#D4820A" : "#3A6B20" }} />
                  {n.href ? <Link href={n.href} className="underline underline-offset-2 decoration-[#E4E4DC] hover:decoration-current">{n.text}</Link> : <span>{n.text}</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
