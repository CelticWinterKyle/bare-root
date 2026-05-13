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
        className="relative p-2 rounded-lg transition-colors"
        style={{ color: "rgba(245,237,218,0.7)" }}
        aria-label={`Notifications (${count} unread)`}
      >
        <Bell className="w-5 h-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#C4790A] text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-80 rounded-xl shadow-2xl overflow-hidden paper-grain" style={{ background: "#F5EDDA", border: "1px solid #D4C8A8" }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid #D4C8A8" }}>
              <p className="font-display text-sm font-semibold" style={{ color: "#231A0D" }}>Reminders</p>
              <Link
                href="/reminders"
                className="font-mono text-[11px] uppercase tracking-wider transition-colors"
                style={{ color: "#6B8F47", letterSpacing: "0.1em" }}
                onClick={() => setOpen(false)}
              >
                View all
              </Link>
            </div>

            {localReminders.length === 0 ? (
              <div key="empty" className="px-4 py-8 text-center animate-in fade-in duration-300">
                <Leaf className="w-7 h-7 mx-auto mb-2" style={{ color: "#D4C8A8" }} />
                <p className="font-display text-sm font-semibold" style={{ color: "#4A3820" }}>All caught up</p>
                <p className="text-xs mt-0.5" style={{ color: "#8B7A60" }}>No pending reminders</p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto" style={{ borderTop: "none" }}>
                {localReminders.slice(0, 8).map((r) => {
                  const icon = TYPE_ICONS[r.type] ?? <Bell className="w-3.5 h-3.5" style={{ color: "#8B7A60" }} />;
                  const href =
                    r.gardenId && r.bedId
                      ? `/garden/${r.gardenId}/beds/${r.bedId}`
                      : r.gardenId
                      ? `/garden/${r.gardenId}`
                      : "/reminders";

                  return (
                    <div key={r.id} className="flex items-start gap-2.5 px-4 py-3 transition-colors" style={{ borderBottom: "1px solid rgba(212,200,168,0.5)" }}>
                      <div className="mt-0.5 shrink-0">{icon}</div>
                      <Link
                        href={href}
                        className="flex-1 min-w-0"
                        onClick={() => setOpen(false)}
                      >
                        <p className="text-sm font-semibold leading-tight" style={{ color: "#231A0D" }}>{r.title}</p>
                        {r.body && (
                          <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "#8B7A60" }}>{r.body}</p>
                        )}
                      </Link>
                      <button
                        onClick={(e) => handleDismiss(r.id, e)}
                        className="shrink-0 transition-colors mt-0.5"
                        style={{ color: "#8B7A60" }}
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
