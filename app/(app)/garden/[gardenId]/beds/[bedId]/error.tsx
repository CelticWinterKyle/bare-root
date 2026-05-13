"use client";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function BedError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { gardenId } = useParams<{ gardenId: string }>();

  return (
    <div className="max-w-2xl mx-auto px-4 py-24 text-center">
      <p className="font-display text-2xl font-semibold text-[#111109] mb-2">
        Couldn&apos;t load this bed
      </p>
      <p className="text-sm text-[#6B6B5A] mb-8">
        Your plants are safe — this is a temporary display error.
      </p>
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={reset}
          className="bg-[#1C3D0A] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#3A6B20] transition-colors"
        >
          Try again
        </button>
        <Link
          href={gardenId ? `/garden/${gardenId}` : "/garden"}
          className="text-sm text-[#6B6B5A] hover:text-[#111109] underline"
        >
          Back to garden
        </Link>
      </div>
    </div>
  );
}
