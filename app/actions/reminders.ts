"use server";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ReminderType, type PlantingStatus } from "@/lib/generated/prisma/enums";
import { revalidatePath } from "next/cache";
import { customReminderSchema } from "@/lib/validation";
import { syncRemindersToStatus } from "@/lib/services/reminders";

export async function createCustomReminder(input: {
  title: string;
  body?: string;
  scheduledAt: string; // ISO datetime
  gardenId?: string;
  repeat?: "weekly" | "monthly";
}) {
  const user = await requireUser();

  const parsed = customReminderSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid reminder");
  }
  const data = parsed.data;
  const title = data.title;

  const when = new Date(data.scheduledAt);
  if (when.getTime() < Date.now()) {
    throw new Error("Reminder time must be in the future");
  }

  const recurring = data.repeat === "weekly" || data.repeat === "monthly";

  // If a gardenId is provided, confirm the user can at least view it so
  // the deep-link in the notification doesn't dump them onto a 404.
  if (data.gardenId) {
    const garden = await db.garden.findFirst({
      where: {
        id: data.gardenId,
        OR: [
          { userId: user.id },
          { collaborators: { some: { userId: user.id, acceptedAt: { not: null } } } },
        ],
      },
      select: { id: true },
    });
    if (!garden) throw new Error("Garden not found");
  }

  await db.reminder.create({
    data: {
      userId: user.id,
      gardenId: data.gardenId ?? null,
      type: ReminderType.CUSTOM,
      title,
      body: data.body?.trim() || null,
      scheduledAt: when,
      recurring,
      // Store a simple interval token (not a real cron) — the dispatcher
      // reads this to schedule the next occurrence.
      recurrenceCron: recurring ? data.repeat! : null,
    },
  });

  revalidatePath("/reminders");
}

export async function dismissReminder(reminderId: string) {
  const user = await requireUser();
  await db.reminder.updateMany({
    where: { id: reminderId, userId: user.id },
    data: { dismissed: true },
  });
  revalidatePath("/reminders");
}

// "Done" advances the planting to the status the reminder was nudging
// toward. HARVEST maps to HARVESTING (the plant keeps producing; HARVESTED
// is the end-of-life status the user sets in the bed).
const STATUS_FOR_REMINDER_TYPE: Partial<Record<ReminderType, PlantingStatus>> = {
  [ReminderType.START_SEEDS]: "SEEDS_STARTED",
  [ReminderType.TRANSPLANT]: "TRANSPLANTED",
  [ReminderType.HARVEST]: "HARVESTING",
};

// Never DOWNGRADE a planting from a stale reminder — marking an old
// "transplant" reminder done on a plant that's already harvesting must not
// drag the status backwards.
const STATUS_RANK: Record<PlantingStatus, number> = {
  PLANNED: 0,
  SEEDS_STARTED: 1,
  TRANSPLANTED: 2,
  ACTIVE: 3,
  HARVESTING: 4,
  HARVESTED: 5,
  FAILED: 6,
};

/**
 * Mark a reminder done: completes it AND reflects the task on the planting
 * (status advance + transplant date inference + clearing now-moot earlier
 * reminders). The reverse direction — status changes clearing reminders —
 * lives in updatePlantingStatus.
 */
export async function completeReminder(reminderId: string): Promise<void> {
  const user = await requireUser();

  const reminder = await db.reminder.findFirst({
    where: { id: reminderId, userId: user.id },
    include: {
      planting: {
        select: { id: true, status: true, transplantDate: true, cell: { select: { bed: { select: { id: true, gardenId: true } } } } },
      },
    },
  });
  if (!reminder) throw new Error("Reminder not found");

  const targetStatus = STATUS_FOR_REMINDER_TYPE[reminder.type];
  const planting = reminder.planting;

  if (planting && targetStatus && STATUS_RANK[targetStatus] > STATUS_RANK[planting.status]) {
    await db.planting.update({
      where: { id: planting.id },
      data: {
        status: targetStatus,
        ...(targetStatus === "TRANSPLANTED" && !planting.transplantDate
          ? { transplantDate: new Date() }
          : {}),
      },
    });
    await syncRemindersToStatus(planting.id, targetStatus);
    revalidatePath(`/garden/${planting.cell.bed.gardenId}/beds/${planting.cell.bed.id}`);
  }

  await db.reminder.updateMany({
    where: { id: reminderId, userId: user.id },
    data: { dismissed: true },
  });

  revalidatePath("/reminders");
  revalidatePath("/dashboard");
}

/**
 * Push a reminder out instead of killing it — "not this week." Re-arms
 * delivery (sentAt cleared, attempts reset) so it fires again at the new
 * time.
 */
export async function snoozeReminder(reminderId: string, days = 7): Promise<void> {
  const user = await requireUser();
  const boundedDays = Math.min(90, Math.max(1, Math.round(days)));

  const reminder = await db.reminder.findFirst({
    where: { id: reminderId, userId: user.id },
    select: { scheduledAt: true },
  });
  if (!reminder) throw new Error("Reminder not found");

  // Snooze from "now or the scheduled time, whichever is later" so an
  // overdue reminder lands days-from-today, not days-from-last-month.
  const base = reminder.scheduledAt > new Date() ? reminder.scheduledAt : new Date();
  const next = new Date(base.getTime() + boundedDays * 24 * 60 * 60 * 1000);

  await db.reminder.updateMany({
    where: { id: reminderId, userId: user.id },
    data: { scheduledAt: next, sentAt: null, sendAttempts: 0, dismissed: false },
  });

  revalidatePath("/reminders");
  revalidatePath("/dashboard");
}

const VALID_REMINDER_TYPES = new Set<string>(Object.values(ReminderType));

export async function updateNotificationPreference(
  type: string,
  data: { enabled?: boolean; channelEmail?: boolean; channelPush?: boolean }
) {
  const user = await requireUser();
  if (!VALID_REMINDER_TYPES.has(type)) {
    throw new Error("Invalid notification type");
  }
  const reminderType = type as ReminderType;
  await db.notificationPreference.upsert({
    where: { userId_type: { userId: user.id, type: reminderType } },
    create: {
      userId: user.id,
      type: reminderType,
      enabled: data.enabled ?? true,
      channelEmail: data.channelEmail ?? true,
      channelPush: data.channelPush ?? true,
    },
    update: data,
  });
  revalidatePath("/settings/notifications");
}
