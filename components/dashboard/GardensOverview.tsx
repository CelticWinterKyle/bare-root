import Link from "next/link";
import { Plus } from "lucide-react";
import { CreateGardenDialog } from "@/components/garden/CreateGardenDialog";

export type GardenCard = {
  id: string;
  name: string;
  usdaZone: string | null;
  bedCount: number;
  activeSeasonName: string | null;
};

const tagStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "9px",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "#6B6B5A",
  background: "#F4F4EC",
  border: "1px solid #E4E4DC",
  borderRadius: "5px",
  padding: "2px 6px",
  whiteSpace: "nowrap",
};

/**
 * Dashboard "Your gardens" overview — a card per accessible garden plus a
 * "New garden" card (which shows the tier upsell when at the limit). Reads the
 * dashboard's --x-pad CSS var so its padding lines up with the other sections.
 */
export function GardensOverview({
  gardens,
  atLimit,
}: {
  gardens: GardenCard[];
  atLimit: boolean;
}) {
  return (
    <section style={{ padding: "40px var(--x-pad) 4px" }}>
      <div style={{ marginBottom: "16px" }}>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "#3A6B20",
            fontWeight: 500,
          }}
        >
          <span style={{ width: 16, height: 1.5, background: "#3A6B20", borderRadius: 1 }} />
          Gardens
        </span>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "22px",
            fontWeight: 800,
            color: "#111109",
            letterSpacing: "-0.025em",
            fontVariationSettings: "'opsz' 26",
            marginTop: "6px",
          }}
        >
          Your <em style={{ fontStyle: "italic", color: "#1C3D0A" }}>gardens</em>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
          gap: "12px",
        }}
      >
        {gardens.map((g) => (
          <Link
            key={g.id}
            href={`/garden/${g.id}`}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              padding: "14px",
              background: "#FDFDF8",
              border: "1px solid #E4E4DC",
              borderRadius: "12px",
              textDecoration: "none",
              boxShadow: "0 1px 4px rgba(28,61,10,0.04)",
              minHeight: "92px",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "16px",
                fontWeight: 700,
                color: "#111109",
                letterSpacing: "-0.01em",
                lineHeight: 1.15,
              }}
            >
              {g.name}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "auto" }}>
              {g.usdaZone && <span style={tagStyle}>Zone {g.usdaZone}</span>}
              {g.activeSeasonName && <span style={tagStyle}>{g.activeSeasonName}</span>}
              <span style={tagStyle}>
                {g.bedCount} bed{g.bedCount === 1 ? "" : "s"}
              </span>
            </div>
          </Link>
        ))}

        <CreateGardenDialog
          atLimit={atLimit}
          trigger={
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "14px",
                minHeight: "92px",
                border: "1.5px dashed #E4E4DC",
                borderRadius: "12px",
                color: "#ADADAA",
                fontFamily: "var(--font-body)",
                fontSize: "13px",
                fontWeight: 500,
              }}
            >
              <Plus style={{ width: 16, height: 16 }} />
              New garden
            </div>
          }
        />
      </div>
    </section>
  );
}
