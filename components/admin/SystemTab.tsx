"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, ExternalLink } from "lucide-react";
import { runMaintenance, type CronHealth, type FeedbackRow } from "@/app/actions/admin";
import { actionErrorMessage } from "@/lib/action-error";

const INK = "#111109";
const MUTED = "#6B6B5A";
const RULE = "#E4E4DC";

type Maint = Parameters<typeof runMaintenance>[0];

const ACTIONS: { name: Maint; label: string; what: string; params?: Record<string, string> }[] = [
  { name: "cleanup-reminders", label: "Clean up reminders", what: "Collapses duplicate reminders and deletes stale frost alerts. Safe to rerun." },
  { name: "seed-companions", label: "Seed companion pairs", what: "Adds the hand-picked companion pairings for plants that have none. Skips pairs that exist." },
  { name: "enrich-plants", label: "Enrich plant library", what: "Fills empty description, scientific name and timing fields on seed plants from the curated list." },
  { name: "backfill-images", label: "Backfill plant photos (40)", what: "Sources up to 40 missing plant photos from Pexels. Run again to continue.", params: { limit: "40" } },
];

function ago(iso: string | null, nowMs: number) {
  if (!iso) return "never";
  const m = Math.round((nowMs - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function Panel({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="rounded-lg px-3.5 py-3 bg-white" style={{ border: `1px solid ${RULE}` }}>
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-[12.5px] font-semibold" style={{ color: INK }}>{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export function SystemTab({ system, links }: { system: { crons: CronHealth[]; feedback: FeedbackRow[]; recordingSince: string | null }; links: Record<string, string> }) {
  const [nowMs] = useState(() => Date.now());
  const [busy, setBusy] = useState<Maint | null>(null);
  const [results, setResults] = useState<Partial<Record<Maint, string>>>({});
  const [confirm, setConfirm] = useState<Maint | null>(null);
  const [, startTransition] = useTransition();

  function run(a: (typeof ACTIONS)[number]) {
    if (confirm !== a.name) { setConfirm(a.name); return; }
    setConfirm(null); setBusy(a.name);
    startTransition(async () => {
      try {
        const r = await runMaintenance(a.name, a.params);
        const text = typeof r.body === "string" ? r.body : JSON.stringify(r.body);
        setResults((m) => ({ ...m, [a.name]: `${r.ok ? "OK" : `HTTP ${r.status}`} · ${text}` }));
        if (r.ok) toast.success(`${a.label}: done`); else toast.error(`${a.label} failed (${r.status})`);
      } catch (err) {
        toast.error(actionErrorMessage(err, `${a.label} failed`));
      } finally {
        setBusy(null);
      }
    });
  }

  const ext = (href: string, label: string) => (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-medium underline underline-offset-2" style={{ color: "#3A6B20" }}>
      {label} <ExternalLink className="w-3 h-3" />
    </a>
  );

  return (
    <div className="space-y-4">
      <Panel title="Scheduled jobs" right={<span className="text-[11.5px]" style={{ color: MUTED }}>{system.recordingSince ? `recording since ${new Date(system.recordingSince).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "no runs recorded yet"}</span>}>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr>{["Job", "Schedule", "Last run", "Result", "Sent", "Held", "Failed"].map((h) => <th key={h} style={{ textAlign: "left", fontSize: 12, fontWeight: 600, color: INK, padding: "4px 10px 6px 0", borderBottom: `1.5px solid ${RULE}` }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {system.crons.map((c) => {
                const dot = c.lastOk === null ? MUTED : c.overdue || c.lastOk === false ? "#7A2A18" : "#3A6B20";
                return (
                  <tr key={c.name}>
                    <td style={{ padding: "7px 10px 7px 0", borderBottom: `1px solid ${RULE}`, fontSize: 13, color: INK, fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                      <span className="inline-block w-[7px] h-[7px] rounded-full mr-2 align-[1px]" style={{ background: dot }} />{c.name}
                    </td>
                    <td style={{ padding: "7px 10px 7px 0", borderBottom: `1px solid ${RULE}`, fontSize: 13, color: "#3A3A30", whiteSpace: "nowrap" }}>{c.schedule}</td>
                    <td style={{ padding: "7px 10px 7px 0", borderBottom: `1px solid ${RULE}`, fontSize: 13, color: c.overdue ? "#7A2A18" : "#3A3A30", whiteSpace: "nowrap" }}>{ago(c.lastStartedAt, nowMs)}{c.overdue ? " · overdue" : ""}</td>
                    <td style={{ padding: "7px 10px 7px 0", borderBottom: `1px solid ${RULE}`, fontSize: 13, color: "#3A3A30" }} title={c.lastError ?? ""}>{c.lastOk === null ? "—" : c.lastOk ? "ok" : `failed: ${(c.lastError ?? "").slice(0, 60)}`}</td>
                    <td style={{ padding: "7px 10px 7px 0", borderBottom: `1px solid ${RULE}`, fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{c.lastSent}</td>
                    <td style={{ padding: "7px 10px 7px 0", borderBottom: `1px solid ${RULE}`, fontSize: 13, fontVariantNumeric: "tabular-nums", color: c.lastHeld ? "#9A5E08" : "#3A3A30" }}>{c.lastHeld}</td>
                    <td style={{ padding: "7px 10px 7px 0", borderBottom: `1px solid ${RULE}`, fontSize: 13, fontVariantNumeric: "tabular-nums", color: c.lastFailed ? "#7A2A18" : "#3A3A30" }}>{c.lastFailed}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11.5px]" style={{ color: MUTED }}>Held means the reminder is waiting on a channel that isn&apos;t configured (usually email). Overdue means no run in 1.5× the schedule.</p>
      </Panel>

      <Panel title="Maintenance">
        <div className="space-y-2">
          {ACTIONS.map((a) => (
            <div key={a.name} className="flex flex-wrap items-start gap-3 py-2" style={{ borderBottom: `1px solid ${RULE}` }}>
              <div className="flex-1 min-w-[240px]">
                <div className="text-[13.5px] font-medium" style={{ color: INK }}>{a.label}</div>
                <div className="text-[12.5px]" style={{ color: MUTED }}>{a.what}</div>
                {results[a.name] && <div className="mt-1 text-[11.5px] font-mono break-all" style={{ color: "#3A3A30" }}>{results[a.name]}</div>}
              </div>
              <button
                type="button"
                onClick={() => run(a)}
                disabled={busy !== null}
                className="text-[12.5px] font-medium px-3 py-1.5 rounded-lg disabled:opacity-50"
                style={confirm === a.name ? { background: "#9A5E08", color: "#FDFDF8" } : { border: `1px solid ${RULE}`, background: "#FDFDF8", color: INK }}
              >
                {busy === a.name ? <Loader2 className="w-4 h-4 animate-spin" /> : confirm === a.name ? "Click again to run" : "Run"}
              </button>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Elsewhere">
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {ext(links.vercelLogs, "Vercel logs")}
          {ext(links.vercelAnalytics, "Vercel analytics")}
          {ext(links.sentry, "Sentry")}
          {ext(links.resend, "Resend")}
          {ext(links.stripe, "Stripe")}
          {ext(links.clerk, "Clerk")}
        </div>
      </Panel>

      <Panel title="Feedback" right={<span className="text-[11.5px]" style={{ color: MUTED }}>last 20</span>}>
        {system.feedback.length === 0 ? (
          <div className="text-[13px]" style={{ color: MUTED }}>Nothing yet.</div>
        ) : (
          <ul className="space-y-3">
            {system.feedback.map((f) => (
              <li key={f.id} className="text-[13px]" style={{ color: "#3A3A30" }}>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium" style={{ color: INK }}>{f.user}</span>
                  <span className="text-[11.5px]" style={{ color: MUTED }}>{new Date(f.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{f.path ? ` · from ${f.path}` : ""}</span>
                  <a href={`mailto:${f.email}?subject=${encodeURIComponent("Re: your Bare Root feedback")}&body=${encodeURIComponent(`\n\n> ${f.message}`)}`} className="text-[11.5px] font-medium underline underline-offset-2" style={{ color: "#3A6B20" }}>Reply</a>
                </div>
                <div className="mt-0.5 whitespace-pre-wrap">{f.message}</div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
