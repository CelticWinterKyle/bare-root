import type { Metadata } from "next";

// metadataBase lives here (not the root layout) so relative OG/canonical URLs
// resolve against the production origin for every marketing page. Per the
// metadata docs it applies to the current route segment and below, so a route
// group layout is a valid home for it.
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://bareroot.garden"),
  title: {
    template: "%s | Bare Root",
    default: "Bare Root: Visual Garden Planner",
  },
  description:
    "Plan your garden. Grow with confidence. Bare Root is the visual garden planner that knows your climate, your beds, and what grows well together.",
  openGraph: {
    siteName: "Bare Root",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
