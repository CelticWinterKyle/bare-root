"use client";
import { useState, useTransition, useRef, useEffect } from "react";
import { toast } from "sonner";
import { removePlanting, updatePlantingStatus, updatePlantingDates, updatePlantingMeta } from "@/app/actions/planting";
import { addHarvestLog } from "@/app/actions/tracking";

const HARVEST_UNITS = ["lbs", "oz", "kg", "g", "count", "bunches", "bags"];
import { Loader2, Trash2, X, Move } from "lucide-react";
import type { PlantingStatus, PlantCategory, PlantStartMethod } from "@/lib/generated/prisma/enums";
import { pestInfoFor } from "@/lib/services/pest-data";
import { StartMethodPicker } from "./StartMethodPicker";
import Link from "next/link";

const STATUSES: { value: PlantingStatus; label: string; color: string; hint: string }[] = [
  { value: "PLANNED",       label: "Planned",       color: "bg-[#8FA86B] text-white", hint: "On your plan but not yet started" },
  { value: "SEEDS_STARTED", label: "Seeds started", color: "bg-[#D4A843] text-white", hint: "Sown indoors or in seed trays" },
  { value: "TRANSPLANTED",  label: "Transplanted",  color: "bg-[#7AB648] text-white", hint: "Moved out to this bed" },
  { value: "ACTIVE",        label: "Active",        color: "bg-[#3A6B20] text-white", hint: "Growing in the bed right now" },
  { value: "HARVESTING",    label: "Harvesting",    color: "bg-[#D4820A] text-white", hint: "Ready to pick: log harvests below" },
  { value: "HARVESTED",     label: "Harvested",     color: "bg-[#ADADAA] text-white", hint: "Done: kept for season records" },
  { value: "FAILED",        label: "Failed",        color: "bg-[#B85C3A] text-white", hint: "Didn't make it (pests, weather, etc.)" },
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
    plant: {
      id: string;
      name: string;
      category: string;
      daysToMaturity?: number | null;
      indoorStartWeeks?: number | null;
      transplantWeeks?: number | null;
    };
    cell: { row: number; col: number };
    plantedDate: Date | null;
    transplantDate: Date | null;
    expectedHarvestDate: Date | null;
    variety: string | null;
    notes: string | null;
    startMethod: PlantStartMethod | null;
    /** History counts — when present and non-zero, the remove confirm warns
     *  that removal also deletes these records (hard delete cascades). */
    _count?: { harvestLogs: number; photos: number; growthNotes: number };
  };
  warnings: CompanionWarning[];
  gardenId: string;
  bedId: string;
  /** Garden frost dates ("MM-DD") that drive the start-method guidance. */
  frost: { lastFrostDate: string | null; firstFrostDate: string | null };
  /** False for VIEWER collaborators — everything renders read-only:
   *  static status chip, plain-text dates/variety/notes, no Move/Remove. */
  canEdit?: boolean;
  onClose: () => void;
  /** When provided, the Move button is shown. Clicking it puts BedGrid
   *  into move mode — the next empty cell tap relocates this planting. */
  onMoveStart?: (planting: { id: string; plantName: string }) => void;
};

function toInputDate(d: Date | null): string {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0];
}

// timeZone UTC for the same reason as the est. harvest display below —
// dates are stored as UTC midnight, so local formatting can shift a day.
function toDisplayDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

const START_METHOD_LABEL: Record<PlantStartMethod, string> = {
  SEED_INDOORS: "Seeds started indoors",
  DIRECT_SOW: "Direct sown",
  BUY_START: "Bought as a start",
};

