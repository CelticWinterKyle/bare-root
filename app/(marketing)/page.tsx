import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#FAF7F2]">
      <nav className="flex items-center justify-between px-8 py-6 max-w-6xl mx-auto">
        <span className="font-display text-2xl font-semibold text-[#2D5016]">
          Bare Root
        </span>
        <div className="flex items-center gap-4">
          <Link
            href="/sign-in"
            className="text-sm text-[#6B6560] hover:text-[#1C1C1A] transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="text-sm bg-[#2D5016] text-white px-4 py-2 rounded-lg hover:bg-[#3d6b1e] transition-colors"
          >
            Start free
          </Link>
        </div>
      </nav>

      <section className="max-w-4xl mx-auto px-8 pt-20 pb-32 text-center">
        <h1 className="font-display text-5xl md:text-6xl font-semibold text-[#1C1C1A] leading-tight mb-6">
          Plan your garden.
          <br />
          <span className="text-[#2D5016]">Grow with confidence.</span>
        </h1>
        <p className="text-lg text-[#6B6560] max-w-2xl mx-auto mb-10 leading-relaxed">
          Bare Root is the visual garden planner that knows your climate, your
          beds, and what grows well together.
        </p>
        <Link
          href="/sign-up"
          className="inline-flex items-center gap-2 bg-[#2D5016] text-white px-8 py-4 rounded-lg text-lg font-medium hover:bg-[#3d6b1e] transition-colors"
        >
          Start planning free →
        </Link>
      </section>

      <footer className="border-t border-[#E8E2D9] py-8 text-center text-sm text-[#6B6560]">
        <p>
          Companion planting data from{" "}
          <a
            href="https://openfarm.cc"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[#1C1C1A]"
          >
            OpenFarm
          </a>{" "}
          (CC BY 4.0)
        </p>
      </footer>
    </main>
  );
}
