"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";

export type ChecklistStep = {
  label: string;
  done: boolean;
  href: string;
};

const DISMISS_KEY = "bareroot:gettingStartedDismissed";

/**
 * Post-onboarding checklist — a compact Glasshouse card the dashboard shows
 * while the account is young and incomplete. The server decides WHETHER it's
 * eligible (steps incomplete + account < 30 days) and derives each step's
 * checked state from real data; this component only owns the localStorage
 * dismiss. Renders nothing until the dismiss flag has been read so a
 * dismissed card never flashes on load.
 */
export function GettingStartedCard({ steps }: { steps: ChecklistStep[] }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(DISMISS_KEY)) {
        // Intentional: localStorage is client-only, so visibility has to be
        // resolved in an effect (server renders nothing either way).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setVisible(true);
      }
    } catch {
      // Storage blocked — show it; dismiss just won't persist.
      setVisible(true);
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Storage blocked — hide for this page view anyway.
    }
    setVisible(false);
  }

  if (!visible) return null;

  const doneCount = steps.filter((s) => s.done).length;

  return (
    <section style={{ padding: "28px var(--x-pad) 0" }}>
      <div
        style={{
          background: "#FDFDF8",
          border: "1px solid #E4E4DC",
          borderRadius: 14,
          padding: "18px 22px 16px",
          position: "relative",
        }}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss getting started checklist"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            width: 26,
            height: 26,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ADADAA",
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          <X style={{ width: 14, height: 14 }} />
        </button>

        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#3A6B20",
              fontWeight: 500,
            }}
          >
            <span style={{ width: 20, height: 1.5, background: "#3A6B20" }} />
            Getting started
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.14em",
              color: "#ADADAA",
            }}
          >
            {doneCount} / {steps.length}
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "8px 20px",
          }}
        >
          {steps.map((step) => (
            <Link
              key={step.label}
              href={step.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                textDecoration: "none",
                padding: "3px 0",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: step.done ? "#1C3D0A" : "transparent",
                  border: step.done ? "none" : "1.5px solid #D4E8BE",
                }}
              >
                {step.done && <Check style={{ width: 11, height: 11, color: "#FDFDF8" }} strokeWidth={3} />}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 13,
                  fontWeight: step.done ? 400 : 500,
                  color: step.done ? "#ADADAA" : "#3A3A30",
                  textDecoration: step.done ? "line-through" : "none",
                  textDecorationColor: "#D4E8BE",
                }}
              >
                {step.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
