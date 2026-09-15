"use server";

import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import { CollabRole, Tier } from "@/lib/generated/prisma/enums";
import { db } from "@/lib/db";
import { requireOwnerAction } from "@/lib/owner";
import { ActionError } from "@/lib/action-error";

/** Everything the Users tab needs for one row, plus the expanded panel. */
export type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  tier: Tier;
  isComp: boolean;
  trialEndsAt: string | null;
  hadTrial: boolean;
  betaGrantedAt: string | null;
  onboardingComplete: boolean;
  createdAt: string;
  timezone: string;
  aiRunsThisMonth: number;
  aiRunsResetAt: string | null;
  gardens: {
    id: string;
    name: string;
    beds: number;
    plantings: number;
    harvests: number;
    ownerViewing: boolean;
  }[];
  collaborationCount: number;
  feedbackCount: number;
  pushDevices: number;
};

export type AdminUsersSummary = { total: number; pro: number; trialing: number; newThisWeek: number };

/** Header numbers for the Users tab, computed here so the page stays a pure render. */
export async function summarizeUsers(users: AdminUserRow[]): Promise<AdminUsersSummary> {
  await requireOwnerAction();
  const nowMs = Date.now();
  const weekAgo = nowMs - 7 * 86_400_000;
  return {
    total: users.length,
    pro: users.filter((u) => u.tier === "PRO").length,
    trialing: users.filter((u) => u.trialEndsAt && new Date(u.trialEndsAt).getTime() > nowMs).length,
    newThisWeek: users.filter((u) => new Date(u.createdAt).getTime() > weekAgo).length,
  };
}

export async function listUsers(): Promise<AdminUserRow[]> {
  await requireOwnerAction();
  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      gardens: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          _count: { select: { beds: true } },
          seasons: { select: { _count: { select: { plantings: true } } } },
          collaborators: { where: { role: CollabRole.VIEWER }, select: { userId: true } },
        },
      },
      _count: { select: { collaborations: true, feedback: true, pushSubscriptions: true } },
    },
  });
  // Harvest counts by garden in one query rather than one per garden.
  const harvestRows = await db.harvestLog.groupBy({
    by: ["plantingId"],
    _count: { _all: true },
  });
  const harvestsByPlanting = new Map(harvestRows.map((r) => [r.plantingId, r._count._all]));
  const plantingGardens = await db.planting.findMany({
    where: { id: { in: [...harvestsByPlanting.keys()] } },
    select: { id: true, season: { select: { gardenId: true } } },
  });
  const harvestsByGarden = new Map<string, number>();
  for (const p of plantingGardens) {
    const g = p.season.gardenId;
    harvestsByGarden.set(g, (harvestsByGarden.get(g) ?? 0) + (harvestsByPlanting.get(p.id) ?? 0));
  }
  const owner = await requireOwnerAction();

  return users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    tier: u.subscriptionTier,
    isComp: u.subscriptionTier === "PRO" && !u.stripeSubscriptionId,
    trialEndsAt: u.trialEndsAt?.toISOString() ?? null,
    hadTrial: u.hadTrial,
    betaGrantedAt: u.betaGrantedAt?.toISOString() ?? null,
    onboardingComplete: u.onboardingComplete,
    createdAt: u.createdAt.toISOString(),
    timezone: u.timezone,
    aiRunsThisMonth: u.aiRunsThisMonth,
    aiRunsResetAt: u.aiRunsResetAt?.toISOString() ?? null,
    gardens: u.gardens.map((g) => ({
      id: g.id,
      name: g.name,
      beds: g._count.beds,
      plantings: g.seasons.reduce((n, s) => n + s._count.plantings, 0),
      harvests: harvestsByGarden.get(g.id) ?? 0,
      ownerViewing: g.collaborators.some((c) => c.userId === owner.id),
    })),
    collaborationCount: u._count.collaborations,
    feedbackCount: u._count.feedback,
    pushDevices: u._count.pushSubscriptions,
  }));
}

/** Clerk knows when they last signed in; the database doesn't. Fetched on expand only. */
export async function getLastSignIn(userId: string): Promise<string | null> {
  await requireOwnerAction();
  try {
    const client = await clerkClient();
    const cu = await client.users.getUser(userId);
    return cu.lastSignInAt ? new Date(cu.lastSignInAt).toISOString() : null;
  } catch {
    return null;
  }
}

