import { ImageResponse } from "next/og";

// 512x512 "any" purpose manifest icon. Same drawing as app/icon.tsx,
// scaled up 2x so install surfaces (splash screens, app lists) get a
// crisp large icon. Generated at request time — no static binary needed.

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
          fontSize: 320,
          color: "#A8D870",
          letterSpacing: -8,
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
