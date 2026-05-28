"use client";
import { useEffect } from "react";
import { updateUserTimezone } from "@/app/actions/user";

/**
 * Captures the browser's IANA timezone on mount and persists it when it
 * differs from what's stored, so reminders fire in the user's local day.
 * Renders nothing.
 */
export function TimezoneSync({ current }: { current: string }) {
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz !== current) {
      updateUserTimezone(tz).catch(() => {});
    }
  }, [current]);
  return null;
}
