"use server";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ReminderType } from "@/lib/generated/prisma/enums";
import { revalidatePath } from "next/cache";

export async function createCustomReminder(data: {
  title: string;
  body?: string;
  scheduledAt: string; // ISO datetime
  gardenId?: string;
}) {
  const user = await requireUser();

  const title = data.title.trim();
  if (!title) throw new Error("Title is required");

  const when = new Date(data.scheduledAt);
  if (Number.isNaN(when.getTime())) {
    throw new Error("Invalid date");
  }

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

export async function getUnreadCount(userId: string): Promise<number> {
  return db.reminder.count({
    where: {
      userId,
      sentAt: { not: null },
      dismissed: false,
    },
  });
}

export async function getRecentReminders(userId: string) {
  return db.reminder.findMany({
    where: {
      userId,
      dismissed: false,
    },
    orderBy: { scheduledAt: "desc" },
    take: 20,
    include: {
      planting: {
        include: {
          plant: { select: { name: true } },
          cell: { include: { bed: { select: { id: true, name: true, gardenId: true } } } },
        },
      },
    },
  });
}

export async function updateNotificationPreference(
  type: string,
  data: { enabled?: boolean; channelEmail?: boolean; channelPush?: boolean }
) {
  const user = await requireUser();
  await db.notificationPreference.upsert({
    where: { userId_type: { userId: user.id, type: type as never } },
    create: {
      userId: user.id,
      type: type as never,
      enabled: data.enabled ?? true,
      channelEmail: data.channelEmail ?? true,
      channelPush: data.channelPush ?? true,
    },
    update: data,
  });
  revalidatePath("/settings/notifications");
}