export function CellDetail({ planting, warnings, gardenId, bedId, frost, canEdit = true, onClose, onMoveStart }: Props) {
  const [status, setStatus] = useState<PlantingStatus>(planting.status);
  const [plantedDate, setPlantedDate] = useState(toInputDate(planting.plantedDate));
  const [transplantDate, setTransplantDate] = useState(toInputDate(planting.transplantDate));
  const [expectedHarvest, setExpectedHarvest] = useState(toInputDate(planting.expectedHarvestDate));
  const [variety, setVariety] = useState(planting.variety ?? "");
  const [notes, setNotes] = useState(planting.notes ?? "");
  const [isUpdating, startUpdate] = useTransition();
  const [isDating, startDate] = useTransition();
  const [, startMeta] = useTransition();
  const [isRemoving, startRemove] = useTransition();
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const removeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [harvestQty, setHarvestQty] = useState("");
  const [harvestUnit, setHarvestUnit] = useState("lbs");
  const [isLogging, startLogging] = useTransition();

  function handleQuickHarvest() {
    const quantity = Number(harvestQty);
    if (!quantity || quantity <= 0) return;
    startLogging(async () => {
      try {
        await addHarvestLog(planting.id, { quantity, unit: harvestUnit });
        toast.success(`Logged ${quantity} ${harvestUnit} of ${planting.plant.name}`);
        setHarvestQty("");
      } catch {
        toast.error("Couldn't log the harvest. Please try again.");
      }
    });
  }

  function handleMetaBlur(field: "variety" | "notes", value: string) {
    const current = field === "variety" ? planting.variety ?? "" : planting.notes ?? "";
    if (value === current) return;
    startMeta(async () => {
      try {
        await updatePlantingMeta(planting.id, { [field]: value });
      } catch {
        // Roll the field back — without this a failed save looks saved.
        if (field === "variety") setVariety(planting.variety ?? "");
        else setNotes(planting.notes ?? "");
        toast.error("Couldn't save. Please try again.");
      }
    });
  }

  useEffect(() => () => { if (removeTimerRef.current) clearTimeout(removeTimerRef.current); }, []);

  const beneficial = warnings.filter((w) => w.type === "BENEFICIAL");
  const harmful = warnings.filter((w) => w.type === "HARMFUL");

  function handleStatusChange(s: PlantingStatus) {
    const previous = status;
    setStatus(s);
    startUpdate(async () => {
      try {
        await updatePlantingStatus(planting.id, s);
      } catch {
        // Roll the optimistic chip back — without this a failed save
        // shows as succeeded.
        setStatus(previous);
        toast.error("Couldn't update the status. Please try again.");
      }
    });
  }

  function handleDateBlur(field: "plantedDate" | "transplantDate", value: string) {
    startDate(async () => {
      try {
        await updatePlantingDates(planting.id, { [field]: value || null });
        if (field === "plantedDate" && !value) setExpectedHarvest("");
      } catch {
        if (field === "plantedDate") setPlantedDate(toInputDate(planting.plantedDate));
        else setTransplantDate(toInputDate(planting.transplantDate));
        toast.error("Couldn't save the date. Please try again.");
      }
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
      try {
        await removePlanting(planting.id);
        onClose();
      } catch {
        setRemoveConfirm(false);
        toast.error("Couldn't remove the plant. Please try again.");
      }
    });
  }

  const statusInfo = STATUSES.find((s) => s.value === status);

  // History that a remove would cascade-delete (removePlanting hard-deletes
  // the planting AND its harvest logs / photos / growth notes). Zero-count
  // parts are skipped so the warning only mentions what actually exists.
  const counts = planting._count;
  const historyParts = counts
    ? [
        counts.harvestLogs > 0 ? `${counts.harvestLogs} harvest${counts.harvestLogs === 1 ? "" : "s"}` : null,
        counts.photos > 0 ? `${counts.photos} photo${counts.photos === 1 ? "" : "s"}` : null,
        counts.growthNotes > 0 ? `${counts.growthNotes} note${counts.growthNotes === 1 ? "" : "s"}` : null,
      ].filter((p): p is string => p !== null)
    : [];

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
        {/* Close button — 44px hit target around the 22px visual circle */}
        <button
          onClick={onClose}
          aria-label="Close plant details"
          style={{
            position: "absolute", top: "0px", right: "0px",
            width: "44px", height: "44px", display: "flex",
            alignItems: "center", justifyContent: "center",
            background: "none", zIndex: 2, cursor: "pointer", border: "none",
            padding: 0,
          }}
        >
          <span aria-hidden style={{
            width: "22px", height: "22px", borderRadius: "50%",
            background: "rgba(255,255,255,0.15)", display: "flex",
            alignItems: "center", justifyContent: "center",
            color: "rgba(255,255,255,0.7)",
          }}>
            <X className="w-3 h-3" />
          </span>
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

        {/* Watch-for: common pests for this plant (informational) */}
        {(() => {
          const pests = pestInfoFor(planting.plant.category as PlantCategory, planting.plant.name).pests.slice(0, 3);
          if (pests.length === 0) return null;
          return (
            <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "#6B6B5A", margin: 0 }}>
              <span style={{ color: "#B85C3A", fontWeight: 600 }}>Watch for:</span> {pests.join(", ")}
            </p>
          );
        })()}

        {/* Start-method guidance — "how do I grow this right now?" Leads the
            panel so a freshly placed plant comes with a recommended path.
            Viewers get a static line instead of the picker. */}
        {canEdit ? (
          <StartMethodPicker
            plantingId={planting.id}
            plant={{
              daysToMaturity: planting.plant.daysToMaturity ?? null,
              indoorStartWeeks: planting.plant.indoorStartWeeks ?? null,
              transplantWeeks: planting.plant.transplantWeeks ?? null,
            }}
            frost={frost}
            current={planting.startMethod}
          />
        ) : planting.startMethod ? (
          <div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#ADADAA", marginBottom: "6px" }}>Start method</p>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "#3A3A30" }}>
              {START_METHOD_LABEL[planting.startMethod]}
            </p>
          </div>
        ) : null}

        {/* Status — buttons for editors, a static chip for viewers */}
        <div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#ADADAA", marginBottom: "8px" }}>Status</p>
          {canEdit ? (
            <div className="grid grid-cols-2 gap-1.5">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => handleStatusChange(s.value)}
                  disabled={isUpdating}
                  title={s.hint}
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
          ) : (
            statusInfo && (
              <span className={`inline-block text-xs px-3 py-1.5 rounded-lg font-medium ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            )
          )}
          {/* Hint for the currently-selected status — visible on mobile where
              title= tooltips don't fire. */}
          {statusInfo && (
            <p className="mt-2 text-xs text-[#6B6B5A] leading-snug">
              <span className="font-medium text-[#3A3A30]">{statusInfo.label}:</span>{" "}
              {STATUSES.find((s) => s.value === status)?.hint}
            </p>
          )}

          {/* Quick harvest log — the status hint literally promises "log
              harvests below", so the form lives right here for plants that
              are producing. Full history stays on the planting page. */}
          {canEdit && (status === "HARVESTING" || status === "ACTIVE") && (
            <div className="mt-2.5 flex items-center flex-wrap gap-1.5 p-2 rounded-lg" style={{ background: "#FFF3E8", border: "1px solid #F0DCC8" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#D4820A" }}>
                Log harvest
              </span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={harvestQty}
                onChange={(e) => setHarvestQty(e.target.value)}
                placeholder="Amt"
                className="w-14 text-xs border border-[#E4E4DC] rounded-md px-2 py-1.5 bg-white text-[#111109] focus:outline-none focus:border-[#D4820A]"
              />
              <select
                value={harvestUnit}
                onChange={(e) => setHarvestUnit(e.target.value)}
                className="text-xs border border-[#E4E4DC] rounded-md px-1.5 py-1.5 bg-white text-[#111109] focus:outline-none"
              >
                {HARVEST_UNITS.map((u) => <option key={u}>{u}</option>)}
              </select>
              <button
                onClick={handleQuickHarvest}
                disabled={isLogging || !Number(harvestQty)}
                className="text-xs font-medium px-2.5 py-1.5 rounded-md bg-[#D4820A] text-white hover:bg-[#B86F08] transition-colors disabled:opacity-40"
              >
                {isLogging ? "…" : "Log"}
              </button>
            </div>
          )}
        </div>

        {/* Variety + Notes — inputs for editors, plain text for viewers */}
        <div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#ADADAA", marginBottom: "8px" }}>Details</p>
          {canEdit ? (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Variety (e.g. Sungold, Roma)"
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
                onBlur={(e) => handleMetaBlur("variety", e.target.value)}
                className="w-full text-xs border border-[#E4E4DC] rounded-md px-2.5 py-1.5 text-[#111109] bg-white focus:outline-none focus:ring-1 focus:ring-[#1C3D0A] placeholder:text-[#ADADAA]"
              />
              <textarea
                placeholder="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={(e) => handleMetaBlur("notes", e.target.value)}
                rows={2}
                className="w-full text-xs border border-[#E4E4DC] rounded-md px-2.5 py-1.5 text-[#111109] bg-white focus:outline-none focus:ring-1 focus:ring-[#1C3D0A] placeholder:text-[#ADADAA] resize-none"
              />
            </div>
          ) : planting.variety || planting.notes ? (
            <div className="space-y-1.5">
              {planting.variety && (
                <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "#3A3A30" }}>
                  <span style={{ color: "#6B6B5A" }}>Variety:</span> {planting.variety}
                </p>
              )}
              {planting.notes && (
                <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "#3A3A30", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                  {planting.notes}
                </p>
              )}
            </div>
          ) : (
            <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "#ADADAA" }}>No variety or notes yet</p>
          )}
        </div>

        {/* Dates — date inputs for editors, plain text for viewers */}
        <div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#ADADAA", marginBottom: "8px" }}>Dates</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "#6B6B5A", flexShrink: 0 }}>Planted</label>
              {canEdit ? (
                <input
                  type="date"
                  value={plantedDate}
                  onChange={(e) => setPlantedDate(e.target.value)}
                  onBlur={(e) => handleDateBlur("plantedDate", e.target.value)}
                  disabled={isDating}
                  className="text-xs border border-[#E4E4DC] rounded-md px-2 py-1 text-[#111109] bg-white focus:outline-none focus:ring-1 focus:ring-[#1C3D0A] disabled:opacity-50"
                />
              ) : (
                <span style={{ fontSize: "12px", color: "#3A3A30" }}>{toDisplayDate(planting.plantedDate)}</span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <label style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "#6B6B5A", flexShrink: 0 }}>Transplanted</label>
              {canEdit ? (
                <input
                  type="date"
                  value={transplantDate}
                  onChange={(e) => setTransplantDate(e.target.value)}
                  onBlur={(e) => handleDateBlur("transplantDate", e.target.value)}
                  disabled={isDating}
                  className="text-xs border border-[#E4E4DC] rounded-md px-2 py-1 text-[#111109] bg-white focus:outline-none focus:ring-1 focus:ring-[#1C3D0A] disabled:opacity-50"
                />
              ) : (
                <span style={{ fontSize: "12px", color: "#3A3A30" }}>{toDisplayDate(planting.transplantDate)}</span>
              )}
            </div>
            {expectedHarvest && (
              <div className="flex items-center justify-between gap-2">
                <label style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "#6B6B5A", flexShrink: 0 }}>Est. harvest</label>
                <span style={{ fontSize: "12px", color: "#3A6B20", fontWeight: 600 }}>
                  {/* timeZone UTC: "YYYY-MM-DD" parses as UTC midnight, so
                      local formatting would show the previous day in the US */}
                  {new Date(expectedHarvest).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
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
                    {w.plantName}{w.notes ? `: ${w.notes}` : ""}
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
                    {w.plantName}{w.notes ? `: ${w.notes}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* History warning — shown while the remove button is armed, when the
          planting has records that the hard delete would take with it. */}
      {canEdit && removeConfirm && historyParts.length > 0 && (
        <div style={{
          padding: "8px 16px",
          background: "#FBF0EE",
          borderTop: "1px solid rgba(122,42,24,0.15)",
          fontFamily: "var(--font-body)",
          fontSize: "11px",
          color: "#7A2A18",
          lineHeight: 1.45,
        }}>
          Removing also deletes its history — {historyParts.join(", ")}. Finished plants can be marked <strong>Harvested</strong> instead.
        </div>
      )}

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
          Open
        </Link>
        {canEdit && onMoveStart && (
          <button
            onClick={() => {
              onMoveStart({ id: planting.id, plantName: planting.plant.name });
              onClose();
            }}
            style={{
              flex: 1, padding: "8px 10px", borderRadius: "8px",
              fontFamily: "var(--font-body)", fontSize: "11px", fontWeight: 600,
              background: "transparent", color: "#3A6B20",
              border: "1.5px solid rgba(58,107,32,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
              cursor: "pointer",
            }}
          >
            <Move className="w-3 h-3" />
            Move
          </button>
        )}
        {canEdit && <button
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
        </button>}
      </div>
    </div>
  );
}
