import { getStartOptions, startMethodLabel } from "@/lib/services/planting-feasibility";

type PlantTiming = {
  daysToMaturity: number | null;
  indoorStartWeeks: number | null;
  transplantWeeks: number | null;
};

/**
 * "How can I grow this right now?" guidance for a plant. Leads with the single
 * recommended method + date (e.g. "Buy a start now → harvest ~Aug 30") and
 * lists the alternatives. Pure/server-safe — the feasibility engine has no IO.
 */
export function PlantFeasibility({
  plant,
  frost,
  className = "",
}: {
  plant: PlantTiming;
  frost: { lastFrostDate: string | null; firstFrostDate: string | null };
  className?: string;
}) {
  if (plant.daysToMaturity == null) return null;
  const f = getStartOptions(plant, frost);
  const rec = f.recommendedOption;
  const others = f.options.filter((o) => o.method !== f.recommended);

  return (
    <div
      className={className}
      style={{ border: "1px solid #E4E4DC", background: "#F4F4EC", borderRadius: "16px", padding: "16px" }}
    >
      <div
        style={{
          display: "flex", alignItems: "center", gap: "8px",
          fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.18em",
          textTransform: "uppercase", color: "#3A6B20", marginBottom: "6px",
        }}
      >
        <span style={{ width: 16, height: 1.5, background: "#3A6B20", borderRadius: 1 }} />
        Plant now
      </div>

      <p style={{ fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 700, color: "#111109", lineHeight: 1.25 }}>
        {f.recommendedThisSeason
          ? rec.summary
          : `Too late this season — ${rec.summary.charAt(0).toLowerCase()}${rec.summary.slice(1)}`}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
        {others.map((o) => (
          <span
            key={o.method}
            title={o.summary}
            style={{
              display: "inline-flex", alignItems: "center", gap: "5px",
              fontFamily: "var(--font-body)", fontSize: "11px", color: "#6B6B5A",
              background: "#FDFDF8", border: "1px solid #E4E4DC", borderRadius: "100px", padding: "3px 9px",
            }}
          >
            <span style={{ color: o.feasibleThisSeason ? "#3A6B20" : "#ADADAA", fontWeight: 700 }}>
              {o.feasibleThisSeason ? "✓" : "·"}
            </span>
            {startMethodLabel(o.method)}
          </span>
        ))}
      </div>

      {!frost.firstFrostDate && (
        <p style={{ fontSize: "11px", color: "#ADADAA", marginTop: "8px" }}>
          Set your garden&apos;s zip code for frost-aware timing.
        </p>
      )}
    </div>
  );
}
