import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { Bell, CreditCard, ChevronRight, LogOut } from "lucide-react";
import { SignOutButton } from "@clerk/nextjs";

export default async function SettingsPage() {
  const user = await requireUser();
  const isPro = user.subscriptionTier === "PRO";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="font-display text-3xl font-semibold text-[#1C1C1A] mb-8">Settings</h1>

      {/* Account info */}
      <div className="bg-white border border-[#E8E2D9] rounded-xl p-4 mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#F5F0E8] flex items-center justify-center text-sm font-medium text-[#6B6560]">
          {(user.name ?? user.email)[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#1C1C1A] truncate">{user.name ?? "—"}</p>
          <p className="text-xs text-[#9E9890] truncate">{user.email}</p>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isPro ? "bg-[#2D5016] text-white" : "bg-[#F5F0E8] text-[#6B6560]"}`}>
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
  );
}

function SettingsLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 p-4 bg-white border border-[#E8E2D9] rounded-xl hover:border-[#6B8F47] transition-colors group">
      <span className="text-[#6B6560] group-hover:text-[#2D5016] transition-colors">{icon}</span>
      <span className="flex-1 text-sm font-medium text-[#1C1C1A]">{label}</span>
      <ChevronRight className="w-4 h-4 text-[#9E9890]" />
    </Link>
  );
}
