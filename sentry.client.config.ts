// Sentry client-side init. Runs in every browser tab.
//
// Activation is gated on NEXT_PUBLIC_SENTRY_DSN — when the env var is
// unset, Sentry.init() is never called and the SDK adds zero overhead.
// To turn Sentry on:
//   1. Sign up at https://sentry.io and create a Next.js project
//   2. vercel env add NEXT_PUBLIC_SENTRY_DSN production    (paste DSN)
//   3. vercel env add NEXT_PUBLIC_SENTRY_DSN preview       (paste DSN)
//   4. (Optional, for source map uploads) add SENTRY_AUTH_TOKEN,
//      SENTRY_ORG, and SENTRY_PROJECT, then wrap next.config.ts
//      with withSentryConfig.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Sample 10% of normal traffic, 100% of errors. Reasonable starting
    // point — raise if alpha traffic is too low to spot trends.
    tracesSampleRate: 0.1,
    // Session replay: 10% of sessions, 100% of error sessions. Lets us
    // see what the user did before a crash without recording everyone.
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
    // Lower noise — these are expected client-side errors we don't need
    // alerts for.
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "Non-Error promise rejection captured",
    ],
  });
}
