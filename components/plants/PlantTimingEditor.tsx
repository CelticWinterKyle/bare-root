"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updatePlantTiming } from "@/app/actions/plants";

type Props = {
  plantId: string;
  daysToMaturity: number | null;
  indoorStartWeeks: number | null;
  transplantWeeks: number | null;
  estimated: boolean;
};

export function PlantTimingEditor({
  plantId,
  daysToMaturity,
  indoorStartWeeks,
  transplantWeeks,
  estimated,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [days, setDays] = useState(daysToMaturity?.toString() ?? "");
  const [indoor, setIndoor] = useState(indoorStartWeeks?.toString() ?? "");
  const [transplant, setTransplant] = useState(transplantWeeks?.toString() ?? "");
  const [pending, start] = useTransition();

  const parse = (s: string) => (s.trim() === "" ? null : Number(s));

  function save() {
    start(async () => {
      try {
        await updatePlantTiming(plantId, {
          daysToMaturity: parse(days),
          indoorStartWeeks: parse(indoor),
          transplantWeeks: parse(transplant),
        });
        toast.success("Planting timing updated");
        setEditing(false);
      } catch {
        toast.error("Couldn't save timing. Check the values and try again.");
      }
    });
  }

  return (
    <div className="bg-white rounded-xl border border-[#E4E4DC] p-5 mb-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="font-medium text-[#111109]">Planting timing</h2>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-sm text-[#1C3D0A] underline hover:text-[#3A6B20]"
          >
            Edit
          </button>
        )}
      </div>

      {estimated && !editing && (
        <p className="text-xs text-[#7A4A0A] bg-[#FFF8E7] border border-amber-200 rounded-lg p-2.5 mb-3">
          These dates are <strong>estimated</strong> from the plant category. Edit them to
          match your variety for an accurate calendar.
        </p>
      )}

      {!editing ? (
        <dl className="space-y-2">
          <Row label="Days to maturity" value={daysToMaturity != null ? `${daysToMaturity} days` : "Not set"} />
          <Row
            label="Start indoors"
            value={indoorStartWeeks != null ? `${indoorStartWeeks} weeks before last frost` : "Not set"}
          />
          <Row
            label="Transplant"
            value={transplantWeeks != null ? `${transplantWeeks} weeks after last frost` : "Not set"}
          />
        </dl>
      ) : (
        <div className="space-y-3">
          <Field label="Days to maturity" value={days} onChange={setDays} min={1} max={730} suffix="days" />
          <Field label="Start indoors (weeks before last frost)" value={indoor} onChange={setIndoor} min={0} max={20} suffix="weeks" />
          <Field label="Transplant (weeks after last frost)" value={transplant} onChange={setTransplant} min={0} max={20} suffix="weeks" />
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={save}
              disabled={pending}
              className="bg-[#1C3D0A] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#3A6B20] transition-colors disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => setEditing(false)}
              disabled={pending}
              className="text-sm text-[#6B6B5A] hover:text-[#111109] underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm gap-4">
      <dt className="text-[#ADADAA] shrink-0">{label}</dt>
      <dd className="text-[#111109] text-right">{value}</dd>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  min,
  max,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min: number;
  max: number;
  suffix: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-[#6B6B5A] block mb-1">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="—"
          className="w-24 border border-[#E4E4DC] rounded-lg px-3 py-2 text-sm text-[#111109] focus:outline-none focus:border-[#7DA84E]"
        />
        <span className="text-xs text-[#ADADAA]">{suffix}</span>
      </div>
    </label>
  );
}
