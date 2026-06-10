import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://bareroot.garden";

// Marketing pages are crawlable; the authed app (everything behind Clerk in
// app/(app)/, the beta-invite handler, and API routes) is not. Keep this list
// in sync with the top-level route folders under app/(app)/.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/garden",
        "/calendar",
        "/plants",
        "/inventory",
        "/reminders",
        "/settings",
        "/onboarding",
        "/invite",
        "/beta",
        "/api",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
