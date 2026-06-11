"use server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendReminderEmail } from "@/lib/api/email";
import { escapeHtml } from "@/lib/escape-html";

const MAX_FEEDBACK_CHARS = 1000;

// Where submissions land. Mirrors the owner gate used by the admin routes.
const OWNER_EMAIL = "kyle@celticwinter.com";

/**
 * Store a feedback submission and mirror it to the owner's inbox. The row is
 * the source of truth — a failed email never loses the feedback.
 */
export async function submitFeedback(message: string, path?: string) {
  const user = await requireUser();
  const trimmed = message.trim();
  if (!trimmed) throw new Error("Write a little something first.");
  if (trimmed.length > MAX_FEEDBACK_CHARS) {
    throw new Error(`Keep it under ${MAX_FEEDBACK_CHARS} characters.`);
  }
  const cleanPath = path && path.startsWith("/") ? path.slice(0, 200) : null;

  await db.feedback.create({
    data: { userId: user.id, message: trimmed, path: cleanPath },
  });

  // Best-effort mirror to the owner — non-fatal by design.
  try {
    await sendReminderEmail(
      OWNER_EMAIL,
      `Bare Root feedback from ${user.email}`,
      `<p><strong>${escapeHtml(user.name ?? user.email)}</strong>${
        cleanPath ? ` (on <code>${escapeHtml(cleanPath)}</code>)` : ""
      }:</p><p style="white-space:pre-wrap">${escapeHtml(trimmed)}</p>`
    );
  } catch (err) {
    console.error("feedback email failed (non-fatal):", err);
  }
}
