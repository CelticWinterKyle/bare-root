import type { Revenue } from "@/app/actions/admin";

const INK = "#111109";
const MUTED = "#6B6B5A";
const RULE = "#E4E4DC";

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}
function day(iso: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date(iso));
}

function Tile({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="rounded-lg px-3.5 py-3 bg-white" style={{ border: `1px solid ${RULE}` }}>
      <div className="text-[11.5px]" style={{ color: MUTED }}>{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, letterSpacing: "-0.02em", color: INK, fontVariantNumeric: "tabular-nums", lineHeight: 1.15 }}>{value}</div>
      {sub && <div className="text-[11.5px] font-mono" style={{ color: warn ? "#7A2A18" : MUTED }}>{sub}</div>}
    </div>
  );
}

function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-lg px-3.5 py-3 bg-white" style={{ border: `1px solid ${RULE}` }}>
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-[12.5px] font-semibold" style={{ color: INK }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function RevenueTab({ revenue: r }: { revenue: Revenue }) {
  const conv = r.conversion;
  const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "—");
  const link = (href: string, label: string) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-[12px] font-medium underline underline-offset-2" style={{ color: "#3A6B20" }}>{label}</a>
  );

  return (
    <div className="space-y-4">
      {r.error && (
        <div className="rounded-lg px-3.5 py-3 text-[13px]" style={{ border: "1px solid #EBC9BE", background: "#F6E6E1", color: "#7A2A18" }}>
          Stripe didn&apos;t answer: {r.error}. The sign-up and paid counts below come from the database and are still current.
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <Tile label="Monthly recurring" value={dollars(r.mrrCents)} sub="annual plans counted as 1/12" />
        <Tile label="Paying now" value={String(r.active)} sub={r.trialing ? `${r.trialing} trialing` : "no trials running"} />
        <Tile label="Past due" value={String(r.pastDue)} sub={r.pastDue ? "card failed, still subscribed" : "all cards paying"} warn={r.pastDue > 0} />
        <Tile label="Canceled this month" value={String(r.canceledThisMonth)} />
      </div>

      <Panel title="Conversion">
        <div className="grid grid-cols-3 gap-3 text-[13px]" style={{ color: "#3A3A30" }}>
          <div><div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, color: INK }}>{conv.signedUp}</div><div className="text-[11.5px]" style={{ color: MUTED }}>signed up</div></div>
          <div><div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, color: INK }}>{conv.everPaid} <span className="text-[13px] font-normal" style={{ color: MUTED }}>({pct(conv.everPaid, conv.signedUp)})</span></div><div className="text-[11.5px]" style={{ color: MUTED }}>ever started paying</div></div>
          <div><div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, color: INK }}>{conv.payingNow} <span className="text-[13px] font-normal" style={{ color: MUTED }}>({pct(conv.payingNow, conv.signedUp)})</span></div><div className="text-[11.5px]" style={{ color: MUTED }}>paying today</div></div>
        </div>
      </Panel>

      <div className="grid md:grid-cols-2 gap-2.5">
        <Panel title="Trials ending in 7 days">
          {r.trialsEndingSoon.length === 0 ? (
            <div className="text-[13px]" style={{ color: MUTED }}>None.</div>
          ) : (
            <ul className="space-y-1.5 text-[13px]" style={{ color: "#3A3A30" }}>
              {r.trialsEndingSoon.map((t) => (
                <li key={t.user + t.endsAt} className="flex justify-between gap-3">
                  <span className="truncate">{t.user}</span>
                  <span className="whitespace-nowrap">{day(t.endsAt)} · {link(t.customerUrl, "Stripe")}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Failed payments">
          {r.failedPayments.length === 0 ? (
            <div className="text-[13px]" style={{ color: MUTED }}>None open.</div>
          ) : (
            <ul className="space-y-1.5 text-[13px]" style={{ color: "#3A3A30" }}>
              {r.failedPayments.map((f) => (
                <li key={f.user + f.at} className="flex justify-between gap-3">
                  <span className="truncate">{f.user}</span>
                  <span className="whitespace-nowrap">{dollars(f.amountCents)} · {day(f.at)} · {link(f.customerUrl, "Stripe")}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <p className="text-xs" style={{ color: MUTED }}>
        Read live from Stripe each time you open this tab; nothing here is stored. {link(r.dashboardUrl, "Open the Stripe dashboard")} for refunds, invoices and the business name.
      </p>
    </div>
  );
}
