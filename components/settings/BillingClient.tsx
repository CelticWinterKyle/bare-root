"use client";

import { useState } from "react";
import { Check, Loader2, Sprout, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const FREE_FEATURES = [
  "1 garden",
  "3 beds per garden",
  "Full plant library",
  "Visual bed planner",
  "Companion planting warnings",
];

const PRO_FEATURES = [
  "Unlimited gardens & beds",
  "Full season history",
  "Smart AI layout planner",
  "Location-aware planting calendar",
  "Weather & frost alerts",
  "Reminders & notifications",
  "Harvest tracking & photos",
  "Seed inventory",
  "Collaborators (up to 5)",
];

type Props = {
  isPro: boolean;
  hadTrial: boolean;
  trialEndsAt: string | null;
  hasStripeCustomer: boolean;
  justUpgraded: boolean;
  monthlyPriceId: string;
  annualPriceId: string;
};

export function BillingClient({
  isPro,
  hadTrial,
  trialEndsAt,
  justUpgraded,
  monthlyPriceId,
  annualPriceId,
}: Props) {
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  const [loading, setLoading] = useState<string | null>(null);

  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  async function handleCheckout(priceId: string) {
    setLoading(priceId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const { url } = await res.json() as { url: string };
      window.location.href = url;
    } catch {
      setLoading(null);
    }
  }

  async function handlePortal() {
    setLoading("portal");
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const { url } = await res.json() as { url: string };
      window.location.href = url;
    } catch {
      setLoading(null);
    }
  }

  if (justUpgraded) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-[#F5F0E8] rounded-full flex items-center justify-center mx-auto mb-4">
          <Star className="w-8 h-8 text-[#C4790A] fill-[#C4790A]" />
        </div>
        <h1 className="font-display text-3xl font-semibold text-[#1C1C1A] mb-2">Welcome to Pro!</h1>
        <p className="text-[#6B6560] mb-8">All Pro features are now unlocked. Happy growing.</p>
        <Link href="/dashboard" className="inline-flex bg-[#2D5016] text-white px-6 py-3 rounded-lg text-sm font-medium hover:bg-[#4A7C2F] transition-colors">
          Go to your garden →
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="font-display text-3xl font-semibold text-[#1C1C1A] mb-2">Billing</h1>

      {isPro && trialDaysLeft !== null && trialDaysLeft > 0 && (
        <div className="mb-6 bg-[#FFF3E8] border border-orange-200 rounded-xl px-4 py-3">
          <p className="text-sm font-medium text-[#C4790A]">
            Trial ends in {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""}
          </p>
          <p className="text-xs text-[#6B6560] mt-0.5">Your card will be charged when the trial ends.</p>
        </div>
      )}

      {isPro ? (
        <div className="space-y-4">
          <div className="bg-[#F5F0E8] border border-[#E8E2D9] rounded-xl p-4 flex items-center gap-3">
            <Sprout className="w-5 h-5 text-[#2D5016]" />
            <div>
              <p className="text-sm font-semibold text-[#1C1C1A]">Bare Root Pro</p>
              <p className="text-xs text-[#6B6560]">All features unlocked</p>
            </div>
          </div>
          <Button
            onClick={handlePortal}
            variant="outline"
            className="w-full border-[#E8E2D9] text-[#6B6560]"
            disabled={!!loading}
          >
            {loading === "portal" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Manage subscription →
          </Button>
        </div>
      ) : (
        <>
          <p className="text-[#6B6560] mb-8">
            {hadTrial ? "Upgrade to unlock all Pro features." : "Start a 7-day free trial — no charge until it ends."}
          </p>

          {/* Billing toggle */}
          <div className="flex gap-1 mb-6 bg-[#F5F0E8] rounded-xl p-1 w-fit">
            {(["monthly", "annual"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setBilling(t)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  billing === t ? "bg-white text-[#1C1C1A] shadow-sm" : "text-[#6B6560]"
                }`}
              >
                {t === "monthly" ? "Monthly" : "Annual (save 35%)"}
              </button>
            ))}
          </div>

          {/* Plan cards */}
          <div className="grid gap-4 sm:grid-cols-2 mb-8">
            {/* Free */}
            <div className="bg-white border border-[#E8E2D9] rounded-xl p-5">
              <p className="font-semibold text-[#1C1C1A] mb-0.5">Free</p>
              <p className="text-2xl font-bold text-[#1C1C1A] mb-4">$0</p>
              <ul className="space-y-2 mb-6">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-[#6B6560]">
                    <Check className="w-4 h-4 text-[#6B8F47] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-center text-[#9E9890]">Your current plan</p>
            </div>

            {/* Pro */}
            <div className="bg-[#2D5016] rounded-xl p-5 text-white relative overflow-hidden">
              <div className="absolute top-3 right-3 text-[11px] bg-[#C4790A] text-white px-2 py-0.5 rounded-full font-medium">
                {hadTrial ? "Best value" : "7-day trial"}
              </div>
              <p className="font-semibold mb-0.5">Pro</p>
              <p className="text-2xl font-bold mb-4">
                {billing === "monthly" ? "$7" : "$4.58"}
                <span className="text-sm font-normal text-white/70">/mo</span>
              </p>
              <ul className="space-y-2 mb-6">
                {PRO_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-white/90">
                    <Check className="w-4 h-4 text-[#D4A843] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => handleCheckout(billing === "monthly" ? monthlyPriceId : annualPriceId)}
                disabled={!!loading}
                className="w-full bg-white text-[#2D5016] hover:bg-white/90 font-semibold"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {hadTrial ? "Upgrade to Pro" : "Start free trial"}
              </Button>
              {!hadTrial && (
                <p className="text-xs text-white/60 text-center mt-2">No charge for 7 days</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
