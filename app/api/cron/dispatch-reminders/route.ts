import { db } from "@/lib/db";
import { sendPushNotification } from "@/lib/api/push";
import { sendReminderEmail, buildReminderEmailHtml, isEmailConfigured } from "@/lib/api/email";
import { buildUnsubscribeUrl } from "@/lib/unsubscribe";

// Allow the full Fluid-compute window — email/push sends are network-bound.
export const maxDuration = 300;

// Give up on a reminder after this many failed send attempts so a
// permanently-failing one (e.g. a dead email address) doesn't retry forever.
const MAX_SEND_ATTEMPTS = 5;

// Per-run batch cap. Reminders cluster seasonally (everyone's START_SEEDS
// lands the same weeks); an unbounded run at ~0.3-1s per send blows the
// function timeout. Oldest-first batches + the hourly cadence drain any
// backlog within a few runs.
const BATCH_SIZE = 200;

// Users dispatched concurrently. Each user's reminders stay serial (their
// recurrence rollovers and attempt counters touch the same rows).
const USER_CONCURRENCY = 10;

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
  // Bearer-only: Vercel auto-attaches `Authorization: Bearer $CRON_SECRET`
  // to cron invocations. The `x-vercel-cron` header is a plain request
  // header, not a security boundary, so don't accept it as auth.
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
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

  // Probed once per run, not per reminder — it only reads module state.
  const emailConfigured = isEmailConfigured();
  if (!emailConfigured) {
    console.error(
      "RESEND_API_KEY is not set — email reminders will be HELD (not sent, not dismissed) until it is configured"
    );
  }

  // Reminders left untouched this run because the only channel their owner
  // wants is email and email isn't configured. Surfaced in the response so
  // a silent backlog is visible in cron logs instead of looking like idle.
  let heldForConfig = 0;
  if (!emailConfigured) {
    // Rows the scan below leaves out on purpose (see the where clause).
    // Counted up front so the backlog is visible in cron logs.
    heldForConfig = await db.reminder.count({
      where: {
        scheduledAt: { lte: now },
        sentAt: null,
        dismissed: false,
        user: { pushSubscriptions: { none: {} } },
      },
    });
  }

  const reminders = await db.reminder.findMany({
    where: {
      scheduledAt: { lte: now },
      sentAt: null,
      dismissed: false,
      // While email is unconfigured, a user with no push subscription can
      // only be HELD (see `unavailable` below). Held rows never advance, so
      // left in this oldest-first scan they would fill every BATCH_SIZE slot
      // within days and starve every push-capable user. Leave them out until
      // email works; they stay pending and go out on the first run after.
      ...(!emailConfigured && { user: { pushSubscriptions: { some: {} } } }),
    },
    orderBy: { scheduledAt: "asc" },
    take: BATCH_SIZE,
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

  // All preferences for this batch in one query (was a findUnique per
  // reminder — the N+1 dominated the run at scale).
  const prefRows = await db.notificationPreference.findMany({
    where: { userId: { in: [...byUser.keys()] } },
  });
  const prefByUserType = new Map(prefRows.map((p) => [`${p.userId}:${p.type}`, p]));

  async function dispatchForUser(userReminders: typeof reminders): Promise<number> {
    let sent = 0;
    const user = userReminders[0].user;
    const inSendWindow = isLocalSendWindow(now, user.timezone);
    // Signed one-click unsubscribe link (CRON_SECRET is checked above, so
    // this is always set here). Goes in the footer + List-Unsubscribe headers.
    const unsubscribeUrl = buildUnsubscribeUrl(user.id) ?? undefined;

    for (const reminder of userReminders) {
      // System reminders (start seeds, transplant, harvest, frost, etc.)
      // batch into the morning so we don't ping users at 2am. CUSTOM
      // reminders carry a user-picked datetime and should fire at that
      // time regardless of where it lands in the day — otherwise a
      // "remind me at 3pm" gets pushed to the next morning, which
      // defeats the point of letting users set their own time.
      if (reminder.type !== "CUSTOM" && !inSendWindow) continue;
      const pref = prefByUserType.get(`${user.id}:${reminder.type}`);

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

      // `attempted` means a channel was actually available and we tried it —
      // only those failures count against MAX_SEND_ATTEMPTS. `unavailable`
      // means a channel the user WANTS is switched off on our side (no
      // RESEND_API_KEY); that is our bug, not a delivery failure, so it must
      // never consume the retry budget or dismiss the reminder.
      let attempted = false;
      let delivered = false;
      let unavailable = false;

      if (sendEmail) {
        if (emailConfigured) {
          attempted = true;
          const html = buildReminderEmailHtml(reminder.title, reminder.body ?? "", url, unsubscribeUrl);
          if (await sendReminderEmail(user.email, reminder.title, html, unsubscribeUrl)) delivered = true;
        } else {
          unavailable = true;
        }
      }

      if (sendPush && user.pushSubscriptions.length > 0) {
        attempted = true;
        const payload = { title: reminder.title, body: reminder.body ?? "", url };
        for (const sub of user.pushSubscriptions) {
          const result = await sendPushNotification(
            { endpoint: sub.endpoint, p256dhKey: sub.p256dhKey, authKey: sub.authKey },
            payload
          );
          if (result === "sent") delivered = true;
          // Delete only permanently-dead subscriptions; transient push-service
          // failures retry on the next run via the sendAttempts counter.
          else if (result === "gone") {
            await db.pushSubscription.delete({ where: { id: sub.id } });
          }
        }
      }

      // Nothing was even tried and it's our fault: hold the reminder exactly
      // as-is (pending, attempt counter untouched) so it goes out for real
      // once the key lands. Only reached when the user's sole enabled
      // channel is email — a user with push still delivers above.
      if (!attempted && unavailable) {
        heldForConfig++;
        continue;
      }

      // Only mark sent when something was actually delivered. If a send was
      // attempted but every channel failed (e.g. email provider down), leave
      // sentAt null so the next hourly run retries instead of silently
      // dropping the reminder. If nothing was attempted (no enabled channel /
      // no push subs), fall through and mark it sent so it doesn't retry
      // forever.
      if (attempted && !delivered) {
        // Bump the attempt counter and retry next run, but give up (dismiss)
        // after MAX_SEND_ATTEMPTS so a permanently-failing reminder doesn't
        // retry forever.
        const attempts = reminder.sendAttempts + 1;
        await db.reminder.update({
          where: { id: reminder.id },
          data:
            attempts >= MAX_SEND_ATTEMPTS
              ? { sendAttempts: attempts, dismissed: true }
              : { sendAttempts: attempts },
        });
        continue;
      }

      await db.reminder.update({ where: { id: reminder.id }, data: { sentAt: now } });
      sent++;

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
    return sent;
  }

  // Dispatch users in concurrent chunks; one user failing doesn't stop
  // the rest (their reminders simply retry next run via sendAttempts).
  let dispatched = 0;
  const userGroups = [...byUser.values()];
  for (let i = 0; i < userGroups.length; i += USER_CONCURRENCY) {
    const results = await Promise.allSettled(
      userGroups.slice(i, i + USER_CONCURRENCY).map((group) => dispatchForUser(group))
    );
    for (const r of results) {
      if (r.status === "fulfilled") dispatched += r.value;
      else console.error("Reminder dispatch failed for a user:", r.reason);
    }
  }

  return Response.json({
    ok: true,
    dispatched,
    heldForConfig,
    batchFull: reminders.length === BATCH_SIZE,
  });
}
