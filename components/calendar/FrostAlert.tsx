import type { ForecastDay } from "@/lib/api/weather";
import { Snowflake } from "lucide-react";

type Props = {
  forecast: ForecastDay[];
  activePlantingCount: number;
};

export function FrostAlert({ forecast, activePlantingCount }: Props) {
  // Pick the SOONEST frost day, not just the first in array order — a
  // cache could hold an unsorted forecast, and a gardener trusts this to
  // know when to cover plants.
  const frostDay = forecast
    .filter((d) => d.minTemp <= 35)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!frostDay || activePlantingCount === 0) return null;

  const d = new Date(frostDay.date + "T12:00:00");
  const label = d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  return (
    <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
      <Snowflake className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-blue-900">Frost risk {label}</p>
        <p className="text-xs text-blue-700 mt-0.5">
          Low of {frostDay.minTemp}°F, so protect or cover your{" "}
          {activePlantingCount} active planting{activePlantingCount !== 1 ? "s" : ""}.
        </p>
      </div>
    </div>
  );
}
