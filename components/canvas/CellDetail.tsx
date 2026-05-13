"use client";
import { useState, useTransition, useRef, useEffect } from "react";
import { removePlanting, updatePlantingStatus, updatePlantingDates } from "@/app/actions/planting";
import { Loader2, Trash2, X } from "lucide-react";
import type { PlantingStatus } from "@/lib/generated/prisma/enums";
import Link from "next/link";

const STATUSES: { value: PlantingStatus; label: string; color: string }[] = [
  { value: "PLANNED", label: "Planned", color: "bg-[#8FA86B] text-white" },
  { value: "SEEDS_STARTED", label: "Seeds started", color: "bg-[#D4A843] text-white" },
  { value: "TRANSPLANTED", label: "Transplanted", color: "bg-[#7AB648] text-white" },
  { value: "ACTIVE", label: "Active", color: "bg-[#3A6B20] text-white" },
  { value: "HARVESTING", label: "Harvesting", color: "bg-[#D4820A] text-white" },
  { value: "HARVESTED", label: "Harvested", color: "bg-[#ADADAA] text-white" },
  { value: "FAILED", label: "Failed", color: "bg-[#B85C3A] text-white" },
];

type CompanionWarning = {
  type: "BENEFICIAL" | "HARMFUL";
  plantName: string;
  notes: string | null;
};

type Props = {
  planting: {
    id: string;
    status: PlantingStatus;
    plant: { id: string; name: string; category: string };
    cell: { row: number; col: number };
    plantedDate: Date | null;
    transplantDate: Date | null;
    expectedHarvestDate: Date | null;
  };
  warnings: CompanionWarning[];
  gardenId: string;
  bedId: string;
  onClose: () => void;
};

function toInputDate(d: Date | null): string {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0];
}

