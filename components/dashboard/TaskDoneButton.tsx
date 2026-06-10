"use client";
import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { completeReminder } from "@/app/actions/reminders";

/**
 * Compact "done" check for dashboard task cards. Rendered INSIDE the card's
 * <Link>, so it must stop the navigation when tapped.
 */
export function TaskDoneButton({ reminderId, type }: { reminderId: string; type: string }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    start(async () => {
      try {
        await completeReminder(reminderId);
        setDone(true);
        toast.success(
          type === "START_SEEDS" ? "Marked as seeds started"
          : type === "TRANSPLANT" ? "Marked as transplanted"
          : type === "HARVEST" ? "Marked as harvesting"
          : "Done"
        );
      } catch {
        toast.error("Couldn't mark it done. Please try again.");
      }
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending || done}
      aria-label="Mark done"
      title="Mark done"
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        width: 28,
        height: 28,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "50%",
        border: "1px solid rgba(125,168,78,0.4)",
        background: done ? "#7DA84E" : "rgba(125,168,78,0.08)",
        color: done ? "#fff" : "#7DA84E",
        cursor: "pointer",
        transition: "background 0.15s, color 0.15s",
        zIndex: 2,
      }}
    >
      {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
    </button>
  );
}
