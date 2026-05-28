import Link from "next/link";

export default function AppNotFound() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-24 text-center">
      <p className="font-display text-2xl font-semibold text-[#111109] mb-2">Not found</p>
      <p className="text-sm text-[#6B6B5A] mb-8">
        That page or item doesn&apos;t exist, or it may have been removed.
      </p>
      <Link
        href="/dashboard"
        className="bg-[#1C3D0A] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#3A6B20] transition-colors"
      >
        Go to dashboard
      </Link>
    </div>
  );
}
