"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-24 text-center">
      <p className="font-display text-2xl font-semibold text-[#1C1C1A] mb-2">Something went wrong</p>
      <p className="text-sm text-[#6B6560] mb-8">An unexpected error occurred. Your data is safe.</p>
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={reset}
          className="bg-[#2D5016] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#4A7C2F] transition-colors"
        >
          Try again
        </button>
        <Link href="/dashboard" className="text-sm text-[#6B6560] hover:text-[#1C1C1A] underline">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
