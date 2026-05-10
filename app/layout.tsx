import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
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
        className={`${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col font-sans bg-[#FAF7F2] text-[#1C1C1A]">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
