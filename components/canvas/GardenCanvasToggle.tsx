"use client";

import { useEffect, useState } from "react";
import { GardenOverview } from "./GardenOverview";
import { GardenOverview2D, type Bed2D, type Garden2D } from "./GardenOverview2D";

const STORAGE_KEY = "bareroot:gardenViewMode";

export function GardenCanvasToggle({ garden, beds }: { garden: Garden2D; beds: Bed2D[] }) {
  // Default to 2D — it's faster to scan, mobile-friendly, and shows planting
  // detail that 3D hides. 3D is the showroom view, opt-in via the toggle.
  const [mode, setMode] = useState<"2D" | "3D">("2D");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "3D" || saved === "2D") setMode(saved);
    } catch {
      /* storage blocked — fall back to default */
    }
  }, []);

  function selectMode(m: "2D" | "3D") {
    setMode(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="relative">
      {mode === "2D" ? (
        <GardenOverview2D garden={garden} beds={beds} />
      ) : (
        <GardenOverview garden={garden} beds={beds} />
      )}

      {/* Segmented toggle — top-left, sits over the canvas */}
      <div
        className="absolute z-[3] flex items-center gap-0"
        style={{
          top: "10px",
          left: "10px",
          padding: "3px",
          borderRadius: "100px",
          background: "rgba(0,0,0,0.5)",
          border: "1px solid rgba(168,216,112,0.22)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
        }}
      >
        {(["2D", "3D"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => selectMode(m)}
            aria-pressed={mode === m}
            aria-label={`Switch to ${m} view`}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              fontWeight: 600,
              padding: "5px 11px",
              borderRadius: "100px",
              background: mode === m ? "rgba(168,216,112,0.22)" : "transparent",
              color: mode === m ? "#A8D870" : "rgba(168,216,112,0.55)",
              border: "none",
              cursor: "pointer",
              transition: "background 0.15s, color 0.15s",
            }}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}
