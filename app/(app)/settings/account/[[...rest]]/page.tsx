import type { Metadata } from "next";
import Link from "next/link";
import { UserProfile } from "@clerk/nextjs";
import { ChevronLeft } from "lucide-react";

export const metadata: Metadata = { title: "Account | Bare Root" };

/**
 * Clerk-hosted account management (name, email, password, sign-in methods,
 * connected accounts). The catch-all segment is required: UserProfile uses
 * path routing and renders its sub-pages (security, etc.) under this route.
 * Appearance mirrors the sign-in page so the embedded UI matches the brand.
 */
export default function AccountSettingsPage() {
  return (
    <div className="container-narrow">
      {/* Page header — matches the settings hub */}
      <div className="px-[22px] md:px-8 pt-6 pb-5" style={{ borderBottom: "1px solid #E4E4DC" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#7DA84E", marginBottom: "6px" }}>
          <span style={{ display: "block", width: "16px", height: "1.5px", background: "#7DA84E", borderRadius: "1px", flexShrink: 0 }} />
          Settings
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px, 4vw, 30px)", fontWeight: 800, color: "#111109", letterSpacing: "-0.03em", lineHeight: 1, fontVariationSettings: "'opsz' 32" }}>
          Account
        </h1>
      </div>

      <div className="px-[22px] md:px-8 py-5">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-sm text-[#6B6B5A] hover:text-[#1C3D0A] transition-colors mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to settings
        </Link>

        <UserProfile
          path="/settings/account"
          appearance={{
            elements: {
              rootBox: "w-full",
              cardBox: "w-full shadow-sm border border-[#E4E4DC] rounded-2xl",
              formButtonPrimary:
                "bg-[#1C3D0A] hover:bg-[#3A6B20] text-white font-semibold",
            },
            variables: {
              colorPrimary: "#1C3D0A",
              colorText: "#111109",
              colorTextSecondary: "#6B6B5A",
              colorBackground: "#FDFDF8",
              colorInputBackground: "#FDFDF8",
              colorInputText: "#111109",
              fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
              borderRadius: "10px",
            },
          }}
        />
      </div>
    </div>
  );
}
