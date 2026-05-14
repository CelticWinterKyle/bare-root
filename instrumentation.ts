// Next.js instrumentation hook — fires once per runtime on cold start.
// Sentry's server and edge SDKs need to be initialized here so that
// errors thrown from server components, server actions, and route
// handlers get captured.
//
// onRequestError is the documented hook for capturing errors thrown
// during request handling that wouldn't otherwise reach a try/catch.

import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
