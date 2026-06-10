import type { Metadata, Viewport } from "next";
import { Fraunces, DM_Sans, IBM_Plex_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorkerRegistration } from "@/components/layout/ServiceWorkerRegistration";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bare Root: Visual Garden Planner",
  description:
    "Plan your garden. Grow with confidence. Bare Root is the visual garden planner that knows your climate, your beds, and what grows well together.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bare Root",
  },
};

// viewportFit: "cover" is required for env(safe-area-inset-*) to resolve
// to non-zero on iOS — without it the bottom nav sits under the home
// indicator in the installed PWA. themeColor lives here, not in metadata
// (deprecated there in this Next version).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1C3D0A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${fraunces.variable} ${dmSans.variable} ${ibmPlexMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col bg-[#FDFDF8] text-[#111109]">
          {children}
          <Toaster position="bottom-center" mobileOffset={{ bottom: 88 }} />
          <ServiceWorkerRegistration />
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}
