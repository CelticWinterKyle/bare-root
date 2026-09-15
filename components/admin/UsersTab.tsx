"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Search, Loader2, Eye, EyeOff } from "lucide-react";
import type { Tier } from "@/lib/generated/prisma/enums";
import {
  type AdminUserRow,
  setUserTier,
  resetAiRuns,
  getLastSignIn,
  joinGardenAsViewer,
  leaveGardenAsViewer,
} from "@/app/actions/admin";
import { actionErrorMessage } from "@/lib/action-error";

type SortKey = "joined" | "email" | "tier" | "plantings" | "ai";

const INK = "#111109";
const MUTED = "#6B6B5A";
const RULE = "#E4E4DC";

function fmtDate(iso: string | null, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", opts).format(new Date(iso));
}

function relative(iso: string | null, nowMs: number): string {
  if (!iso) return "—";
  const d = (nowMs - new Date(iso).getTime()) / 86_400_000;
  if (d < 1) return "today";
  if (d < 2) return "yesterday";
  if (d < 7) return `${Math.floor(d)}d ago`;
  return fmtDate(iso);
}

function TierChip({ u, nowMs }: { u: AdminUserRow; nowMs: number }) {
  const trialing = u.trialEndsAt && new Date(u.trialEndsAt).getTime() > nowMs;
  const daysLeft = trialing ? Math.ceil((new Date(u.trialEndsAt!).getTime() - nowMs) / 86_400_000) : 0;
  if (u.tier === "PRO" && trialing) {
    return <Chip bg="#FDF2E0" fg="#9A5E08">Trial · {daysLeft}d</Chip>;
  }
  if (u.tier === "PRO") {
    return <Chip bg="#E4F0D4" fg="#1C3D0A">Pro{u.isComp ? " · comp" : ""}</Chip>;
  }
  return <Chip bg="#F4F4EC" fg={MUTED}>Free</Chip>;
}

function Chip({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }) {
  return (
    <span className="inline-block text-[12px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: bg, color: fg }}>
      {children}
    </span>
  );
}