export async function setUserTier(userId: string, tier: Tier): Promise<void> {
  await requireOwnerAction();
  const target = await db.user.findUnique({ where: { id: userId }, select: { stripeSubscriptionId: true } });
  if (!target) throw new ActionError("NOT_FOUND", "No such account");
  // A paying subscriber's tier is Stripe's to set: flipping it here would
  // desync from the subscription and the next webhook would flip it back.
  // Cancel in Stripe instead; the webhook downgrades them.
  if (tier === "FREE" && target.stripeSubscriptionId) {
    throw new ActionError("INVALID_INPUT", "This account has a live Stripe subscription. Cancel it in Stripe and the webhook will downgrade them.");
  }
  await db.user.update({ where: { id: userId }, data: { subscriptionTier: tier } });
  revalidatePath("/admin");
}

export async function resetAiRuns(userId: string): Promise<void> {
  await requireOwnerAction();
  await db.user.update({ where: { id: userId }, data: { aiRunsThisMonth: 0, aiRunsResetAt: null } });
  revalidatePath("/admin");
}

/**
 * "Open their garden": rather than impersonating (which would need a bypass
 * threaded through every access filter), the owner joins the garden as a
 * VIEWER collaborator. Every page already renders read-only for viewers, the
 * membership is a visible row the user could see in their own settings, and
 * leaving is one click. Nothing in the auth path changes.
 */
export async function joinGardenAsViewer(gardenId: string): Promise<void> {
  const owner = await requireOwnerAction();
  const garden = await db.garden.findUnique({ where: { id: gardenId }, select: { userId: true } });
  if (!garden) throw new ActionError("NOT_FOUND", "Garden not found");
  if (garden.userId === owner.id) return;
  await db.gardenCollaborator.upsert({
    where: { gardenId_userId: { gardenId, userId: owner.id } },
    create: { gardenId, userId: owner.id, role: CollabRole.VIEWER, acceptedAt: new Date() },
    update: { role: CollabRole.VIEWER, acceptedAt: new Date() },
  });
  revalidatePath("/admin");
  revalidatePath(`/garden/${gardenId}`);
}

export async function leaveGardenAsViewer(gardenId: string): Promise<void> {
  const owner = await requireOwnerAction();
  await db.gardenCollaborator.deleteMany({ where: { gardenId, userId: owner.id, role: CollabRole.VIEWER } });
  revalidatePath("/admin");
  revalidatePath(`/garden/${gardenId}`);
}

// ─── AI usage ─────────────────────────────────────────────────────────────────

export type AiUsage = {
  month: { runs: number; costCents: number; placed: number; asked: number; failures: number; avgMs: number };
  lastMonth: { runs: number; costCents: number };
  perDay: { day: string; runs: number }[]; // last 30 days, oldest first
  recent: {
    id: string;
    at: string;
    user: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costCents: number;
    asked: number;
    placed: number;
    ok: boolean;
    error: string | null;
    durationMs: number;
  }[];
  nearCap: { user: string; runs: number }[];
  capPerMonth: number;
};

export async function getAiUsage(): Promise<AiUsage> {
  await requireOwnerAction();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

  const [monthRows, lastMonthRows, recentRows, users] = await Promise.all([
    db.aiRun.findMany({ where: { createdAt: { gte: monthStart } }, select: { costCents: true, plantsAsked: true, plantsPlaced: true, ok: true, durationMs: true } }),
    db.aiRun.aggregate({ where: { createdAt: { gte: lastMonthStart, lt: monthStart } }, _count: { _all: true }, _sum: { costCents: true } }),
    db.aiRun.findMany({ orderBy: { createdAt: "desc" }, take: 40, include: { user: { select: { name: true, email: true } } } }),
    db.user.findMany({ where: { aiRunsThisMonth: { gte: 30 }, subscriptionTier: "PRO" }, select: { name: true, email: true, aiRunsThisMonth: true }, orderBy: { aiRunsThisMonth: "desc" }, take: 10 }),
  ]);
  const daily = await db.aiRun.findMany({ where: { createdAt: { gte: thirtyDaysAgo } }, select: { createdAt: true } });
  const byDay = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000);
    byDay.set(d.toISOString().slice(0, 10), 0);
  }
  for (const r of daily) {
    const k = r.createdAt.toISOString().slice(0, 10);
    if (byDay.has(k)) byDay.set(k, (byDay.get(k) ?? 0) + 1);
  }

  const okRows = monthRows.filter((r) => r.ok);
  return {
    month: {
      runs: monthRows.length,
      costCents: monthRows.reduce((n, r) => n + r.costCents, 0),
      placed: okRows.reduce((n, r) => n + r.plantsPlaced, 0),
      asked: okRows.reduce((n, r) => n + r.plantsAsked, 0),
      failures: monthRows.length - okRows.length,
      avgMs: monthRows.length ? Math.round(monthRows.reduce((n, r) => n + r.durationMs, 0) / monthRows.length) : 0,
    },
    lastMonth: { runs: lastMonthRows._count._all, costCents: lastMonthRows._sum.costCents ?? 0 },
    perDay: [...byDay.entries()].map(([day, runs]) => ({ day, runs })),
    recent: recentRows.map((r) => ({
      id: r.id,
      at: r.createdAt.toISOString(),
      user: r.user.name ?? r.user.email,
      model: r.model,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      costCents: r.costCents,
      asked: r.plantsAsked,
      placed: r.plantsPlaced,
      ok: r.ok,
      error: r.error,
      durationMs: r.durationMs,
    })),
    nearCap: users.map((u) => ({ user: u.name ?? u.email, runs: u.aiRunsThisMonth })),
    capPerMonth: 40,
  };
}

