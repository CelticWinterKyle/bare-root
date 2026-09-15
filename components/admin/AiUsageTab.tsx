import type { AiUsage } from "@/app/actions/admin";

const INK = "#111109";
const MUTED = "#6B6B5A";
const RULE = "#E4E4DC";

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}
function tokens(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}
function when(iso: string) {
  const d = new Date(iso);
  const sameDay = new Date().toDateString() === d.toDateString();
  return new Intl.DateTimeFormat("en-US", sameDay ? { hour: "numeric", minute: "2-digit" } : { month: "short", day: "numeric" }).format(d);
}

function Tile({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="rounded-lg px-3.5 py-3 bg-white" style={{ border: `1px solid ${RULE}` }}>
      <div className="text-[11.5px]" style={{ color: MUTED }}>{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, letterSpacing: "-0.02em", color: INK, fontVariantNumeric: "tabular-nums", lineHeight: 1.15 }}>{value}</div>
      {sub && <div className="text-[11.5px] font-mono" style={{ color: warn ? "#7A2A18" : "#3A6B20" }}>{sub}</div>}
    </div>
  );
}

/** Runs per day for the last 30 days. Scale is the max day; a flat line means no runs. */
function Sparkline({ points }: { points: { day: string; runs: number }[] }) {
  const w = 600, h = 56, pad = 4;
  const max = Math.max(1, ...points.map((p) => p.runs));
  const xs = points.map((_, i) => pad + (i / (points.length - 1)) * (w - pad * 2));
  const ys = points.map((p) => h - pad - (p.runs / max) * (h - pad * 2));
  const line = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(" ");
  const area = `${line} L${xs[xs.length - 1].toFixed(1)} ${h - pad} L${xs[0].toFixed(1)} ${h - pad} Z`;
  const last = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full block" style={{ height: 56 }} role="img" aria-label={`AI runs per day, last 30 days, peak ${max}`}>
      <path d={area} fill="#E4F0D4" />
      <path d={line} fill="none" stroke="#3A6B20" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={3} fill="#1C3D0A" />
      <title>{`Today: ${last.runs}, peak day: ${max}`}</title>
    </svg>
  );
}

export function AiUsageTab({ usage }: { usage: AiUsage }) {
  const m = usage.month;
  const placedPct = m.asked > 0 ? Math.round((m.placed / m.asked) * 100) : null;
  const perRun = m.runs > 0 ? m.costCents / m.runs : 0;
  const th: React.CSSProperties = { textAlign: "left", fontSize: "12px", fontWeight: 600, color: INK, padding: "8px 10px 8px 0", borderBottom: `1.5px solid ${RULE}`, whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "8px 10px 8px 0", borderBottom: `1px solid ${RULE}`, fontSize: "13px", color: "#3A3A30", verticalAlign: "middle", whiteSpace: "nowrap" };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <Tile label="Runs this month" value={String(m.runs)} sub={`${usage.lastMonth.runs} last month`} />
        <Tile label="Cost this month" value={dollars(m.costCents)} sub={m.runs ? `${dollars(perRun)} per run` : `${dollars(usage.lastMonth.costCents)} last month`} />
        <Tile label="Plants placed" value={placedPct === null ? "—" : `${placedPct}%`} sub={m.asked ? `${m.placed} of ${m.asked} asked` : "no successful runs yet"} />
        <Tile label="Failures" value={String(m.failures)} sub={m.runs ? `avg ${(m.avgMs / 1000).toFixed(1)}s per run` : undefined} warn={m.failures > 0} />
      </div>

      <div className="rounded-lg px-3.5 py-3 bg-white" style={{ border: `1px solid ${RULE}` }}>
        <div className="flex items-baseline justify-between mb-1">
          <div className="text-[12.5px] font-semibold" style={{ color: INK }}>Runs per day</div>
          <div className="text-[11.5px]" style={{ color: MUTED }}>last 30 days</div>
        </div>
        <Sparkline points={usage.perDay} />
      </div>

      {usage.nearCap.length > 0 && (
        <div className="rounded-lg px-3.5 py-3" style={{ border: "1px solid #F0DCC8", background: "#FDF2E0" }}>
          <div className="text-[12.5px] font-semibold mb-1" style={{ color: "#9A5E08" }}>Near the {usage.capPerMonth}-a-month cap</div>
          <div className="text-[13px]" style={{ color: "#3A3A30" }}>
            {usage.nearCap.map((u) => `${u.user} (${u.runs})`).join(" · ")}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl bg-white" style={{ border: `1px solid ${RULE}` }}>
        <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 680 }}>
          <thead>
            <tr>
              <th style={{ ...th, paddingLeft: 14 }}>When</th>
              <th style={th}>User</th>
              <th style={th}>Model</th>
              <th style={th}>Tokens in / out</th>
              <th style={th}>Cost</th>
              <th style={th}>Placed</th>
              <th style={th}>Time</th>
            </tr>
          </thead>
          <tbody>
            {usage.recent.length === 0 && (
              <tr><td colSpan={7} style={{ ...td, padding: 24, textAlign: "center", color: MUTED, whiteSpace: "normal" }}>No runs recorded yet. Runs are logged from the moment this deploys; earlier ones only exist as the per-user counter.</td></tr>
            )}
            {usage.recent.map((r) => (
              <tr key={r.id}>
                <td style={{ ...td, paddingLeft: 14 }}>{when(r.at)}</td>
                <td style={{ ...td, whiteSpace: "normal", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>{r.user}</td>
                <td style={{ ...td, fontFamily: "var(--font-mono)", fontSize: 12, color: MUTED }}>{r.model.replace("claude-", "")}</td>
                <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{tokens(r.inputTokens)} / {tokens(r.outputTokens)}</td>
                <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{dollars(r.costCents)}</td>
                <td style={td}>
                  <span className="inline-block w-[7px] h-[7px] rounded-full mr-1.5 align-[1px]" style={{ background: !r.ok ? "#7A2A18" : r.placed < r.asked ? "#D4820A" : "#3A6B20" }} />
                  {r.ok ? `${r.placed} / ${r.asked}` : <span title={r.error ?? ""}>failed</span>}
                </td>
                <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{(r.durationMs / 1000).toFixed(1)}s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
