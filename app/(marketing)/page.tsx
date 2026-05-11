import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MapPin, Sprout, Star, Leaf, LayoutGrid, Bell } from "lucide-react";

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-[#FAF7F2]">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 md:px-8 py-6 max-w-6xl mx-auto">
        <span className="font-display text-2xl font-semibold text-[#2D5016]">Bare Root</span>
        <div className="flex items-center gap-4">
          <Link href="/pricing" className="text-sm text-[#6B6560] hover:text-[#1C1C1A] transition-colors hidden sm:block">
            Pricing
          </Link>
          <Link href="/sign-in" className="text-sm text-[#6B6560] hover:text-[#1C1C1A] transition-colors">
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="text-sm bg-[#2D5016] text-white px-4 py-2 rounded-lg hover:bg-[#4A7C2F] transition-colors"
          >
            Start free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-24 text-center">
        <h1 className="font-display text-5xl md:text-6xl font-semibold text-[#1C1C1A] leading-tight mb-6">
          Plan your garden.
          <br />
          <span className="text-[#2D5016]">Grow with confidence.</span>
        </h1>
        <p className="text-lg text-[#6B6560] max-w-2xl mx-auto mb-10 leading-relaxed">
          Bare Root is the visual garden planner that knows your climate, your beds,
          and what grows well together.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 bg-[#2D5016] text-white px-8 py-4 rounded-xl text-base font-medium hover:bg-[#4A7C2F] transition-colors"
          >
            Start planning free →
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 text-[#6B6560] hover:text-[#1C1C1A] text-sm transition-colors"
          >
            See pricing
          </Link>
        </div>
        <p className="text-xs text-[#9E9890] mt-4">No credit card required to start</p>
      </section>

      {/* Feature 1 — Canvas */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="w-10 h-10 bg-[#F5F0E8] rounded-xl flex items-center justify-center mb-4">
              <LayoutGrid className="w-5 h-5 text-[#2D5016]" />
            </div>
            <h2 className="font-display text-3xl font-semibold text-[#1C1C1A] mb-3">
              Your garden, exactly as it is.
            </h2>
            <p className="text-[#6B6560] leading-relaxed">
              Top-down visual of your raised beds. Place plants in specific spots,
              see your whole space at a glance, zoom into any bed for full detail.
              The canvas is always in sync with your actual plan.
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-[#E8E2D9] p-6 aspect-[4/3] flex items-center justify-center">
            <div className="w-full h-full relative">
              <div className="absolute inset-0 p-4 flex flex-col gap-3">
                <div className="flex gap-3 flex-1">
                  <div className="flex-1 bg-[#F5F0E8] rounded-lg flex flex-col gap-2 p-3">
                    <div className="text-xs font-medium text-[#6B6560]">Bed A</div>
                    <div className="grid grid-cols-4 gap-1 flex-1">
                      {[...Array(12)].map((_, i) => (
                        <div key={i} className={`rounded aspect-square ${i < 4 ? "bg-[#4A7C2F]" : i < 8 ? "bg-[#D4A843]" : "bg-[#E8E2D9]"}`} />
                      ))}
                    </div>
                  </div>
                  <div className="w-20 bg-[#F5F0E8] rounded-lg flex flex-col gap-2 p-3">
                    <div className="text-xs font-medium text-[#6B6560]">Bed B</div>
                    <div className="grid grid-cols-2 gap-1 flex-1">
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className={`rounded aspect-square ${i < 3 ? "bg-[#7AB648]" : "bg-[#E8E2D9]"}`} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 2 — Location */}
      <section className="max-w-5xl mx-auto px-6 py-16 bg-[#F5F0E8] rounded-3xl mb-8">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="order-2 md:order-1 bg-white rounded-2xl border border-[#E8E2D9] p-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3 pb-3 border-b border-[#E8E2D9]">
                <MapPin className="w-4 h-4 text-[#2D5016]" />
                <div>
                  <p className="text-xs text-[#9E9890]">Growing zone</p>
                  <p className="text-sm font-semibold text-[#1C1C1A]">Zone 7b</p>
                </div>
                <div className="ml-auto">
                  <p className="text-xs text-[#9E9890]">Last frost</p>
                  <p className="text-sm font-semibold text-[#1C1C1A]">April 15</p>
                </div>
              </div>
              {[
                { name: "Tomatoes", event: "Start seeds indoors", date: "Mar 4" },
                { name: "Peppers", event: "Start seeds indoors", date: "Feb 18" },
                { name: "Basil", event: "Transplant outdoors", date: "May 13" },
              ].map((item) => (
                <div key={item.name} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#4A7C2F] shrink-0" />
                  <div className="flex-1">
                    <span className="text-sm text-[#1C1C1A]">{item.name}</span>
                    <span className="text-xs text-[#9E9890] ml-1">· {item.event}</span>
                  </div>
                  <span className="text-xs font-medium text-[#6B8F47]">{item.date}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="order-1 md:order-2">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center mb-4">
              <MapPin className="w-5 h-5 text-[#2D5016]" />
            </div>
            <h2 className="font-display text-3xl font-semibold text-[#1C1C1A] mb-3">
              Planting dates calculated for your zip code.
            </h2>
            <p className="text-[#6B6560] leading-relaxed">
              Your growing zone, last frost date, and personalized planting calendar —
              automatically. Never miss a seed-starting window again.
            </p>
          </div>
        </div>
      </section>

      {/* Feature 3 — Companions */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="w-10 h-10 bg-[#F5F0E8] rounded-xl flex items-center justify-center mb-4">
              <Leaf className="w-5 h-5 text-[#2D5016]" />
            </div>
            <h2 className="font-display text-3xl font-semibold text-[#1C1C1A] mb-3">
              Know what grows well together.
            </h2>
            <p className="text-[#6B6560] leading-relaxed">
              Instant companion planting warnings as you plan. The AI layout planner
              builds an optimized bed from your wishlist in seconds — placing plants
              to maximize beneficial relationships and minimize conflicts.
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-[#E8E2D9] p-5 space-y-2">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-[#F5F0E8] border border-[#E8E2D9]">
              <div className="w-8 h-8 rounded-lg bg-[#4A7C2F] shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-medium text-[#1C1C1A]">Tomatoes + Basil</p>
                <p className="text-[11px] text-[#6B8F47]">✓ Great companions — pest deterrent</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-white border border-[#E8E2D9]">
              <div className="w-8 h-8 rounded-lg bg-[#D4A843] shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-medium text-[#1C1C1A]">Peppers + Marigolds</p>
                <p className="text-[11px] text-[#6B8F47]">✓ Beneficial — attracts pollinators</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-white border border-[#B85C3A]/20">
              <div className="w-8 h-8 rounded-lg bg-[#B85C3A]/30 shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-medium text-[#1C1C1A]">Fennel + Tomatoes</p>
                <p className="text-[11px] text-[#B85C3A]">⚠ Keep apart — inhibits growth</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 4 — Track */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="order-2 md:order-1 grid grid-cols-2 gap-3">
            {[
              { icon: Sprout, label: "Harvest logs", val: "47 lbs tomatoes" },
              { icon: Star, label: "Season ratings", val: "4.2 avg" },
              { icon: Bell, label: "Reminders", val: "3 upcoming" },
              { icon: Leaf, label: "Grow again", val: "8 plants" },
            ].map(({ icon: Icon, label, val }) => (
              <div key={label} className="bg-white rounded-xl border border-[#E8E2D9] p-4">
                <Icon className="w-5 h-5 text-[#6B8F47] mb-2" />
                <p className="text-xs text-[#9E9890]">{label}</p>
                <p className="text-sm font-semibold text-[#1C1C1A]">{val}</p>
              </div>
            ))}
          </div>
          <div className="order-1 md:order-2">
            <div className="w-10 h-10 bg-[#F5F0E8] rounded-xl flex items-center justify-center mb-4">
              <Star className="w-5 h-5 text-[#C4790A]" />
            </div>
            <h2 className="font-display text-3xl font-semibold text-[#1C1C1A] mb-3">
              From seed to harvest.
            </h2>
            <p className="text-[#6B6560] leading-relaxed">
              Log harvests, attach photos, rate what worked. Every season remembered
              so next year is better. Reminders sent at just the right time — seed
              starting, transplanting, harvest windows.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing CTA */}
      <section className="max-w-3xl mx-auto px-6 py-16 text-center">
        <h2 className="font-display text-3xl font-semibold text-[#1C1C1A] mb-3">
          Free to start. Upgrade anytime.
        </h2>
        <p className="text-[#6B6560] mb-8">
          One garden, three beds, and the full plant library — free forever.
          <br />
          Pro unlocks everything else for $4.58/month.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/sign-up"
            className="inline-flex bg-[#2D5016] text-white px-8 py-4 rounded-xl text-base font-medium hover:bg-[#4A7C2F] transition-colors"
          >
            Start planning free →
          </Link>
          <Link
            href="/pricing"
            className="inline-flex border border-[#2D5016] text-[#2D5016] px-8 py-4 rounded-xl text-base font-medium hover:bg-[#F5F0E8] transition-colors"
          >
            Compare plans
          </Link>
        </div>
      </section>

      <footer className="border-t border-[#E8E2D9] py-8 text-center text-sm text-[#9E9890]">
        <div className="flex items-center justify-center gap-6 mb-3">
          <Link href="/pricing" className="hover:text-[#1C1C1A]">Pricing</Link>
          <Link href="/sign-in" className="hover:text-[#1C1C1A]">Sign in</Link>
          <Link href="/sign-up" className="hover:text-[#1C1C1A]">Sign up</Link>
        </div>
        <p>
          Companion planting data from{" "}
          <a href="https://openfarm.cc" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#1C1C1A]">
            OpenFarm
          </a>{" "}
          (CC BY 4.0)
        </p>
      </footer>
    </main>
  );
}
