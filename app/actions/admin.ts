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
