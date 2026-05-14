import { db } from "@/lib/db";
import { sendPushNotification } from "@/lib/api/push";
import { sendReminderEmail, buildReminderEmailHtml } from "@/lib/api/email";

function isLocalMorning(utcNow: Date, timezone: string): boolean {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    });
    const hour = parseInt(formatter.format(utcNow));
    return hour >= 7 && hour < 9;
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  const authHeader = req.headers.get("authorization");
  const hasBearer = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  if (!isVercelCron && !hasBearer) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Absolute URL required for email <a href> links and SW push payloads.
  // Fail fast rather than send reminders with broken relative URLs.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    console.error("NEXT_PUBLIC_APP_URL is not set — refusing to dispatch reminders");
    return Response.json({ ok: false, error: "missing_app_url" }, { status: 500 });
  }

  const now = new Date();

  const reminders = await db.reminder.findMany({
    where: {
      scheduledAt: { lte: now },
      sentAt: null,
      dismissed: false,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          timezone: true,
          pushSubscriptions: true,
        },
      },
      planting: {
        include: {
          cell: { include: { bed: { select: { id: true, gardenId: true } } } },
        },
      },
    },
  });

  // Group by userId
  const byUser = new Map<string, typeof reminders>();
  for (const r of reminders) {
    const arr = byUser.get(r.userId) ?? [];
    arr.push(r);
    byUser.set(r.userId, arr);
  }

  let dispatched = 0;

  for (const [, userReminders] of byUser) {
    const user = userReminders[0].user;

    if (!isLocalMorning(now, user.timezone)) continue;

    for (const reminder of userReminders) {
      const pref = await db.notificationPreference.findUnique({
        where: { userId_type: { userId: user.id, type: reminder.type as never } },
      });

      const sendEmail = pref?.channelEmail ?? true;
      const sendPush = pref?.channelPush ?? true;
      const enabled = pref?.enabled ?? true;

      if (!enabled) {
        await db.reminder.update({ where: { id: reminder.id }, data: { dismissed: true } });
        continue;
      }

      const url = reminder.planting
        ? `${appUrl}/garden/${reminder.planting.cell.bed.gardenId}/beds/${reminder.planting.cell.bed.id}/plantings/${reminder.planting.id}`
        : reminder.gardenId
        ? `${appUrl}/garden/${reminder.gardenId}`
        : `${appUrl}/reminders`;

      if (sendEmail) {
        const html = buildReminderEmailHtml(reminder.title, reminder.body ?? "", url);
        await sendReminderEmail(user.email, reminder.title, html);
      }

      if (sendPush && user.pushSubscriptions.length > 0) {
        const payload = { title: reminder.title, body: reminder.body ?? "", url };
        for (const sub of user.pushSubscriptions) {
          const ok = await sendPushNotification(
            { endpoint: sub.endpoint, p256dhKey: sub.p256dhKey, authKey: sub.authKey },
            payload
          );
          if (!ok) {
            await db.pushSubscription.delete({ where: { id: sub.id } });
          }
        }
      }

      await db.reminder.update({ where: { id: reminder.id }, data: { sentAt: now } });
      dispatched++;
    }
  }

  return Response.json({ ok: true, dispatched });
}
