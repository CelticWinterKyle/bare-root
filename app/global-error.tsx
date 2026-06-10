"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Replaces the root layout when it (or the root template) throws, so it must
// render its own <html>/<body>. Inline styles only — global CSS may not load
// in this failure mode.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FDFDF8",
          color: "#111109",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", padding: "24px" }}>
          <p style={{ fontSize: "22px", fontWeight: 600, margin: "0 0 8px" }}>
            Something went wrong
          </p>
          <p style={{ fontSize: "14px", color: "#6B6B5A", margin: "0 0 24px" }}>
            An unexpected error occurred. Your data is safe.
          </p>
          <button
            onClick={() => reset()}
            style={{
              background: "#1C3D0A",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
