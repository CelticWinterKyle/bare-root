"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, Check, Loader2, Link2 } from "lucide-react";
import { type BetaInviteRow, createBetaInvite, revokeBetaInvite, restoreBetaInvite } from "@/app/actions/admin";
import { actionErrorMessage } from "@/lib/action-error";

const INK = "#111109";
const MUTED = "#6B6B5A";
const RULE = "#E4E4DC";

const STATUS: Record<BetaInviteRow["status"], { label: string; bg: string; fg: string }> = {
  active: { label: "Active", bg: "#E4F0D4", fg: "#1C3D0A" },
  used: { label: "Used", bg: "#F4F4EC", fg: MUTED },
  expired: { label: "Expired", bg: "#F4F4EC", fg: MUTED },
  revoked: { label: "Revoked", bg: "#F6E6E1", fg: "#7A2A18" },
};

function fmt(iso: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(iso));
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          toast.success("Link copied");
          setTimeout(() => setDone(false), 1800);
        } catch {
          toast.error("Couldn't copy. Select the link and copy it by hand.");
        }
      }}
      className="inline-flex items-center gap-1 text-[12px] font-medium px-2 py-1 rounded-md bg-white hover:bg-[#F4F4EC]"
      style={{ border: `1px solid ${RULE}`, color: INK }}
    >
      {done ? <Check className="w-3.5 h-3.5" style={{ color: "#3A6B20" }} /> : <Copy className="w-3.5 h-3.5" />}
      {done ? "Copied" : "Copy link"}
    </button>
  );
}

