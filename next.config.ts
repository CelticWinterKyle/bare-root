import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "perenual.com" },
      { protocol: "https", hostname: "*.perenual.com" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
    ],
  },
};

// Sentry wrap is unconditional but inert when the env vars aren't set:
//   - sentry.{client,server,edge}.config.ts each gate Sentry.init on DSN,
//     so no events get sent until SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN
//     are populated.
//   - silent: true suppresses build-time warnings about missing org/project
//     so the build stays quiet pre-activation. Once Kyle adds SENTRY_ORG,
//     SENTRY_PROJECT, and SENTRY_AUTH_TOKEN, flip silent to false and
//     source maps will upload on production builds.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  disableLogger: true,
  // Don't publish browser source maps — they're uploaded to Sentry only.
  sourcemaps: { disable: false, deleteSourcemapsAfterUpload: true },
});
