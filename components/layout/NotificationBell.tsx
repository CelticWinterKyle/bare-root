"use client";

import { useState, useEffect, useTransition } from "react";
import { Bell, X, Check, Leaf, Snowflake, Sprout, ArrowUpFromLine, Scissors } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { dismissReminder, completeReminder } from "@/app/actions/reminders";

// Per-device "last opened the bell" timestamp — the badge counts only items
// that arrived since. Opening the bell is "seen"; items stay listed until
// dismissed/done.
const SEEN_KEY = "bareroot:bellSeenAt";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  START_SEEDS: <Sprout className="w-3.5 h-3.5 text-[#D4A843]" />,
  TRANSPLANT: <ArrowUpFromLine className="w-3.5 h-3.5 text-[#7DA84E]" />,
  HARVEST: <Scissors className="w-3.5 h-3.5 text-[#D4820A]" />,
  FROST_ALERT: <Snowflake className="w-3.5 h-3.5 text-blue-400" />,
  WATER: <Leaf className="w-3.5 h-3.5 text-blue-400" />,
  FERTILIZE: <Leaf className="w-3.5 h-3.5 text-[#7DA84E]" />,
};

type BellReminder = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  sentAt: string | null;
  plantingId: string | null;
  gardenId: string | null;
  bedId: string | null;
};

const DONE_TYPES = new Set(["START_SEEDS", "TRANSPLANT", "HARVEST"]);

export function NotificationBell({
  reminders,
}: {
  reminders: BellReminder[];
  unreadCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const [localReminders, setLocalReminders] = useState(reminders);
  const [, startTransition] = useTransition();
  // 0 until mount — localStorage isn't available during SSR, and a wrong
  // badge that corrects itself reads worse than one appearing post-mount.
  const [unseen, setUnseen] = useState(0);

  useEffect(() => {
    const seenAt = Number(localStorage.getItem(SEEN_KEY) ?? 0);
    setUnseen(
      localReminders.filter((r) => r.sentAt && new Date(r.sentAt).getTime() > seenAt).length
    );
  }, [localReminders]);

  function handleOpen() {
    setOpen((o) => {
      if (!o) {
        localStorage.setItem(SEEN_KEY, String(Date.now()));
        setUnseen(0);
      }
      return !o;
    });
  }

  function handleDismiss(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setLocalReminders((prev) => prev.filter((r) => r.id !== id));
    startTransition(() => dismissReminder(id));
  }

  function handleDone(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setLocalReminders((prev) => prev.filter((r) => r.id !== id));
    startTransition(async () => {
      try {
        await completeReminder(id);
      } catch {
        toast.error("Couldn't mark it done. Please try again.");
      }
    });
  }

  const count = unseen;

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="relative p-2 transition-colors"
        style={{ color: "#6B6B5A", background: "none" }}
        aria-label={`Notifications (${count} unread)`}
      >
        <Bell className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-white text-[10px] font-semibold rounded-full flex items-center justify-center" style={{ background: "#D4820A" }}>
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-50 w-80 rounded-xl shadow-2xl overflow-hidden" style={{ background: "#FDFDF8", border: "1px solid #E4E4DC" }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid #E4E4DC" }}>
              <p className="font-display text-sm font-semibold" style={{ color: "#111109" }}>Reminders</p>
              <Link
                href="/reminders"
                className="font-mono text-[11px] uppercase tracking-wider transition-colors"
                style={{ color: "#7DA84E", letterSpacing: "0.1em" }}
                onClick={() => setOpen(false)}
              >
                View all
              </Link>
            </div>

            {localReminders.length === 0 ? (
              <div key="empty" className="px-4 py-8 text-center animate-in fade-in duration-300">
                <Leaf className="w-7 h-7 mx-auto mb-2" style={{ color: "#D4E8BE" }} />
                <p className="font-display text-sm font-semibold" style={{ color: "#3A3A30" }}>All caught up</p>
                <p className="text-xs mt-0.5" style={{ color: "#6B6B5A" }}>No pending reminders</p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {localReminders.slice(0, 8).map((r) => {
                  const icon = TYPE_ICONS[r.type] ?? <Bell className="w-3.5 h-3.5" style={{ color: "#6B6B5A" }} />;
                  const href =
                    r.gardenId && r.bedId
                      ? `/garden/${r.gardenId}/beds/${r.bedId}`
                      : r.gardenId
                      ? `/garden/${r.gardenId}`
                      : "/reminders";

                  return (
                    <div key={r.id} className="flex items-start gap-2.5 px-4 py-3 transition-colors" style={{ borderBottom: "1px solid rgba(228,228,220,0.8)" }}>
                      <div className="mt-0.5 shrink-0">{icon}</div>
                      <Link
                        href={href}
                        className="flex-1 min-w-0"
                        onClick={() => setOpen(false)}
                      >
                        <p className="text-sm font-semibold leading-tight" style={{ color: "#111109" }}>{r.title}</p>
                        {r.body && (
                          <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "#6B6B5A" }}>{r.body}</p>
                        )}
                      </Link>
                      {r.plantingId && DONE_TYPES.has(r.type) && (
                        <button
                          onClick={(e) => handleDone(r.id, e)}
                          className="shrink-0 transition-colors mt-0.5"
                          style={{ color: "#7DA84E" }}
                          aria-label="Mark done"
                          title="Mark done"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={(e) => handleDismiss(r.id, e)}
                        className="shrink-0 transition-colors mt-0.5"
                        style={{ color: "#ADADAA" }}
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
