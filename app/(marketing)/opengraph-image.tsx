import { ImageResponse } from "next/og";

// Shared Open Graph card for every marketing page (route group keeps it off
// the authed app). Statically generated at build time. System serif italic
// stands in for Fraunces — next/og can't load Google fonts without an
// explicit fetch, and the silhouette is close enough at card size.

export const alt = "Bare Root — Plan your garden. Grow with confidence.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Bed-grid motif: a 4×3 raised bed where a few cells are "planted".
// Same drawing language as app/icon.tsx — flat color on simple shapes.
const CELLS: (string | null)[] = [
  "#A8D870", null, "#6B8F47", null,
  null, "#4A8A2E", null, "#A8D870",
  "#6B8F47", null, null, "#4A8A2E",
];

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#FDFDF8",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 100px",
          position: "relative",
          fontFamily: "Georgia, serif",
        }}
      >
        {/* Bed-grid motif, top right */}
        <div
          style={{
            position: "absolute",
            top: 84,
            right: 100,
            display: "flex",
            flexWrap: "wrap",
            width: 296,
            border: "3px solid #1C3D0A",
            borderRadius: 6,
            padding: 6,
            background: "#F4F2E6",
          }}
        >
          {CELLS.map((fill, i) => (
            <div
              key={i}
              style={{
                width: 65,
                height: 65,
                margin: 3,
                borderRadius: 4,
                background: fill ?? "transparent",
                border: fill ? "none" : "2px dashed rgba(28,61,10,0.25)",
              }}
            />
          ))}
        </div>

        <div
          style={{
            fontSize: 30,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "#6B8F47",
            marginBottom: 24,
          }}
        >
          bareroot.garden
        </div>
        <div
          style={{
            fontSize: 132,
            fontStyle: "italic",
            fontWeight: 700,
            color: "#1C3D0A",
            letterSpacing: "-0.03em",
            lineHeight: 1,
          }}
        >
          Bare Root
        </div>
        <div
          style={{
            marginTop: 30,
            fontSize: 40,
            color: "#3F3A2E",
          }}
        >
          Plan your garden. Grow with confidence.
        </div>

        {/* Deep-green ground line */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 18,
            background: "#1C3D0A",
          }}
        />
      </div>
    ),
    size
  );
}
