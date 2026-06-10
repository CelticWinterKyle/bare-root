"use client";
import { Printer } from "lucide-react";

/** Triggers the browser print dialog. Hidden in print media by its parent. */
export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        fontFamily: "var(--font-body)",
        fontSize: "12px",
        fontWeight: 600,
        padding: "7px 16px",
        borderRadius: "8px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "6px",
        border: "1.5px solid #1C3D0A",
        background: "#1C3D0A",
        color: "white",
        lineHeight: 1.2,
        flexShrink: 0,
      }}
    >
      <Printer style={{ width: 14, height: 14 }} />
      Print
    </button>
  );
}
