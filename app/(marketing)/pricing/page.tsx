import Link from "next/link";
import { Check } from "lucide-react";

const COMPARISON = [
  { feature: "Gardens", free: "1", pro: "Unlimited" },
  { feature: "Beds per garden", free: "3", pro: "Unlimited" },
  { feature: "Plant library", free: true, pro: true },
  { feature: "Visual bed planner", free: true, pro: true },
  { feature: "Companion planting", free: true, pro: true },
  { feature: "Season history", free: false, pro: true },
  { feature: "AI layout planner", free: false, pro: true },
  { feature: "Planting calendar", free: false, pro: true },
  { feature: "Weather & frost alerts", free: false, pro: true },
  { feature: "Reminders", free: false, pro: true },
  { feature: "Harvest tracking", free: false, pro: true },
  { feature: "Photo uploads", free: "20 total", pro: "Unlimited" },
  { feature: "Seed inventory", free: false, pro: true },
  { feature: "Collaborators", free: false, pro: "Up to 5" },
];

const FAQ = [
  {
    q: "What happens to my data if I downgrade?",
    a: "Everything is preserved — your gardens, seasons, harvests, and photos stay intact. Pro features are just hidden until you upgrade again.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from your billing settings whenever you like. No cancellation fees.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes — 7 days free when you first upgrade. Your card is required upfront but won't be charged until the trial ends.",
  },
  {
    q: "Does it work on mobile?",
    a: "Yes. Bare Root is a Progressive Web App — install it on your iPhone or Android home screen for a native app experience.",
  },
  {
    q: "Is Bare Root US-only?",
    a: "For now, yes. Location-based features (growing zones, frost dates, planting calendar) use US zip codes. International support is coming.",
  },
];

function Cell({ value }: { value: boolean | string }) {
  if (typeof value === "string") return <span className="text-sm text-[#111109]">{value}</span>;
  if (value) return <Check className="w-4 h-4 text-[#3A6B20] mx-auto" />;
  return <span className="text-[#E4E4DC] text-lg leading-none">—</span>;
}

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#FAF7F2]">
      <nav className="flex items-center justify-between px-8 py-6 container-narrow">
        <Link href="/" className="font-display text-2xl font-semibold text-[#1C3D0A]">Bare Root</Link>
        <div className="flex items-center gap-4">
          <Link href="/sign-in" className="text-sm text-[#6B6B5A] hover:text-[#111109] transition-colors">Sign in</Link>
          <Link href="/sign-up" className="text-sm bg-[#1C3D0A] text-white px-4 py-2 rounded-lg hover:bg-[#3A6B20] transition-colors">Start free</Link>
        </div>
      </nav>

      <section className="container-narrow px-6 pt-16 pb-8 text-center">
        <h1 className="font-display text-4xl font-semibold text-[#111109] mb-3">Simple, honest pricing</h1>
        <p className="text-[#6B6B5A] text-lg">Free to start. Upgrade when you want more.</p>
      </section>

      {/* Plan cards */}
      <section className="container-narrow px-6 pb-16">
        <div className="grid gap-4 sm:grid-cols-2 mb-16">
          {/* Free */}
          <div className="bg-white border border-[#E4E4DC] rounded-2xl p-6">
            <p className="font-semibold text-lg text-[#111109] mb-1">Free</p>
            <p className="text-3xl font-bold text-[#111109] mb-1">$0</p>
            <p className="text-sm text-[#ADADAA] mb-6">Forever</p>
            <Link
              href="/sign-up"
              className="block w-full text-center border border-[#1C3D0A] text-[#1C3D0A] font-medium py-3 rounded-xl hover:bg-[#F4F4EC] transition-colors text-sm mb-6"
            >
              Get started free
            </Link>
          </div>

          {/* Pro */}
          <div className="bg-[#1C3D0A] rounded-2xl p-6 text-white relative overflow-hidden">
            <div className="absolute top-4 right-4 text-[11px] bg-[#D4820A] px-2 py-0.5 rounded-full font-medium">7-day trial</div>
            <p className="font-semibold text-lg mb-1">Pro</p>
            <div className="flex items-end gap-1 mb-1">
              <p className="text-3xl font-bold">$4.58</p>
              <p className="text-white/60 text-sm mb-1">/mo, billed annually</p>
            </div>
            <p className="text-sm text-white/60 mb-6">or $7/mo, billed monthly</p>
            <Link
              href="/sign-up"
              className="block w-full text-center bg-white text-[#1C3D0A] font-semibold py-3 rounded-xl hover:bg-white/90 transition-colors text-sm mb-1"
            >
              Start free trial
            </Link>
            <p className="text-xs text-white/50 text-center">No charge for 7 days</p>
          </div>
        </div>

        {/* Comparison table */}
        <div className="bg-white rounded-2xl border border-[#E4E4DC] overflow-hidden mb-16">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E4E4DC]">
                <th className="text-left px-5 py-4 text-sm text-[#ADADAA] font-medium">Feature</th>
                <th className="text-center px-5 py-4 text-sm text-[#ADADAA] font-medium">Free</th>
                <th className="text-center px-5 py-4 text-sm text-[#1C3D0A] font-semibold">Pro</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row, i) => (
                <tr key={row.feature} className={i % 2 === 0 ? "bg-white" : "bg-[#FAF7F2]"}>
                  <td className="px-5 py-3 text-sm text-[#111109]">{row.feature}</td>
                  <td className="px-5 py-3 text-center"><Cell value={row.free} /></td>
                  <td className="px-5 py-3 text-center"><Cell value={row.pro} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* FAQ */}
        <h2 className="font-display text-2xl font-semibold text-[#111109] mb-6">Questions</h2>
        <div className="space-y-4 mb-16">
          {FAQ.map((item) => (
            <div key={item.q} className="bg-white rounded-xl border border-[#E4E4DC] p-5">
              <p className="font-medium text-[#111109] mb-1.5 text-sm">{item.q}</p>
              <p className="text-[#6B6B5A] text-sm">{item.a}</p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <p className="font-display text-2xl font-semibold text-[#111109] mb-4">Your best garden starts here.</p>
          <Link
            href="/sign-up"
            className="inline-flex bg-[#1C3D0A] text-white px-8 py-4 rounded-xl text-base font-medium hover:bg-[#3A6B20] transition-colors"
          >
            Start planning free →
          </Link>
        </div>
      </section>

      <footer className="border-t border-[#E4E4DC] py-8 text-center text-sm text-[#ADADAA]">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-3">
          <Link href="/" className="hover:text-[#111109]">Home</Link>
          <Link href="/pricing" className="hover:text-[#111109]">Pricing</Link>
          <Link href="/sign-in" className="hover:text-[#111109]">Sign in</Link>
          <Link href="/privacy" className="hover:text-[#111109]">Privacy</Link>
          <Link href="/terms" className="hover:text-[#111109]">Terms</Link>
        </div>
        <p>Companion planting data from <a href="https://openfarm.cc" target="_blank" rel="noopener noreferrer" className="underline">OpenFarm</a> (CC BY 4.0)</p>
      </footer>
    </main>
  );
}
