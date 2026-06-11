"use client";

import { useState, useTransition } from "react";
import { dismissReminder, completeReminder, snoozeReminder } from "@/app/actions/reminders";
import { logHarvestResilient } from "@/lib/offline/log-harvest";
import { CreateReminderDialog } from "@/components/reminders/CreateReminderDialog";
import { Bell, X, Leaf, Snowflake, Sprout, ArrowUpFromLine, Scissors, Check, Clock, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

const HARVEST_UNITS = ["lbs", "oz", "kg", "g", "count", "bunches", "bags"];

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; accent: string; bg: string }> = {
  START_SEEDS:       { icon: <Sprout className="w-4 h-4" />,          accent: "#D4A843", bg: "#FFF8E7" },
  TRANSPLANT:        { icon: <ArrowUpFromLine className="w-4 h-4" />, accent: "#7DA84E", bg: "#EEF6E7" },
  HARVEST:           { icon: <Scissors className="w-4 h-4" />,        accent: "#D4820A", bg: "#FFF3E8" },
  FROST_ALERT:       { icon: <Snowflake className="w-4 h-4" />,       accent: "#4B9EBF", bg: "#EFF6FB" },
  WATER:             { icon: <Leaf className="w-4 h-4" />,            accent: "#4B9EBF", bg: "#EFF6FB" },
  FERTILIZE:         { icon: <Leaf className="w-4 h-4" />,            accent: "#7DA84E", bg: "#EEF6E7" },
  CUSTOM:            { icon: <Bell className="w-4 h-4" />,            accent: "#ADADAA", bg: "#F4F4EC" },
  SUCCESSION_PLANTING: { icon: <Sprout className="w-4 h-4" />,        accent: "#7DA84E", bg: "#EEF6E7" },
  CROP_ROTATION:     { icon: <Sprout className="w-4 h-4" />,          accent: "#D4820A", bg: "#FFF3E8" },
};

type ReminderItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  scheduledAt: string;
  sentAt: string | null;
  recurrence: string | null;
  plantingId: string | null;
  plantName: string | null;
  bedName: string | null;
  gardenId: string | null;
  bedId: string | null;
  gardenName: string | null;
};

// Reminder types where "done" can act on the planting itself.
const ACTIONABLE_TYPES = new Set(["START_SEEDS", "TRANSPLANT", "HARVEST"]);

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === -1) return "Yesterday";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
  return `In ${diffDays} days`;
}

