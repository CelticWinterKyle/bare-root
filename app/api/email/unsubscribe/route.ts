import { db } from "@/lib/db";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";
import { ReminderType } from "@/lib/generated/prisma/enums";

// Signed-token email unsubscribe — publicly reachable (no login) so the
// link works straight from an email client. GET serves a human-facing
// confirmation page; POST is the RFC 8058 one-click endpoint mail clients
// hit automatically. Both are idempotent and harmless to repeat.

async function unsubscribe(token: string | null): Promise<boolean> {
  if (!token) return false;
  const userId = verifyUnsubscribeToken(token);
  if (!userId) return false;

  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return false;

  // Flip email off on every preference row AND create the missing ones —
  // the dispatcher treats "no row" as email-on, so rows the user never
  // touched would otherwise keep emailing after an unsubscribe.
  await db.$transaction(
    Object.values(ReminderType).map((type) =>
      db.notificationPreference.upsert({
        where: { userId_type: { userId, type } },
        create: { userId, type, channelEmail: false },
        update: { channelEmail: false },
      })
    )
  );
  return true;
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  const ok = await unsubscribe(token);
  const html = ok
    ? page(
        "You're unsubscribed from email reminders",
        "You won't get reminder emails from Bare Root anymore. You can re-enable them anytime in Settings → Notifications."
      )
    : page(
        "This unsubscribe link isn't valid",
        "The link may have been copied incompletely. You can manage email reminders anytime in Settings → Notifications."
      );
  return new Response(html, {
    status: ok ? 200 : 400,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// RFC 8058 one-click: mail clients POST with List-Unsubscribe=One-Click;
// same operation as GET, empty 200 response.
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  const ok = await unsubscribe(token);
  if (!ok) return new Response("Invalid token", { status: 400 });
  return new Response(null, { status: 200 });
}

function page(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — Bare Root</title>
</head>
<body style="margin:0;background:#FDFDF8;font-family:Georgia,'Times New Roman',serif;color:#1C3D0A;">
  <div style="max-width:460px;margin:96px auto 0;padding:0 24px;text-align:center;">
    <p style="font-size:12px;letter-spacing:0.22em;text-transform:uppercase;margin:0 0 20px;color:#1C3D0A;">Bare Root</p>
    <h1 style="font-size:28px;font-weight:600;line-height:1.25;margin:0 0 14px;">${title}</h1>
    <p style="font-size:16px;line-height:1.6;color:#4A5A38;margin:0;">${body}</p>
  </div>
</body>
</html>`;
}
