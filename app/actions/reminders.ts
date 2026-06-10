"use server";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ReminderType } from "@/lib/generated/prisma/enums";
import { revalidatePath } from "next/cache";
import { customReminderSchema } from "@/lib/validation";

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
