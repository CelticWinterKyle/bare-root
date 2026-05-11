"use server";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

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
