import { ImageResponse } from "next/og";

// 512x512 "maskable" purpose manifest icon. Same drawing as app/icon.tsx
// but the glyph is scaled to ~80% so it sits inside the maskable safe
// zone — launchers can crop up to 20% from each edge (circle, squircle)
// without clipping the mark. The brand green fills the full square.

export const runtime = "edge";

const SIZE = 512;

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#1C3D0A",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "serif",
          fontStyle: "italic",
          fontWeight: 800,
          fontSize: 256,
          color: "#A8D870",
          letterSpacing: -6,
          lineHeight: 1,
        }}
      >
        b
      </div>
    ),
    {
      width: SIZE,
      height: SIZE,
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    }
  );
}