export function CellDetail({ planting, warnings, gardenId, bedId, onClose }: Props) {
  const [status, setStatus] = useState<PlantingStatus>(planting.status);
  const [plantedDate, setPlantedDate] = useState(toInputDate(planting.plantedDate));
  const [transplantDate, setTransplantDate] = useState(toInputDate(planting.transplantDate));
  const [expectedHarvest, setExpectedHarvest] = useState(toInputDate(planting.expectedHarvestDate));
  const [isUpdating, startUpdate] = useTransition();
  const [isDating, startDate] = useTransition();
  const [isRemoving, startRemove] = useTransition();
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const removeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (removeTimerRef.current) clearTimeout(removeTimerRef.current); }, []);

  const beneficial = warnings.filter((w) => w.type === "BENEFICIAL");
  const harmful = warnings.filter((w) => w.type === "HARMFUL");

  function handleStatusChange(s: PlantingStatus) {
    setStatus(s);
    startUpdate(async () => {
      await updatePlantingStatus(planting.id, s);
    });
  }

  function handleDateBlur(field: "plantedDate" | "transplantDate", value: string) {
    startDate(async () => {
      await updatePlantingDates(planting.id, { [field]: value || null });
      if (field === "plantedDate" && !value) setExpectedHarvest("");
    });
  }

  function handleRemoveClick() {
    if (!removeConfirm) {
      setRemoveConfirm(true);
      removeTimerRef.current = setTimeout(() => setRemoveConfirm(false), 3000);
      return;
    }
    if (removeTimerRef.current) clearTimeout(removeTimerRef.current);
    startRemove(async () => {
      await removePlanting(planting.id);
      onClose();
    });
  }

  const statusInfo = STATUSES.find((s) => s.value === status);

  return (
    <div>
      {/* Deep green header — plant-panel-top */}
      <div style={{
        background: "#1C3D0A", padding: "14px 16px 12px",
        position: "relative", overflow: "hidden",
      }}>
        {/* Decorative circle */}
        <div style={{
          position: "absolute", right: "-16px", top: "-16px",
          width: "80px", height: "80px", background: "#3A6B20",
          borderRadius: "50%", opacity: 0.4,
        }} />
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: "10px", right: "10px",
            width: "22px", height: "22px", borderRadius: "50%",
            background: "rgba(255,255,255,0.15)", display: "flex",
            alignItems: "center", justifyContent: "center",
            color: "rgba(255,255,255,0.7)", zIndex: 2, cursor: "pointer",
            border: "none",
          }}
        >
          <X className="w-3 h-3" />
        </button>
        {/* Plant name */}
        <div style={{
          fontFamily: "var(--font-display)", fontStyle: "italic",
          fontSize: "20px", fontWeight: 800, color: "#fff",
          letterSpacing: "-0.02em", position: "relative", zIndex: 1, lineHeight: 1,
          fontVariationSettings: "'opsz' 22", paddingRight: "28px",
        }}>
          {planting.plant.name}
        </div>
        {/* Category sub */}
        <div style={{
          fontFamily: "var(--font-body)", fontStyle: "italic",
          fontSize: "11px", color: "rgba(255,255,255,0.5)",
          marginTop: "3px", position: "relative", zIndex: 1,
        }}>
          {planting.plant.category.charAt(0) + planting.plant.category.slice(1).toLowerCase()}
          {" · "}Row {planting.cell.row + 1}, Col {planting.cell.col + 1}
        </div>
        {/* Status pill */}
        <div style={{
          position: "absolute", right: "14px", top: "50%",
          transform: "translateY(-50%)",
          fontFamily: "var(--font-mono)", fontSize: "8px",
          letterSpacing: "0.1em", textTransform: "uppercase",
          background: "rgba(168,216,112,0.2)", color: "#A8D870",
          padding: "3px 8px", borderRadius: "100px",
          border: "1px solid rgba(168,216,112,0.3)", zIndex: 1,
        }}>
          {statusInfo?.label}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "12px 16px", background: "#FDFDF8", display: "flex", flexDirection: "column", gap: "16px" }}>

        {/* Status buttons */}
        <div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#ADADAA", marginBottom: "8px" }}>Status</p>
          <div className="grid grid-cols-2 gap-1.5">
            {STATUSES.map((s) => (
              <button
                key={s.value}
                onClick={() => handleStatusChange(s.value)}
                disabled={isUpdating}
                className={`text-xs px-3 py-2.5 rounded-lg font-medium transition-all text-left ${
                  status === s.value
                    ? `${s.color} ring-2 ring-inset ring-white/30`
                    : "bg-[#F4F4EC] text-[#6B6B5A] hover:bg-[#EAEADE]"
                } disabled:opacity-50`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dates */}
        <div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#ADADAA", marginBottom: "8px" }}>Dates</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "#6B6B5A", flexShrink: 0 }}>Planted</label>
              <input
                type="date"
                value={plantedDate}
                onChange={(e) => setPlantedDate(e.target.value)}
                onBlur={(e) => handleDateBlur("plantedDate", e.target.value)}
                disabled={isDating}
                className="text-xs border border-[#E4E4DC] rounded-md px-2 py-1 text-[#111109] bg-white focus:outline-none focus:ring-1 focus:ring-[#1C3D0A] disabled:opacity-50"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <label style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "#6B6B5A", flexShrink: 0 }}>Transplanted</label>
              <input
                type="date"
                value={transplantDate}
                onChange={(e) => setTransplantDate(e.target.value)}
                onBlur={(e) => handleDateBlur("transplantDate", e.target.value)}
                disabled={isDating}
                className="text-xs border border-[#E4E4DC] rounded-md px-2 py-1 text-[#111109] bg-white focus:outline-none focus:ring-1 focus:ring-[#1C3D0A] disabled:opacity-50"
              />
            </div>
            {expectedHarvest && (
              <div className="flex items-center justify-between gap-2">
                <label style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "#6B6B5A", flexShrink: 0 }}>Est. harvest</label>
                <span style={{ fontSize: "12px", color: "#3A6B20", fontWeight: 600 }}>
                  {new Date(expectedHarvest).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Companion warnings */}
        {(harmful.length > 0 || beneficial.length > 0) && (
          <div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#ADADAA", marginBottom: "8px" }}>Companions in this bed</p>
            <div className="space-y-1.5">
              {harmful.map((w) => (
                <div key={w.plantName} style={{ display: "flex", alignItems: "flex-start", gap: "7px" }}>
                  <div style={{
                    width: "18px", height: "18px", borderRadius: "50%", flexShrink: 0, marginTop: "1px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "9px", background: "#FDF2E0", color: "#D4820A",
                  }}>!</div>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "#3A3A30", lineHeight: 1.4 }}>
                    {w.plantName}{w.notes ? ` — ${w.notes}` : ""}
                  </span>
                </div>
              ))}
              {beneficial.map((w) => (
                <div key={w.plantName} style={{ display: "flex", alignItems: "flex-start", gap: "7px" }}>
                  <div style={{
                    width: "18px", height: "18px", borderRadius: "50%", flexShrink: 0, marginTop: "1px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "9px", background: "#E4F0D4", color: "#1C3D0A",
                  }}>✓</div>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "#3A3A30", lineHeight: 1.4 }}>
                    {w.plantName}{w.notes ? ` — ${w.notes}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions footer — plant-panel-actions */}
      <div style={{
        display: "flex", gap: "6px",
        padding: "10px 16px",
        background: "#F4F4EC",
        borderTop: "1px solid #E4E4DC",
      }}>
        <Link
          href={`/garden/${gardenId}/beds/${bedId}/plantings/${planting.id}`}
          onClick={onClose}
          style={{
            flex: 1, padding: "8px 10px", borderRadius: "8px",
            fontFamily: "var(--font-body)", fontSize: "11px", fontWeight: 600,
            background: "#1C3D0A", color: "white",
            border: "1.5px solid #1C3D0A",
            textAlign: "center", textDecoration: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          Harvest log
        </Link>
        <button
          onClick={handleRemoveClick}
          disabled={isRemoving}
          style={{
            flex: 1, padding: "8px 10px", borderRadius: "8px",
            fontFamily: "var(--font-body)", fontSize: "11px", fontWeight: 600,
            background: removeConfirm ? "#7A2A18" : "transparent",
            color: removeConfirm ? "white" : "#7A2A18",
            border: `1.5px solid ${removeConfirm ? "#7A2A18" : "rgba(122,42,24,0.2)"}`,
            cursor: isRemoving ? "not-allowed" : "pointer",
            opacity: isRemoving ? 0.5 : 1,
            display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
          }}
        >
          {isRemoving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
          {removeConfirm ? "Confirm" : "Remove"}
        </button>
      </div>
    </div>
  );
}
