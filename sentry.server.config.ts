// Sentry server-side init. Runs in the Node.js runtime
// (server actions, API route handlers, server components).
//
// Same env-gating as the client config — without SENTRY_DSN this is
// a no-op.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.VERCEL_ENV ?? "development",
  });
}
