"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateUserUnits } from "@/app/actions/user";

/** Imperial/metric display toggle — storage stays imperial. */
export function UnitsToggle({ current }: { current: "IMPERIAL" | "METRIC" }) {
  const [units, setUnits] = useState(current);
  const [, startSave] = useTransition();
  const router = useRouter();

  function pick(next: "IMPERIAL" | "METRIC") {
    if (next === units) return;
    const prev = units;
    setUnits(next);
    startSave(async () => {
      try {
        await updateUserUnits(next);
        router.refresh();
      } catch {
        setUnits(prev);
        toast.error("Couldn't save. Please try again.");
      }
    });
  }

  return (
    <div className="inline-flex rounded-lg overflow-hidden" style={{ border: "1px solid #E4E4DC" }}>
      {(["IMPERIAL", "METRIC"] as const).map((u) => (
        <button
          key={u}
          type="button"
          onClick={() => pick(u)}
          className="px-3 py-1.5 text-xs font-medium transition-colors"
          style={{
            background: units === u ? "#1C3D0A" : "#FDFDF8",
            color: units === u ? "white" : "#6B6B5A",
          }}
        >
          {u === "IMPERIAL" ? "ft / °F" : "m / °C"}
        </button>
      ))}
    </div>
  );
}
