import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { Bell, CreditCard, ChevronRight, LogOut } from "lucide-react";
import { SignOutButton } from "@clerk/nextjs";

export default async function SettingsPage() {
  const user = await requireUser();
  const isPro = user.subscriptionTier === "PRO";

  return (
    <div className="container-narrow">
      {/* Page header */}
      <div className="px-[22px] md:px-8 pt-6 pb-5" style={{ borderBottom: "1px solid #E4E4DC" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#7DA84E", marginBottom: "6px" }}>
          <span style={{ display: "block", width: "16px", height: "1.5px", background: "#7DA84E", borderRadius: "1px", flexShrink: 0 }} />
          Account
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px, 4vw, 30px)", fontWeight: 800, color: "#111109", letterSpacing: "-0.03em", lineHeight: 1, fontVariationSettings: "'opsz' 32" }}>
          Settings
        </h1>
      </div>
      <div className="px-[22px] md:px-8 py-5">

      {/* Account info */}
      <div className="bg-white border border-[#E4E4DC] rounded-xl p-4 mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#F4F4EC] flex items-center justify-center text-sm font-medium text-[#6B6B5A]">
          {(user.name ?? user.email)[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#111109] truncate">{user.name ?? "—"}</p>
          <p className="text-xs text-[#ADADAA] truncate">{user.email}</p>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isPro ? "bg-[#1C3D0A] text-white" : "bg-[#F4F4EC] text-[#6B6B5A]"}`}>
          {isPro ? "Pro" : "Free"}
        </span>
      </div>

      {/* Settings links */}
      <div className="space-y-2">
        <SettingsLink href="/settings/notifications" icon={<Bell className="w-4 h-4" />} label="Notifications" />
        <SettingsLink href="/settings/billing" icon={<CreditCard className="w-4 h-4" />} label="Billing & plan" />
      </div>

      <div className="mt-8">
        <SignOutButton>
          <button className="flex items-center gap-2 text-sm text-[#B85C3A] hover:text-[#9B4A2E] transition-colors">
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </SignOutButton>
      </div>
      </div>
    </div>
  );
}

function SettingsLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 p-4 bg-white border border-[#E4E4DC] rounded-xl hover:border-[#7DA84E] transition-colors group">
      <span className="text-[#6B6B5A] group-hover:text-[#1C3D0A] transition-colors">{icon}</span>
      <span className="flex-1 text-sm font-medium text-[#111109]">{label}</span>
      <ChevronRight className="w-4 h-4 text-[#ADADAA]" />
    </Link>
  );
}
