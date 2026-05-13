"use client";
import Link from "next/link";

export default function CalendarError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-24 text-center">
      <p className="font-display text-2xl font-semibold text-[#111109] mb-2">
        Couldn&apos;t load the calendar
      </p>
      <p className="text-sm text-[#6B6B5A] mb-8">
        Your planting data is safe — this is a temporary display error.
      </p>
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={reset}
          className="bg-[#1C3D0A] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#3A6B20] transition-colors"
        >
          Try again
        </button>
        <Link href="/dashboard" className="text-sm text-[#6B6B5A] hover:text-[#111109] underline">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
