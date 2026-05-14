import { ImageResponse } from "next/og";

// Apple touch icon (added to Home Screen on iOS). Apple wants a 180×180
// PNG, served at /apple-icon by convention. Generated at request time
// via the OG image API.

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          fontSize: 110,
          color: "#A8D870",
          letterSpacing: -3,
          lineHeight: 1,
        }}
      >
        b
      </div>
    ),
    size
  );
}
