"use client";

import { useState, useTransition } from "react";
import { Bell, X, Leaf, Snowflake, Sprout, ArrowUpFromLine, Scissors } from "lucide-react";
import Link from "next/link";
import { dismissReminder } from "@/app/actions/reminders";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  START_SEEDS: <Sprout className="w-3.5 h-3.5 text-[#D4A843]" />,
  TRANSPLANT: <ArrowUpFromLine className="w-3.5 h-3.5 text-[#6B8F47]" />,
  HARVEST: <Scissors className="w-3.5 h-3.5 text-[#C4790A]" />,
  FROST_ALERT: <Snowflake className="w-3.5 h-3.5 text-blue-400" />,
  WATER: <Leaf className="w-3.5 h-3.5 text-blue-400" />,
  FERTILIZE: <Leaf className="w-3.5 h-3.5 text-[#6B8F47]" />,
};

type BellReminder = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  gardenId: string | null;
  bedId: string | null;
};

export function NotificationBell({
  reminders,
  unreadCount,
}: {
  reminders: BellReminder[];
  unreadCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [localReminders, setLocalReminders] = useState(reminders);
  const [, startTransition] = useTransition();

  function handleDismiss(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setLocalReminders((prev) => prev.filter((r) => r.id !== id));
    startTransition(() => dismissReminder(id));
  }

  const count = localReminders.length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg hover:bg-[#F5F0E8] transition-colors"
        aria-label={`Notifications (${count} unread)`}
      >
        <Bell className="w-5 h-5 text-[#6B6560]" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#B85C3A] text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-80 bg-white border border-[#E8E2D9] rounded-xl shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8E2D9]">
              <p className="text-sm font-semibold text-[#1C1C1A]">Reminders</p>
              <Link
                href="/reminders"
                className="text-xs text-[#6B8F47] hover:text-[#2D5016]"
                onClick={() => setOpen(false)}
              >
                View all
              </Link>
            </div>

            {localReminders.length === 0 ? (
              <div key="empty" className="px-4 py-8 text-center animate-in fade-in duration-300">
                <Leaf className="w-7 h-7 text-[#D8D3CB] mx-auto mb-2" />
                <p className="text-sm font-medium text-[#6B6560]">You&apos;re all caught up</p>
                <p className="text-xs text-[#9E9890] mt-0.5">No pending reminders</p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-[#F5F0E8]">
                {localReminders.slice(0, 8).map((r) => {
                  const icon = TYPE_ICONS[r.type] ?? <Bell className="w-3.5 h-3.5 text-[#9E9890]" />;
                  const href =
                    r.gardenId && r.bedId
                      ? `/garden/${r.gardenId}/beds/${r.bedId}`
                      : r.gardenId
                      ? `/garden/${r.gardenId}`
                      : "/reminders";

                  return (
                    <div key={r.id} className="flex items-start gap-2.5 px-4 py-3 hover:bg-[#FAF7F2]">
                      <div className="mt-0.5 shrink-0">{icon}</div>
                      <Link
                        href={href}
                        className="flex-1 min-w-0"
                        onClick={() => setOpen(false)}
                      >
                        <p className="text-xs font-medium text-[#1C1C1A] truncate">{r.title}</p>
                        {r.body && (
                          <p className="text-[11px] text-[#9E9890] line-clamp-1 mt-0.5">{r.body}</p>
                        )}
                      </Link>
                      <button
                        onClick={(e) => handleDismiss(r.id, e)}
                        className="shrink-0 text-[#9E9890] hover:text-[#1C1C1A] transition-colors mt-0.5"
                        aria-label="Dismiss"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