// ─── Revenue (live from Stripe, never stored) ────────────────────────────────

export type Revenue = {
  mrrCents: number;
  active: number;
  trialing: number;
  pastDue: number;
  canceledThisMonth: number;
  trialsEndingSoon: { user: string; endsAt: string; customerUrl: string }[];
  failedPayments: { user: string; amountCents: number; at: string; customerUrl: string }[];
  conversion: { signedUp: number; everPaid: number; payingNow: number };
  dashboardUrl: string;
  error: string | null;
};

export async function getRevenue(): Promise<Revenue> {
  await requireOwnerAction();
  const { stripe } = await import("@/lib/stripe");
  const live = (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live");
  const base = live ? "https://dashboard.stripe.com" : "https://dashboard.stripe.com/test";
  const empty: Revenue = {
    mrrCents: 0, active: 0, trialing: 0, pastDue: 0, canceledThisMonth: 0,
    trialsEndingSoon: [], failedPayments: [],
    conversion: { signedUp: 0, everPaid: 0, payingNow: 0 },
    dashboardUrl: base, error: null,
  };

  const [signedUp, everPaid] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { stripeSubscriptionId: { not: null } } }),
  ]);
  empty.conversion.signedUp = signedUp;
  empty.conversion.everPaid = everPaid;

  try {
    const now = Math.floor(Date.now() / 1000);
    const monthStart = Math.floor(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1) / 1000);
    const weekOut = now + 7 * 86_400;

    // Every non-canceled subscription, expanded so the customer email is on the object.
    const subs: import("stripe").Stripe.Subscription[] = [];
    for await (const s of stripe.subscriptions.list({ status: "all", limit: 100, expand: ["data.customer"] })) subs.push(s);

    const emailOf = (s: import("stripe").Stripe.Subscription) => {
      const c = s.customer;
      return typeof c === "string" ? c : "deleted" in c && c.deleted ? "(deleted customer)" : c.email ?? c.id;
    };
    const customerUrl = (s: import("stripe").Stripe.Subscription) => `${base}/customers/${typeof s.customer === "string" ? s.customer : s.customer.id}`;

    let mrr = 0;
    for (const s of subs) {
      if (s.status !== "active") continue;
      for (const item of s.items.data) {
        const p = item.price;
        if (!p.unit_amount || !p.recurring) continue;
        const monthly = p.recurring.interval === "year" ? p.unit_amount / 12 : p.recurring.interval === "month" ? p.unit_amount : 0;
        mrr += monthly * (item.quantity ?? 1) / (p.recurring.interval_count || 1);
      }
    }
    empty.mrrCents = Math.round(mrr);
    empty.active = subs.filter((s) => s.status === "active").length;
    empty.trialing = subs.filter((s) => s.status === "trialing").length;
    empty.pastDue = subs.filter((s) => s.status === "past_due" || s.status === "unpaid").length;
    empty.canceledThisMonth = subs.filter((s) => s.status === "canceled" && (s.canceled_at ?? 0) >= monthStart).length;
    empty.conversion.payingNow = empty.active;
    empty.trialsEndingSoon = subs
      .filter((s) => s.status === "trialing" && s.trial_end && s.trial_end <= weekOut)
      .sort((a, b) => (a.trial_end ?? 0) - (b.trial_end ?? 0))
      .map((s) => ({ user: emailOf(s), endsAt: new Date((s.trial_end ?? 0) * 1000).toISOString(), customerUrl: customerUrl(s) }));

    const failed = await stripe.invoices.list({ status: "open", limit: 20, expand: ["data.customer"] });
    empty.failedPayments = failed.data
      .filter((inv) => (inv.attempt_count ?? 0) > 0)
      .map((inv) => {
        const c = inv.customer;
        const id = typeof c === "string" ? c : c?.id ?? "";
        const email = typeof c === "string" || !c || ("deleted" in c && c.deleted) ? id : c.email ?? id;
        return { user: email, amountCents: inv.amount_due, at: new Date((inv.created ?? 0) * 1000).toISOString(), customerUrl: `${base}/customers/${id}` };
      });
    return empty;
  } catch (err) {
    console.error("getRevenue failed:", err);
    return { ...empty, error: err instanceof Error ? err.message : "Stripe request failed" };
  }
}

