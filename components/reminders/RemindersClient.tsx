"use client";

import { useTransition } from "react";
import { dismissReminder } from "@/app/actions/reminders";
import { Bell, X, Leaf, Snowflake, Sprout, ArrowUpFromLine, Scissors } from "lucide-react";
import Link from "next/link";

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
  plantName: string | null;
  bedName: string | null;
  gardenId: string | null;
  bedId: string | null;
  gardenName: string | null;
};

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

export function RemindersClient({ reminders }: { reminders: ReminderItem[] }) {
  const [, startTransition] = useTransition();

  function handleDismiss(id: string) {
    startTransition(() => dismissReminder(id));
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
            {r.plantName && (
              <span className="text-xs text-[#ADADAA] truncate">{r.plantName}</span>
            )}
          </div>
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
      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#7DA84E", marginBottom: "6px" }}>
        <span style={{ display: "block", width: "16px", height: "1.5px", background: "#7DA84E", borderRadius: "1px", flexShrink: 0 }} />
        Activity
      </div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px, 4vw, 30px)", fontWeight: 800, color: "#111109", letterSpacing: "-0.03em", lineHeight: 1, fontVariationSettings: "'opsz' 32" }}>
        Reminders
      </h1>
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
          <div className="space-y-2">
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
          <div className="space-y-2 opacity-75">
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
