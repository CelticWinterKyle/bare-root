import { ImageResponse } from "next/og";

// Next.js icon convention: this file is served as /icon and used as the
// favicon by the browser. Generated as a real PNG at request time, so we
// don't need static binary icons in /public.

export const runtime = "edge";
export const size = { width: 256, height: 256 };
export const contentType = "image/png";

export default function Icon() {
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
          fontSize: 160,
          color: "#A8D870",
          letterSpacing: -4,
          lineHeight: 1,
        }}
      >
        b
      </div>
    ),
    size
  );
}
