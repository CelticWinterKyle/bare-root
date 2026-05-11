"use client";

import { useTransition } from "react";
import { dismissReminder } from "@/app/actions/reminders";
import { Bell, X, Leaf, Snowflake, Sprout, ArrowUpFromLine, Scissors } from "lucide-react";
import Link from "next/link";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  START_SEEDS: <Sprout className="w-4 h-4 text-[#D4A843]" />,
  TRANSPLANT: <ArrowUpFromLine className="w-4 h-4 text-[#6B8F47]" />,
  HARVEST: <Scissors className="w-4 h-4 text-[#C4790A]" />,
  FROST_ALERT: <Snowflake className="w-4 h-4 text-blue-400" />,
  WATER: <Leaf className="w-4 h-4 text-blue-400" />,
  FERTILIZE: <Leaf className="w-4 h-4 text-[#6B8F47]" />,
  CUSTOM: <Bell className="w-4 h-4 text-[#9E9890]" />,
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
    const icon = TYPE_ICONS[r.type] ?? <Bell className="w-4 h-4 text-[#9E9890]" />;
    const href =
      r.gardenId && r.bedId
        ? `/garden/${r.gardenId}/beds/${r.bedId}`
        : r.gardenId
        ? `/garden/${r.gardenId}`
        : null;

    return (
      <div className="flex items-start gap-3 p-4 bg-white border border-[#E8E2D9] rounded-xl">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          {href ? (
            <Link href={href} className="text-sm font-medium text-[#1C1C1A] hover:text-[#2D5016]">
              {r.title}
            </Link>
          ) : (
            <p className="text-sm font-medium text-[#1C1C1A]">{r.title}</p>
          )}
          {r.body && <p className="text-xs text-[#6B6560] mt-0.5 line-clamp-2">{r.body}</p>}
          <p className="text-xs text-[#9E9890] mt-1">{formatRelativeDate(r.scheduledAt)}</p>
        </div>
        <button
          onClick={() => handleDismiss(r.id)}
          className="shrink-0 text-[#9E9890] hover:text-[#1C1C1A] transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (reminders.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="font-display text-3xl font-semibold text-[#1C1C1A] mb-8">Reminders</h1>
        <div className="text-center py-16 text-[#9E9890]">
          <Bell className="w-10 h-10 mx-auto mb-3 text-[#E8E2D9]" />
          <p className="text-sm">No reminders right now.</p>
          <p className="text-xs mt-1">You're all caught up.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="font-display text-3xl font-semibold text-[#1C1C1A] mb-8">Reminders</h1>

      {pending.length > 0 && (
        <div className="mb-6">
          <p className="text-xs text-[#9E9890] font-medium uppercase tracking-wide mb-2">Upcoming</p>
          <div className="space-y-2">
            {pending.map((r) => <ReminderCard key={r.id} r={r} />)}
          </div>
        </div>
      )}

      {sent.length > 0 && (
        <div>
          <p className="text-xs text-[#9E9890] font-medium uppercase tracking-wide mb-2">Sent</p>
          <div className="space-y-2">
            {sent.map((r) => <ReminderCard key={r.id} r={r} />)}
          </div>
        </div>
      )}
    </div>
  );
}
