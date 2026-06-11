"use server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Persist the user's IANA timezone (captured from the browser). Reminder
 * dispatch batches system reminders into the user's local daytime, so a
 * correct timezone is what makes reminders fire at a sane hour.
 */
export async function updateUserTimezone(timezone: string): Promise<void> {
  const user = await requireUser();
  // Validate it's a real IANA zone before persisting.
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    return;
  }
  if (timezone === user.timezone) return;
  await db.user.update({ where: { id: user.id }, data: { timezone } });
}

/** Display units (imperial/metric). Storage stays imperial; only rendering changes. */
export async function updateUserUnits(units: "IMPERIAL" | "METRIC"): Promise<void> {
  const user = await requireUser();
  if (units !== "IMPERIAL" && units !== "METRIC") return;
  await db.user.update({ where: { id: user.id }, data: { units } });
}