export function RemindersClient({
  reminders,
  gardens,
}: {
  reminders: ReminderItem[];
  gardens: { id: string; name: string }[];
}) {
  const [, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  // Reminder whose inline harvest quick-log is open.
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("lbs");

  function handleDismiss(id: string) {
    startTransition(async () => {
      try {
        await dismissReminder(id);
      } catch {
        toast.error("Couldn't dismiss the reminder. Please try again.");
      }
    });
  }

  function handleDone(r: ReminderItem) {
    setBusyId(r.id);
    startTransition(async () => {
      try {
        await completeReminder(r.id);
        toast.success(
          r.type === "START_SEEDS" ? "Marked as seeds started"
          : r.type === "TRANSPLANT" ? "Marked as transplanted"
          : r.type === "HARVEST" ? "Marked as harvesting"
          : "Done"
        );
      } catch {
        toast.error("Couldn't mark it done. Please try again.");
      } finally {
        setBusyId(null);
      }
    });
  }

  function handleSnooze(r: ReminderItem) {
    setBusyId(r.id);
    startTransition(async () => {
      try {
        await snoozeReminder(r.id, 7);
        toast.success("Snoozed a week");
      } catch {
        toast.error("Couldn't snooze. Please try again.");
      } finally {
        setBusyId(null);
      }
    });
  }

  function handleLogHarvest(r: ReminderItem) {
    const quantity = Number(qty);
    if (!r.plantingId || !quantity || quantity <= 0) return;
    setBusyId(r.id);
    startTransition(async () => {
      try {
        const landed = await logHarvestResilient({
          plantingId: r.plantingId!,
          plantName: r.plantName ?? "this plant",
          quantity,
          unit,
        });
        await completeReminder(r.id);
        toast.success(
          landed === "queued"
            ? "Saved on this device — will sync when you're back online"
            : `Logged ${quantity} ${unit}`
        );
        setLoggingId(null);
        setQty("");
      } catch {
        toast.error("Couldn't log the harvest. Please try again.");
      } finally {
        setBusyId(null);
      }
    });
  }

  const pending = reminders.filter((r) => !r.sentAt);
  const sent = reminders.filter((r) => r.sentAt);

  function ReminderCard({ r }: { r: ReminderItem }) {
    const cfg = TYPE_CONFIG[r.type] ?? TYPE_CONFIG.CUSTOM;
    const href =
      r.gardenId && r.bedId
        ? `/garden/${r.gardenId}/beds/${r.bedId}`
        : r.gardenId
        ? `/garden/${r.gardenId}`
        : null;

    return (
      <div
        className="flex items-start gap-0 bg-white rounded-xl border border-[#E4E4DC] overflow-hidden hover:shadow-sm transition-shadow"
      >
        {/* Color left strip */}
        <div
          className="w-1 self-stretch shrink-0 rounded-l-xl"
          style={{ background: cfg.accent }}
        />

        {/* Icon */}
        <div
          className="shrink-0 m-3.5 w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: cfg.bg, color: cfg.accent }}
        >
          {cfg.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 py-3.5 pr-3">
          {href ? (
            <Link
              href={href}
              className="text-sm font-semibold text-[#111109] hover:text-[#1C3D0A] transition-colors leading-tight block"
            >
              {r.title}
            </Link>
          ) : (
            <p className="text-sm font-semibold text-[#111109] leading-tight">{r.title}</p>
          )}
          {r.body && (
            <p className="text-xs text-[#6B6B5A] mt-0.5 line-clamp-2">{r.body}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            <span
              className="text-xs font-medium px-1.5 py-0.5 rounded-md"
              style={{ background: cfg.bg, color: cfg.accent }}
            >
              {formatRelativeDate(r.scheduledAt)}
            </span>
            {r.recurrence && (
              <span className="text-xs font-medium px-1.5 py-0.5 rounded-md bg-[#F4F4EC] text-[#6B6B5A]">
                Repeats {r.recurrence}
              </span>
            )}
            {r.plantName && (
              <span className="text-xs text-[#6B6B5A] truncate">{r.plantName}</span>
            )}
          </div>

          {/* Action row — the reminder is a task, so give it task verbs. */}
          <div className="flex items-center flex-wrap gap-2 mt-2.5">
            {r.plantingId && r.type === "HARVEST" && loggingId !== r.id && (
              <button
                onClick={() => { setLoggingId(r.id); setQty(""); }}
                disabled={busyId === r.id}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-[#1C3D0A] text-white hover:bg-[#3A6B20] transition-colors disabled:opacity-50"
              >
                <Scissors className="w-3 h-3" /> Log harvest
              </button>
            )}
            {r.plantingId && ACTIONABLE_TYPES.has(r.type) && r.type !== "HARVEST" && (
              <button
                onClick={() => handleDone(r)}
                disabled={busyId === r.id}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-[#1C3D0A] text-white hover:bg-[#3A6B20] transition-colors disabled:opacity-50"
              >
                {busyId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Mark done
              </button>
            )}
            <button
              onClick={() => handleSnooze(r)}
              disabled={busyId === r.id}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-[#E4E4DC] text-[#6B6B5A] hover:border-[#7DA84E] hover:text-[#1C3D0A] transition-colors disabled:opacity-50"
            >
              <Clock className="w-3 h-3" /> +1 week
            </button>
          </div>

          {/* Inline harvest quick-log */}
          {loggingId === r.id && (
            <div className="flex items-center flex-wrap gap-2 mt-2.5 p-2.5 rounded-lg bg-[#FFF3E8] border border-[#F0DCC8]">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="Amount"
                autoFocus
                className="w-20 border border-[#E4E4DC] rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-[#D4820A]"
              />
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="border border-[#E4E4DC] rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none"
              >
                {HARVEST_UNITS.map((u) => <option key={u}>{u}</option>)}
              </select>
              <button
                onClick={() => handleLogHarvest(r)}
                disabled={busyId === r.id || !Number(qty)}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-[#D4820A] text-white hover:bg-[#B86F08] transition-colors disabled:opacity-40"
              >
                {busyId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Log &amp; done
              </button>
              <button
                onClick={() => handleDone(r)}
                disabled={busyId === r.id}
                className="text-xs text-[#6B6B5A] underline hover:text-[#111109]"
              >
                Done without logging
              </button>
            </div>
          )}
        </div>

        {/* Dismiss */}
        <button
          onClick={() => handleDismiss(r.id)}
          className="shrink-0 p-3.5 text-[#ADADAA] hover:text-[#111109] transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const PageHeader = () => (
    <div className="px-[22px] md:px-8 pt-6 pb-5" style={{ borderBottom: "1px solid #E4E4DC" }}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#7DA84E", marginBottom: "6px" }}>
            <span style={{ display: "block", width: "16px", height: "1.5px", background: "#7DA84E", borderRadius: "1px", flexShrink: 0 }} />
            Activity
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px, 4vw, 30px)", fontWeight: 800, color: "#111109", letterSpacing: "-0.03em", lineHeight: 1, fontVariationSettings: "'opsz' 32" }}>
            Reminders
          </h1>
        </div>
        <CreateReminderDialog gardens={gardens} />
      </div>
    </div>
  );

  if (reminders.length === 0) {
    return (
      <div>
        <PageHeader />
        <div className="px-[22px] md:px-8 py-5">
          <div className="text-center py-16 text-[#ADADAA]">
            <Bell className="w-10 h-10 mx-auto mb-3 text-[#E4E4DC]" />
            <p className="text-sm">No reminders right now.</p>
            <p className="text-xs mt-1">You&apos;re all caught up.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader />
      <div className="px-[22px] md:px-8 py-5">

      {pending.length > 0 && (
        <div className="mb-6">
          <p className="text-xs text-[#ADADAA] font-semibold uppercase tracking-wider mb-3">
            Upcoming
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 lg:items-start stagger-rise">
            {pending.map((r) => (
              <ReminderCard key={r.id} r={r} />
            ))}
          </div>
        </div>
      )}

      {sent.length > 0 && (
        <div>
          <p className="text-xs text-[#ADADAA] font-semibold uppercase tracking-wider mb-3">
            Sent
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 lg:items-start opacity-75">
            {sent.map((r) => (
              <ReminderCard key={r.id} r={r} />
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