export function UsersTab({ users: initial }: { users: AdminUserRow[] }) {
  const [users, setUsers] = useState(initial);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("joined");
  const [open, setOpen] = useState<string | null>(null);
  const [lastSignIn, setLastSignIn] = useState<Record<string, string | null | "loading">>({});
  const [isPending, startTransition] = useTransition();
  // One clock reading per render; TierChip and relative() read it.
  const [nowMs] = useState(() => Date.now());

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? users.filter((u) => u.email.toLowerCase().includes(needle) || (u.name ?? "").toLowerCase().includes(needle))
      : users;
    const plantings = (u: AdminUserRow) => u.gardens.reduce((n, g) => n + g.plantings, 0);
    return [...filtered].sort((a, b) => {
      switch (sort) {
        case "email": return a.email.localeCompare(b.email);
        case "tier": return (b.tier === "PRO" ? 1 : 0) - (a.tier === "PRO" ? 1 : 0) || a.email.localeCompare(b.email);
        case "plantings": return plantings(b) - plantings(a);
        case "ai": return b.aiRunsThisMonth - a.aiRunsThisMonth;
        default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  }, [users, q, sort]);

  function toggle(u: AdminUserRow) {
    const next = open === u.id ? null : u.id;
    setOpen(next);
    if (next && lastSignIn[u.id] === undefined) {
      setLastSignIn((m) => ({ ...m, [u.id]: "loading" }));
      getLastSignIn(u.id).then((iso) => setLastSignIn((m) => ({ ...m, [u.id]: iso })));
    }
  }

  function changeTier(u: AdminUserRow, tier: Tier) {
    const before = users;
    setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, tier, isComp: tier === "PRO" } : x)));
    startTransition(async () => {
      try {
        await setUserTier(u.id, tier);
        toast.success(`${u.name ?? u.email} is now ${tier === "PRO" ? "Pro" : "Free"}`);
      } catch (err) {
        setUsers(before);
        toast.error(actionErrorMessage(err, "Couldn't change the tier. Please try again."));
      }
    });
  }

  function resetRuns(u: AdminUserRow) {
    startTransition(async () => {
      try {
        await resetAiRuns(u.id);
        setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, aiRunsThisMonth: 0, aiRunsResetAt: null } : x)));
        toast.success(`AI runs reset for ${u.name ?? u.email}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Couldn't reset. Please try again."));
      }
    });
  }

  function toggleView(u: AdminUserRow, gardenId: string, viewing: boolean) {
    startTransition(async () => {
      try {
        if (viewing) await leaveGardenAsViewer(gardenId);
        else await joinGardenAsViewer(gardenId);
        setUsers((list) =>
          list.map((x) =>
            x.id === u.id
              ? { ...x, gardens: x.gardens.map((g) => (g.id === gardenId ? { ...g, ownerViewing: !viewing } : g)) }
              : x
          )
        );
        toast.success(viewing ? "Left the garden" : "You can open it read-only now");
      } catch (err) {
        toast.error(actionErrorMessage(err, "Couldn't do that. Please try again."));
      }
    });
  }

  const th: React.CSSProperties = { textAlign: "left", fontSize: "12px", fontWeight: 600, color: INK, padding: "8px 10px 8px 0", borderBottom: `1.5px solid ${RULE}`, whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "10px 10px 10px 0", borderBottom: `1px solid ${RULE}`, fontSize: "13.5px", color: "#3A3A30", verticalAlign: "middle" };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <label className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
          <input
            id="admin-user-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by email or name"
            className="w-full text-sm rounded-lg pl-9 pr-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#1C3D0A]"
            style={{ border: `1px solid ${RULE}`, color: INK }}
          />
        </label>
        <label className="text-xs" style={{ color: MUTED }}>
          Sort{" "}
          <select
            id="admin-user-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="text-sm rounded-lg px-2 py-2 bg-white"
            style={{ border: `1px solid ${RULE}`, color: INK }}
          >
            <option value="joined">Newest</option>
            <option value="email">Email</option>
            <option value="tier">Tier</option>
            <option value="plantings">Most plantings</option>
            <option value="ai">Most AI runs</option>
          </select>
        </label>
        {isPending && <Loader2 className="w-4 h-4 animate-spin" style={{ color: MUTED }} />}
      </div>

      <div className="overflow-x-auto rounded-xl bg-white" style={{ border: `1px solid ${RULE}` }}>
        <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 720 }}>
          <thead>
            <tr>
              <th style={{ ...th, paddingLeft: 14, width: 28 }} />
              <th style={th}>User</th>
              <th style={th}>Tier</th>
              <th style={th}>Gardens</th>
              <th style={th}>Plantings</th>
              <th style={th}>AI runs</th>
              <th style={th}>Joined</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const isOpen = open === u.id;
              const plantings = u.gardens.reduce((n, g) => n + g.plantings, 0);
              const signIn = lastSignIn[u.id];
              return (
                <RowGroup key={u.id}>
                  <tr onClick={() => toggle(u)} className="cursor-pointer hover:bg-[#FDFDF8]">
                    <td style={{ ...td, paddingLeft: 14 }}>
                      {isOpen ? <ChevronDown className="w-4 h-4" style={{ color: MUTED }} /> : <ChevronRight className="w-4 h-4" style={{ color: MUTED }} />}
                    </td>
                    <td style={td}>
                      <div className="font-medium" style={{ color: INK }}>{u.name ?? u.email}</div>
                      {u.name && <div className="text-xs" style={{ color: MUTED }}>{u.email}</div>}
                    </td>
                    <td style={td}><TierChip u={u} nowMs={nowMs} /></td>
                    <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{u.gardens.length}</td>
                    <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{plantings}</td>
                    <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{u.aiRunsThisMonth}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDate(u.createdAt)}</td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={7} style={{ padding: "0 14px 16px", borderBottom: `1px solid ${RULE}`, background: "#FDFDF8" }}>
                        <div className="pt-3 grid gap-4 md:grid-cols-[1fr_auto]">
                          <div className="text-[13px] space-y-2" style={{ color: "#3A3A30" }}>
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                              <span>Last sign-in: <b style={{ color: INK }}>{signIn === "loading" ? "…" : relative(signIn ?? null, nowMs)}</b></span>
                              <span>Joined: <b style={{ color: INK }}>{fmtDate(u.createdAt, { month: "short", day: "numeric", year: "numeric" })}</b></span>
                              <span>Timezone: <b style={{ color: INK }}>{u.timezone}</b></span>
                              {!u.onboardingComplete && <Chip bg="#FDF2E0" fg="#9A5E08">Never finished setup</Chip>}
                              {u.betaGrantedAt && <Chip bg="#E4F0D4" fg="#1C3D0A">Beta link</Chip>}
                              {u.hadTrial && !u.trialEndsAt && u.tier === "FREE" && <Chip bg="#F4F4EC" fg={MUTED}>Trial expired</Chip>}
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                              <span>Collaborating on: <b style={{ color: INK }}>{u.collaborationCount}</b></span>
                              <span>Push devices: <b style={{ color: INK }}>{u.pushDevices}</b></span>
                              <span>Feedback sent: <b style={{ color: INK }}>{u.feedbackCount}</b></span>
                              <span>AI runs this month: <b style={{ color: INK }}>{u.aiRunsThisMonth}</b>{u.aiRunsResetAt ? ` (since ${fmtDate(u.aiRunsResetAt)})` : ""}</span>
                            </div>
                            {u.gardens.length === 0 ? (
                              <div style={{ color: MUTED }}>No gardens yet.</div>
                            ) : (
                              <table style={{ borderCollapse: "collapse", marginTop: 4 }}>
                                <tbody>
                                  {u.gardens.map((g) => (
                                    <tr key={g.id}>
                                      <td style={{ padding: "3px 14px 3px 0", fontWeight: 500, color: INK }}>{g.name}</td>
                                      <td style={{ padding: "3px 14px 3px 0", color: MUTED, whiteSpace: "nowrap" }}>
                                        {g.beds} bed{g.beds === 1 ? "" : "s"} · {g.plantings} planting{g.plantings === 1 ? "" : "s"} · {g.harvests} harvest{g.harvests === 1 ? "" : "s"}
                                      </td>
                                      <td style={{ padding: "3px 0" }}>
                                        {g.ownerViewing ? (
                                          <span className="inline-flex items-center gap-2">
                                            <Link href={`/garden/${g.id}`} className="text-[12px] font-medium underline underline-offset-2" style={{ color: "#3A6B20" }}>
                                              Open read-only
                                            </Link>
                                            <button type="button" onClick={() => toggleView(u, g.id, true)} className="inline-flex items-center gap-1 text-[12px]" style={{ color: MUTED }}>
                                              <EyeOff className="w-3.5 h-3.5" /> Leave
                                            </button>
                                          </span>
                                        ) : (
                                          <button type="button" onClick={() => toggleView(u, g.id, false)} className="inline-flex items-center gap-1 text-[12px] font-medium" style={{ color: "#3A6B20" }}>
                                            <Eye className="w-3.5 h-3.5" /> View as collaborator
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                          <div className="flex md:flex-col gap-2 items-start">
                            {u.tier === "PRO" && !u.isComp ? (
                              <span className="text-[12px]" style={{ color: MUTED }}>Paying via Stripe</span>
                            ) : u.tier === "PRO" ? (
                              <button type="button" onClick={() => changeTier(u, "FREE")} className="text-[12.5px] font-medium px-3 py-1.5 rounded-lg bg-white hover:bg-[#F4F4EC]" style={{ border: `1px solid ${RULE}`, color: INK }}>
                                Remove comp
                              </button>
                            ) : (
                              <button type="button" onClick={() => changeTier(u, "PRO")} className="text-[12.5px] font-medium px-3 py-1.5 rounded-lg text-white hover:bg-[#3A6B20]" style={{ background: "#1C3D0A" }}>
                                Grant Pro
                              </button>
                            )}
                            <button type="button" onClick={() => resetRuns(u)} disabled={u.aiRunsThisMonth === 0 && !u.aiRunsResetAt} className="text-[12.5px] font-medium px-3 py-1.5 rounded-lg bg-white hover:bg-[#F4F4EC] disabled:opacity-40" style={{ border: `1px solid ${RULE}`, color: INK }}>
                              Reset AI runs
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </RowGroup>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} style={{ ...td, textAlign: "center", color: MUTED, padding: 24 }}>
                  No accounts match “{q}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs" style={{ color: MUTED }}>
        “Grant Pro” comps the account with no Stripe subscription. “View as collaborator” adds you to their garden as a read-only viewer; it shows in their collaborator list, and “Leave” removes it.
      </p>
    </div>
  );
}

/** A fragment with a key, for the two <tr>s that make one row. */
function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
