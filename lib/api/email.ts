import { Resend } from "resend";
import { escapeHtml } from "@/lib/escape-html";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Resend requires the domain to be verified before sending. Set
// EMAIL_FROM in env to override (e.g. once bareroot.garden is verified).
const FROM = process.env.EMAIL_FROM ?? "Bare Root <hello@bareroot.garden>";

// Bare address out of FROM for the mailto: form of List-Unsubscribe.
const FROM_ADDRESS = FROM.match(/<([^>]+)>/)?.[1] ?? (FROM.includes("@") ? FROM : null);

// Pass `unsubscribeUrl` for bulk-ish mail (reminders) to get RFC 8058
// List-Unsubscribe headers; transactional sends (collaborator invites)
// omit it and get no headers.
export async function sendReminderEmail(
  to: string,
  subject: string,
  html: string,
  unsubscribeUrl?: string
): Promise<boolean> {
  if (!resend) return false;
  try {
    const headers = unsubscribeUrl
      ? {
          "List-Unsubscribe": FROM_ADDRESS
            ? `<mailto:${FROM_ADDRESS}?subject=unsubscribe>, <${unsubscribeUrl}>`
            : `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        }
      : undefined;
    await resend.emails.send({ from: FROM, to, subject, html, headers });
    return true;
  } catch (err) {
    console.error("Email send error:", err);
    return false;
  }
}

export function buildReminderEmailHtml(
  title: string,
  body: string,
  url?: string,
  unsubscribeUrl?: string
): string {
  return `<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;background:#FAF7F2;margin:0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #E8E2D9;">
    <p style="font-size:22px;font-weight:600;color:#1C1C1A;margin:0 0 8px">${escapeHtml(title)}</p>
    <p style="color:#6B6560;font-size:15px;margin:0 0 24px">${escapeHtml(body)}</p>
    ${url ? `<a href="${url}" style="display:inline-block;background:#2D5016;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500">View in Bare Root →</a>` : ""}
    <p style="margin-top:32px;font-size:12px;color:#9E9890">You're receiving this because you have reminders enabled in Bare Root. ${unsubscribeUrl ? `<a href="${unsubscribeUrl}" style="color:#6B8F47">Unsubscribe from email reminders</a> · ` : ""}<a href="${process.env.NEXT_PUBLIC_APP_URL ?? ""}/settings/notifications" style="color:#6B8F47">Manage preferences</a></p>
  </div>
</body>
</html>`;
}