export function BetaInvitesPanel({ invites: initial }: { invites: BetaInviteRow[] }) {
  const [invites, setInvites] = useState(initial);
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [maxUses, setMaxUses] = useState("1");
  const [expires, setExpires] = useState("30");
  const [isPending, startTransition] = useTransition();
  const [showAll, setShowAll] = useState(false);

  function create() {
    if (!label.trim()) { toast.error("Give the link a name, like who it's for."); return; }
    startTransition(async () => {
      try {
        const row = await createBetaInvite({
          label,
          note: note || undefined,
          maxUses: Number(maxUses) || 1,
          expiresInDays: expires === "never" ? null : Number(expires),
        });
        setInvites((l) => [row, ...l]);
        setLabel(""); setNote("");
        try { await navigator.clipboard.writeText(row.url); toast.success(`Link for ${row.label} created and copied`); }
        catch { toast.success(`Link for ${row.label} created`); }
      } catch (err) {
        toast.error(actionErrorMessage(err, "Couldn't create the link. Please try again."));
      }
    });
  }

  function toggleRevoke(i: BetaInviteRow) {
    startTransition(async () => {
      try {
        if (i.revokedAt) await restoreBetaInvite(i.id); else await revokeBetaInvite(i.id);
        setInvites((l) => l.map((x) => (x.id === i.id ? { ...x, revokedAt: i.revokedAt ? null : new Date().toISOString(), status: i.revokedAt ? (x.uses >= x.maxUses ? "used" : "active") : "revoked" } : x)));
        toast.success(i.revokedAt ? "Link restored" : "Link revoked");
      } catch (err) {
        toast.error(actionErrorMessage(err, "Couldn't change that link."));
      }
    });
  }

  const visible = showAll ? invites : invites.filter((i) => i.status === "active" || i.status === "used").slice(0, 8);
  const hidden = invites.length - visible.length;
  const inputStyle: React.CSSProperties = { border: `1px solid ${RULE}`, color: INK };

  return (
    <div className="rounded-lg px-3.5 py-3 bg-white mt-6" style={{ border: `1px solid ${RULE}` }}>
      <div className="flex items-baseline justify-between mb-1">
        <div className="text-[13px] font-semibold inline-flex items-center gap-1.5" style={{ color: INK }}>
          <Link2 className="w-4 h-4" style={{ color: "#3A6B20" }} /> Beta links
        </div>
        <div className="text-[11.5px]" style={{ color: MUTED }}>{invites.filter((i) => i.status === "active").length} active</div>
      </div>
      <p className="text-[12.5px] mb-3" style={{ color: MUTED }}>
        One link per person. Whoever signs up through it gets Pro, and their name lands on the row so you know who came in.
      </p>

      <div className="grid gap-2 md:grid-cols-[1.2fr_1.4fr_auto_auto_auto] items-end mb-4">
        <label className="text-[11.5px]" style={{ color: MUTED }}>For
          <input id="beta-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Robyn's friend Dana" className="mt-0.5 w-full text-sm rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#1C3D0A]" style={inputStyle} onKeyDown={(e) => { if (e.key === "Enter") create(); }} />
        </label>
        <label className="text-[11.5px]" style={{ color: MUTED }}>Note (optional)
          <input id="beta-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="raised beds, zone 6a" className="mt-0.5 w-full text-sm rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#1C3D0A]" style={inputStyle} />
        </label>
        <label className="text-[11.5px]" style={{ color: MUTED }}>Uses
          <select id="beta-uses" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} className="mt-0.5 block text-sm rounded-lg px-2 py-1.5 bg-white" style={inputStyle}>
            <option value="1">1</option><option value="5">5</option><option value="25">25</option>
          </select>
        </label>
        <label className="text-[11.5px]" style={{ color: MUTED }}>Expires
          <select id="beta-expires" value={expires} onChange={(e) => setExpires(e.target.value)} className="mt-0.5 block text-sm rounded-lg px-2 py-1.5 bg-white" style={inputStyle}>
            <option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option><option value="never">Never</option>
          </select>
        </label>
        <button type="button" onClick={create} disabled={isPending} className="text-[13px] font-medium px-3.5 py-1.5 rounded-lg text-white hover:bg-[#3A6B20] disabled:opacity-50" style={{ background: "#1C3D0A" }}>
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generate"}
        </button>
      </div>

      {invites.length === 0 ? (
        <div className="text-[13px]" style={{ color: MUTED }}>No links yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 600 }}>
            <thead>
              <tr>{["For", "Status", "Link", "Used by", "Created", ""].map((h) => <th key={h} style={{ textAlign: "left", fontSize: 12, fontWeight: 600, color: INK, padding: "4px 10px 6px 0", borderBottom: `1.5px solid ${RULE}` }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {visible.map((i) => {
                const s = STATUS[i.status];
                const td: React.CSSProperties = { padding: "8px 10px 8px 0", borderBottom: `1px solid ${RULE}`, fontSize: 13, color: "#3A3A30", verticalAlign: "top" };
                return (
                  <tr key={i.id}>
                    <td style={{ ...td, color: INK, fontWeight: 500 }}>
                      {i.label}
                      {i.note && <div className="text-[11.5px] font-normal" style={{ color: MUTED }}>{i.note}</div>}
                    </td>
                    <td style={td}>
                      <span className="inline-block text-[11.5px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: s.bg, color: s.fg }}>{s.label}</span>
                      <div className="text-[11px] mt-0.5" style={{ color: MUTED }}>{i.uses}/{i.maxUses}{i.expiresAt ? ` · until ${fmt(i.expiresAt)}` : ""}</div>
                    </td>
                    <td style={td}>
                      {i.status === "active" ? <CopyButton text={i.url} /> : <span className="text-[11.5px] font-mono" style={{ color: MUTED }}>{i.code.slice(0, 6)}…</span>}
                    </td>
                    <td style={td}>
                      {i.redeemedBy.length === 0 ? <span style={{ color: MUTED }}>—</span> : i.redeemedBy.map((r) => <div key={r.at}>{r.user} <span className="text-[11px]" style={{ color: MUTED }}>{fmt(r.at)}</span></div>)}
                    </td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{fmt(i.createdAt)}</td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {(i.status === "active" || i.status === "revoked") && (
                        <button type="button" onClick={() => toggleRevoke(i)} disabled={isPending} className="text-[12px] font-medium underline underline-offset-2" style={{ color: i.revokedAt ? "#3A6B20" : "#7A2A18" }}>
                          {i.revokedAt ? "Restore" : "Revoke"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {hidden > 0 && !showAll && (
            <button type="button" onClick={() => setShowAll(true)} className="mt-2 text-[12px] font-medium underline underline-offset-2" style={{ color: MUTED }}>
              Show {hidden} more (expired and revoked)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