// ─── System ───────────────────────────────────────────────────────────────────

export type CronHealth = {
  name: string;
  schedule: string;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastOk: boolean | null;
  lastSent: number;
  lastHeld: number;
  lastFailed: number;
  lastError: string | null;
  overdue: boolean;
};

export type FeedbackRow = { id: string; at: string; user: string; email: string; path: string | null; message: string };

const CRONS: { name: string; schedule: string; everyMs: number }[] = [
  { name: "dispatch-reminders", schedule: "hourly", everyMs: 3_600_000 },
  { name: "refresh-weather", schedule: "every 3 hours", everyMs: 3 * 3_600_000 },
  { name: "frost-check", schedule: "daily, 08:00 UTC", everyMs: 24 * 3_600_000 },
  { name: "water-check", schedule: "daily, 13:00 UTC", everyMs: 24 * 3_600_000 },
];

export async function getSystem(): Promise<{ crons: CronHealth[]; feedback: FeedbackRow[]; recordingSince: string | null }> {
  await requireOwnerAction();
  const now = Date.now();
  const [lastRuns, feedback, first] = await Promise.all([
    Promise.all(CRONS.map((c) => db.cronRun.findFirst({ where: { name: c.name }, orderBy: { startedAt: "desc" } }))),
    db.feedback.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { user: { select: { name: true, email: true } } } }),
    db.cronRun.findFirst({ orderBy: { startedAt: "asc" }, select: { startedAt: true } }),
  ]);
  return {
    recordingSince: first?.startedAt.toISOString() ?? null,
    crons: CRONS.map((c, i) => {
      const r = lastRuns[i];
      // Overdue = no run within 1.5× its interval (allows for cron jitter).
      const overdue = !r ? false : now - r.startedAt.getTime() > c.everyMs * 1.5;
      return {
        name: c.name,
        schedule: c.schedule,
        lastStartedAt: r?.startedAt.toISOString() ?? null,
        lastFinishedAt: r?.finishedAt?.toISOString() ?? null,
        lastOk: r ? r.ok : null,
        lastSent: r?.sent ?? 0,
        lastHeld: r?.held ?? 0,
        lastFailed: r?.failed ?? 0,
        lastError: r?.error ?? null,
        overdue,
      };
    }),
    feedback: feedback.map((f) => ({ id: f.id, at: f.createdAt.toISOString(), user: f.user.name ?? f.user.email, email: f.user.email, path: f.path, message: f.message })),
  };
}

/**
 * The maintenance routes, callable from the System tab. Each route still
 * self-authenticates; this just lets a button replace a console command.
 * Returns the route's JSON so the result readout is exactly what the route
 * said.
 */
export async function runMaintenance(
  name: "cleanup-reminders" | "seed-companions" | "enrich-plants" | "backfill-images",
  params: Record<string, string> = {}
): Promise<{ ok: boolean; status: number; body: unknown }> {
  await requireOwnerAction();
  const { headers: nextHeaders } = await import("next/headers");
  const h = await nextHeaders();
  const cookie = h.get("cookie") ?? "";
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${base}/api/admin/${name}${qs ? `?${qs}` : ""}`, {
    method: "POST",
    headers: { cookie, "x-admin-secret": process.env.CRON_SECRET ?? "" },
    cache: "no-store",
  });
  let body: unknown = null;
  try { body = await res.json(); } catch { body = await res.text().catch(() => null); }
  return { ok: res.ok, status: res.status, body };
}
