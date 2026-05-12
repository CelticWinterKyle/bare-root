"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useState, useEffect } from "react";

const DISMISS_KEY = "bareroot_trial_banner_dismissed";

export function TrialBanner({ daysLeft }: { daysLeft: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(DISMISS_KEY);
    if (!stored) { setVisible(true); return; }
    const hoursAgo = (Date.now() - Number(stored)) / (1000 * 60 * 60);
    if (hoursAgo > 24) setVisible(true);
  }, []);

  if (!visible) return null;

  const urgent = daysLeft <= 1;

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  }

  return (
    <div className={`flex items-center gap-3 px-4 py-2 text-sm ${urgent ? "bg-[#B85C3A]" : "bg-[#C4790A]"} text-white`}>
      <p className="flex-1 text-center">
        {daysLeft === 0
          ? "Your Pro trial ends today."
          : `Your Pro trial ends in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}.`}{" "}
        <Link href="/settings/billing" className="underline font-medium">
          Upgrade now →
        </Link>
      </p>
      <button onClick={handleDismiss} aria-label="Dismiss" className="shrink-0 opacity-80 hover:opacity-100">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
