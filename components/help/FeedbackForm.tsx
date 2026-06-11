"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { submitFeedback } from "@/app/actions/feedback";

/**
 * Tiny feedback form — one textarea, one button. Lives at the bottom of the
 * HelpSheet so friction can be reported the moment it's felt. The current
 * path rides along so reports land with context.
 */
export function FeedbackForm() {
  const [message, setMessage] = useState("");
  const [isSending, startSend] = useTransition();
  const pathname = usePathname();

  function handleSubmit() {
    const trimmed = message.trim();
    if (!trimmed) return;
    startSend(async () => {
      try {
        await submitFeedback(trimmed, pathname ?? undefined);
        setMessage("");
        toast.success("Thanks — sent to the gardener-in-chief.");
      } catch {
        toast.error("Couldn't send that. Please try again.");
      }
    });
  }

  return (
    <div style={{ borderTop: "1px solid #E4E4DC", paddingTop: 16 }}>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "#1C3D0A",
          fontWeight: 600,
          marginBottom: 4,
        }}
      >
        Something off?
      </div>
      <p style={{ fontSize: 13, color: "#3A3A30", lineHeight: 1.55, marginBottom: 8 }}>
        Confusing, broken, or missing — say it here and it lands straight in the
        builder&apos;s inbox.
      </p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={1000}
        rows={3}
        placeholder="What were you trying to do?"
        className="w-full rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7DA84E]"
        style={{
          background: "#F4F4EC",
          border: "1px solid #E4E4DC",
          color: "#111109",
          resize: "vertical",
        }}
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSending || message.trim().length === 0}
        className="mt-2 w-full rounded-lg py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
        style={{ background: "#1C3D0A" }}
      >
        {isSending ? "Sending…" : "Send feedback"}
      </button>
    </div>
  );
}
