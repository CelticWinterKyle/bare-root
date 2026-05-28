import { db } from "@/lib/db";
import { sendPushNotification } from "@/lib/api/push";
import { sendReminderEmail, buildReminderEmailHtml } from "@/lib/api/email";

function isLocalSendWindow(utcNow: Date, timezone: string): boolean {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    });
    const hour = parseInt(formatter.format(utcNow));
    // Daytime window: 7am–9:59pm local. Batches system reminders into the
    // day instead of pinging at 2am, but unlike a narrow 7–9 window a
    // missed morning cron run still delivers later the same day rather
    // than skipping the reminder forever.
    return hour >= 7 && hour < 22;
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
    const inSendWindow = isLocalSendWindow(now, user.timezone);

    for (const reminder of userReminders) {
      // System reminders (start seeds, transplant, harvest, frost, etc.)
      // batch into the morning so we don't ping users at 2am. CUSTOM
      // reminders carry a user-picked datetime and should fire at that
      // time regardless of where it lands in the day — otherwise a
      // "remind me at 3pm" gets pushed to the next morning, which
      // defeats the point of letting users set their own time.
      if (reminder.type !== "CUSTOM" && !inSendWindow) continue;
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

      // Recurring reminders: schedule the SINGLE next occurrence as a fresh
      // row (the just-sent one stays in history). recurrenceCron holds a
      // simple interval token, not a real cron — weekly = +7d, monthly = +1mo.
      if (reminder.recurring && (reminder.recurrenceCron === "weekly" || reminder.recurrenceCron === "monthly")) {
        const next = new Date(reminder.scheduledAt);
        if (reminder.recurrenceCron === "weekly") next.setDate(next.getDate() + 7);
        else next.setMonth(next.getMonth() + 1);
        // If the cron was delayed and the next slot is already past, roll it
        // forward to the future so it doesn't immediately re-fire in a loop.
        while (next.getTime() <= now.getTime()) {
          if (reminder.recurrenceCron === "weekly") next.setDate(next.getDate() + 7);
          else next.setMonth(next.getMonth() + 1);
        }
        await db.reminder.create({
          data: {
            userId: reminder.userId,
            gardenId: reminder.gardenId,
            plantingId: reminder.plantingId,
            type: reminder.type,
            title: reminder.title,
            body: reminder.body,
            scheduledAt: next,
            recurring: true,
            recurrenceCron: reminder.recurrenceCron,
          },
        });
      }
    }
  }

  return Response.json({ ok: true, dispatched });
}
