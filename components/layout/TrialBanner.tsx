"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useState } from "react";

export function TrialBanner({ daysLeft }: { daysLeft: number }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const urgent = daysLeft <= 1;

  return (
    <div className={`flex items-center gap-3 px-4 py-2 text-sm ${urgent ? "bg-[#B85C3A] text-white" : "bg-[#C4790A] text-white"}`}>
      <p className="flex-1 text-center">
        {daysLeft === 0
          ? "Your Pro trial ends today."
          : `Your Pro trial ends in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}.`}{" "}
        <Link href="/settings/billing" className="underline font-medium">
          Upgrade now →
        </Link>
      </p>
      <button onClick={() => setDismissed(true)} aria-label="Dismiss" className="shrink-0 opacity-80 hover:opacity-100">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
