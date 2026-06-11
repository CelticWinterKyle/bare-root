"use client";
import { useState, useTransition } from "react";
import {
  getStartOptions,
  startMethodLabel,
  type StartMethod,
  type StartOption,
} from "@/lib/services/planting-feasibility";
import { updatePlantingStartMethod } from "@/app/actions/planting";
import type { PlantStartMethod } from "@/lib/generated/prisma/enums";

type Props = {
  plantingId: string;
  plant: {
    daysToMaturity: number | null;
    indoorStartWeeks: number | null;
    transplantWeeks: number | null;
  };
  frost: { lastFrostDate: string | null; firstFrostDate: string | null };
  /** The method already saved on the planting; null means "use the recommendation". */
  current: PlantStartMethod | null;
  /** Future planting: anchor the feasibility math at its planned date
   *  instead of today, so "plant now / harvest ~" reads for that month. */
  anchorDate?: Date | null;
};

function fmt(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Short per-method detail line: when to act and the estimated harvest. */
function detail(o: StartOption): string {
  if (o.method === "SEED_INDOORS") {
    return o.plantByDate ? `Start indoors ~${fmt(o.plantByDate)}` : "Next spring";
  }
  if (!o.harvestDate) return "Plant now";
  return o.feasibleThisSeason
    ? `Harvest ~${fmt(o.harvestDate)}`
    : `Harvest ~${fmt(o.harvestDate)} (after frost)`;
}

/**
 * Guided "how do I start this plant right now?" selector for the cell detail
 * panel. Leads with the recommended method (pre-selected + badged), anchored
 * to today and the garden's frost dates, and persists the choice so the
 * calendar/reminders follow the path the gardener actually took.
 */
export function StartMethodPicker({ plantingId, plant, frost, current, anchorDate = null }: Props) {
  const f = getStartOptions(plant, frost, anchorDate ?? undefined);
  const [selected, setSelected] = useState<StartMethod>(
    (current as StartMethod | null) ?? f.recommended
  );
  // Collapsed once a method is saved — the three option cards are the
  // panel's biggest space hog and it's a once-per-plant decision. A fresh
  // planting (no saved method yet) opens expanded for the guided choice.
  const [expanded, setExpanded] = useState(current === null);
  const [isSaving, startSave] = useTransition();

  function pick(method: StartMethod) {
    if (isSaving) return;
    if (method === selected) {
      setExpanded(false);
      return;
    }
    const prev = selected;
    setSelected(method);
    setExpanded(false);
    startSave(async () => {
      try {
        await updatePlantingStartMethod(plantingId, method as PlantStartMethod);
      } catch {
        setSelected(prev); // revert on failure
      }
    });
  }

  const sel = f.options.find((o) => o.method === selected) ?? f.recommendedOption;

  if (!expanded) {
    return (
      <div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#ADADAA", marginBottom: "8px" }}>
          How to start
        </p>
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg" style={{ background: "#F4F4EC" }}>
          <div className="min-w-0">
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#3A3A30", display: "block" }}>
              {startMethodLabel(selected)}
            </span>
            <span style={{ fontSize: "11px", color: "#6B6B5A" }}>{detail(sel)}</span>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="shrink-0 text-xs font-medium hover:underline"
            style={{ color: "#3A6B20" }}
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#ADADAA", marginBottom: "8px" }}>
        How to start
      </p>

      {/* Guided headline — the consequence of the current choice. */}
      <p style={{ fontFamily: "var(--font-display)", fontSize: "14px", fontWeight: 700, color: "#111109", lineHeight: 1.3, marginBottom: "8px" }}>
        {sel.feasibleThisSeason || sel.method === "SEED_INDOORS"
          ? sel.summary
          : `Too late this season — ${sel.summary.charAt(0).toLowerCase()}${sel.summary.slice(1)}`}
      </p>

      <div className="space-y-1.5">
        {f.options.map((o) => {
          const isSel = o.method === selected;
          const isRec = o.method === f.recommended;
          return (
            <button
              key={o.method}
              type="button"
              onClick={() => pick(o.method)}
              disabled={isSaving}
              className={`w-full text-left px-3 py-2 rounded-lg transition-all ${
                isSel
                  ? "bg-[#3A6B20] text-white ring-2 ring-inset ring-white/30"
                  : "bg-[#F4F4EC] text-[#3A3A30] hover:bg-[#EAEADE]"
              } disabled:opacity-50`}
            >
              <div className="flex items-center justify-between gap-2">
                <span style={{ fontSize: "12px", fontWeight: 600 }}>
                  {startMethodLabel(o.method)}
                </span>
                {isRec && (
                  <span
                    style={{
                      fontFamily: "var(--font-mono)", fontSize: "7px", letterSpacing: "0.1em",
                      textTransform: "uppercase", padding: "2px 6px", borderRadius: "100px",
                      background: isSel ? "rgba(255,255,255,0.2)" : "#E4F0D4",
                      color: isSel ? "#fff" : "#1C3D0A",
                    }}
                  >
                    Recommended
                  </span>
                )}
              </div>
              <div style={{ fontSize: "11px", marginTop: "1px", color: isSel ? "rgba(255,255,255,0.8)" : "#6B6B5A" }}>
                {detail(o)}
              </div>
            </button>
          );
        })}
      </div>

      {!frost.firstFrostDate && (
        <p style={{ fontSize: "11px", color: "#ADADAA", marginTop: "8px" }}>
          Set your garden&apos;s zip code for frost-aware timing.
        </p>
      )}
    </div>
  );
}
