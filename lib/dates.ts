/**
 * Date helpers shared by server pages and client components.
 *
 * Two conventions live in this codebase, on purpose:
 *
 *  - DATE-ONLY values (system reminders, harvest dates) are stored as UTC
 *    midnight of the calendar day. Render them with timeZone "UTC" and
 *    compare them by their UTC calendar day.
 *  - INSTANTS (custom reminders, notes, photos, "now") are real moments.
 *    Render them in the user's timezone and derive "today" from it.
 *
 * The server runs in UTC, where 7pm CDT is already tomorrow, so nothing
 * here relies on the process timezone. No server-only imports: both sides
 * use this module.
 */

/** "YYYY-MM-DD" of the calendar day `d` falls on in `tz`. */
export function ymdInTz(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** "YYYY-MM-DD" of a stored date-only value (UTC midnight). */
export function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" in the browser's local zone — for date inputs and offline logs. */
export function localYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** UTC midnight for a "YYYY-MM-DD" — how date-only values are stored. */
export function utcMidnight(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Whole calendar days from `a` to `b` (both "YYYY-MM-DD"); negative when b is earlier. */
export function daysBetweenYmd(a: string, b: string): number {
  return Math.round((utcMidnight(b).getTime() - utcMidnight(a).getTime()) / 86_400_000);
}

/** UTC midnight of the calendar day `d` falls on — for STORED date-only values. */
export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

/** The instant the user's calendar day began — for "today/tomorrow" boundaries. */
export function startOfDayInTz(d: Date, tz: string): Date {
  const utcMidnightOfDay = new Date(`${ymdInTz(d, tz)}T00:00:00Z`);
  // Shift by the tz's offset at that moment (toLocaleString round-trip).
  const tzClock = new Date(utcMidnightOfDay.toLocaleString("en-US", { timeZone: tz }));
  return new Date(utcMidnightOfDay.getTime() - (tzClock.getTime() - utcMidnightOfDay.getTime()));
}

// Round, not floor: the operands mix tz-local and UTC midnights, which can
// differ by the tz offset without changing the calendar-day distance.
export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/** Stored MM-DD frost values ("04-15") read as raw codes; render as "Apr 15". */
export function formatFrostMmdd(mmdd: string): string {
  const [m, d] = mmdd.split("-").map(Number);
  if (!m || !d) return mmdd;
  return new Date(2000, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * The calendar day a reminder is due, as "YYYY-MM-DD". System reminders are
 * stored as UTC midnight of the intended day; CUSTOM reminders carry a
 * user-picked instant, so their day depends on the user's timezone.
 */
export function reminderDayYmd(scheduledAt: Date, type: string, tz: string): string {
  return type === "CUSTOM" ? ymdInTz(scheduledAt, tz) : ymdUtc(scheduledAt);
}

/** Timezone to format a reminder's date in — see reminderDayYmd. */
export function reminderTz(type: string, tz: string): string {
  return type === "CUSTOM" ? tz : "UTC";
}
