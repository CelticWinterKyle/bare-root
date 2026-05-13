import type { Metadata } from "next";
import { Fraunces, Crimson_Pro, IBM_Plex_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
});

const crimsonPro = Crimson_Pro({
  variable: "--font-crimson-pro",
  subsets: ["latin"],
  weight: ["300", "400", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bare Root — Visual Garden Planner",
  description:
    "Plan your garden. Grow with confidence. Bare Root is the visual garden planner that knows your climate, your beds, and what grows well together.",
  manifest: "/manifest.json",
  themeColor: "#2D5016",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bare Root",
  },
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
        className={`${fraunces.variable} ${crimsonPro.variable} ${ibmPlexMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col bg-[#F5EDDA] text-[#231A0D]">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
