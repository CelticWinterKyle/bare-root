import Link from "next/link";
import { Check } from "lucide-react";
import { MarketingChrome, MarketingEyebrow } from "@/components/marketing/MarketingChrome";

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
    a: "Yes — 7 days free when you first upgrade. Your card is required upfront but won’t be charged until the trial ends.",
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

function Cell({ value, dark = false }: { value: boolean | string; dark?: boolean }) {
  if (typeof value === "string") {
    return (
      <span style={{ fontSize: 13, color: dark ? "#A8D870" : "#111109" }}>{value}</span>
    );
  }
  if (value) {
    return (
      <Check
        className="mx-auto"
        style={{ width: 16, height: 16, color: dark ? "#A8D870" : "#3A6B20" }}
      />
    );
  }
  return <span style={{ color: dark ? "rgba(168,216,112,0.35)" : "#E4E4DC", fontSize: 18 }}>—</span>;
}

export default function PricingPage() {
  return (
    <MarketingChrome>
      {/* Hero */}
      <section
        className="container-narrow"
        style={{ padding: "80px 32px 56px", textAlign: "center" }}
      >
        <div style={{ marginBottom: 18 }}>
          <MarketingEyebrow>§ Pricing · Two tiers</MarketingEyebrow>
        </div>
        <h1
          style={{
            fontFamily: "var(--font-fraunces), Georgia, serif",
            fontSize: "clamp(40px, 5.5vw, 64px)",
            fontWeight: 800,
            lineHeight: 0.95,
            letterSpacing: "-0.035em",
            color: "#111109",
            fontVariationSettings: "'opsz' 96",
            marginBottom: 18,
          }}
        >
          Simple, <em style={{ fontStyle: "italic", color: "#1C3D0A" }}>honest</em> pricing.
        </h1>
        <p
          style={{
            fontFamily: "var(--font-fraunces), Georgia, serif",
            fontStyle: "italic",
            fontSize: 19,
            color: "#3A3A30",
            maxWidth: 560,
            margin: "0 auto",
            fontVariationSettings: "'opsz' 22",
          }}
        >
          Free to start. Upgrade when you want more.
        </p>
      </section>

      {/* Plan cards */}
      <section
        className="container-narrow"
        style={{ padding: "0 32px 64px", display: "grid", gridTemplateColumns: "1fr", gap: 18 }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
          {/* Free */}
          <div
            style={{
              background: "#FDFDF8",
              border: "1px solid #E4E4DC",
              borderRadius: 18,
              padding: "32px 28px",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-ibm-plex-mono), monospace",
                fontSize: 10,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "#6B6B5A",
                marginBottom: 12,
              }}
            >
              Free
            </p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 24 }}>
              <span
                style={{
                  fontFamily: "var(--font-fraunces), Georgia, serif",
                  fontSize: 52,
                  fontWeight: 800,
                  color: "#111109",
                  letterSpacing: "-0.035em",
                  lineHeight: 1,
                }}
              >
                $0
              </span>
              <span style={{ fontSize: 14, color: "#6B6B5A" }}>forever</span>
            </div>
            <Link
              href="/sign-up"
              style={{
                display: "block",
                width: "100%",
                textAlign: "center",
                border: "1.5px solid #1C3D0A",
                color: "#1C3D0A",
                fontWeight: 600,
                padding: "11px 16px",
                borderRadius: 10,
                textDecoration: "none",
                fontSize: 14,
              }}
            >
              Get started
            </Link>
            <p
              style={{
                marginTop: 16,
                fontSize: 13,
                color: "#6B6B5A",
                fontStyle: "italic",
                fontFamily: "var(--font-fraunces), Georgia, serif",
              }}
            >
              One garden, three beds, the plant library. Plenty to actually grow something this season.
            </p>
          </div>

          {/* Pro */}
          <div
            style={{
              background: "#1C3D0A",
              borderRadius: 18,
              padding: "32px 28px",
              color: "#FDFDF8",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                background: "rgba(168,216,112,0.18)",
                border: "1px solid rgba(168,216,112,0.3)",
                color: "#A8D870",
                fontSize: 9,
                fontFamily: "var(--font-ibm-plex-mono), monospace",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                padding: "4px 9px",
                borderRadius: 100,
                fontWeight: 600,
              }}
            >
              7-day trial
            </span>
            <p
              style={{
                fontFamily: "var(--font-ibm-plex-mono), monospace",
                fontSize: 10,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "rgba(168,216,112,0.7)",
                marginBottom: 12,
              }}
            >
              Pro
            </p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
              <span
                style={{
                  fontFamily: "var(--font-fraunces), Georgia, serif",
                  fontWeight: 800,
                  fontSize: 52,
                  letterSpacing: "-0.035em",
                  lineHeight: 1,
                  color: "#FDFDF8",
                }}
              >
                $<em style={{ fontStyle: "italic" }}>4</em>
                <sup style={{ fontSize: 24, verticalAlign: "super", fontWeight: 700 }}>58</sup>
              </span>
              <span style={{ fontSize: 13, color: "rgba(253,253,248,0.6)" }}>/mo, billed annually</span>
            </div>
            <p style={{ fontSize: 13, color: "rgba(253,253,248,0.55)", marginBottom: 24 }}>
              or $7/mo billed monthly
            </p>
            <Link
              href="/sign-up"
              style={{
                display: "block",
                width: "100%",
                textAlign: "center",
                background: "#FDFDF8",
                color: "#1C3D0A",
                fontWeight: 700,
                padding: "11px 16px",
                borderRadius: 10,
                textDecoration: "none",
                fontSize: 14,
              }}
            >
              Start free trial
            </Link>
            <p
              style={{
                marginTop: 16,
                fontSize: 13,
                color: "rgba(253,253,248,0.7)",
                fontStyle: "italic",
                fontFamily: "var(--font-fraunces), Georgia, serif",
              }}
            >
              Every feature. Unlimited gardens. The full editorial planning experience.
            </p>
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="container-narrow" style={{ padding: "0 32px 64px" }}>
        <div style={{ marginBottom: 24 }}>
          <MarketingEyebrow>§ Compare</MarketingEyebrow>
        </div>
        <div
          style={{
            background: "#FDFDF8",
            border: "1px solid #E4E4DC",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #E4E4DC", background: "#F8F5EB" }}>
                <th
                  style={{
                    textAlign: "left",
                    padding: "14px 20px",
                    fontFamily: "var(--font-ibm-plex-mono), monospace",
                    fontSize: 10,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "#6B6B5A",
                    fontWeight: 500,
                  }}
                >
                  Feature
                </th>
                <th
                  style={{
                    textAlign: "center",
                    padding: "14px 20px",
                    fontFamily: "var(--font-ibm-plex-mono), monospace",
                    fontSize: 10,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "#6B6B5A",
                    fontWeight: 500,
                    width: 110,
                  }}
                >
                  Free
                </th>
                <th
                  style={{
                    textAlign: "center",
                    padding: "14px 20px",
                    fontFamily: "var(--font-ibm-plex-mono), monospace",
                    fontSize: 10,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "#1C3D0A",
                    fontWeight: 600,
                    width: 110,
                  }}
                >
                  Pro
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row, i) => (
                <tr key={row.feature} style={{ borderTop: i === 0 ? "none" : "1px solid #F4F4EC" }}>
                  <td style={{ padding: "11px 20px", fontSize: 13.5, color: "#111109" }}>
                    {row.feature}
                  </td>
                  <td style={{ padding: "11px 20px", textAlign: "center" }}>
                    <Cell value={row.free} />
                  </td>
                  <td style={{ padding: "11px 20px", textAlign: "center" }}>
                    <Cell value={row.pro} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="container-narrow" style={{ padding: "0 32px 64px" }}>
        <div style={{ marginBottom: 24 }}>
          <MarketingEyebrow>§ Questions</MarketingEyebrow>
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          {FAQ.map((item) => (
            <div
              key={item.q}
              style={{
                background: "#FDFDF8",
                border: "1px solid #E4E4DC",
                borderRadius: 14,
                padding: "18px 22px",
              }}
            >
              <p
                style={{
                  fontFamily: "var(--font-fraunces), Georgia, serif",
                  fontWeight: 700,
                  fontSize: 16,
                  color: "#111109",
                  marginBottom: 6,
                  letterSpacing: "-0.015em",
                  fontVariationSettings: "'opsz' 18",
                }}
              >
                {item.q}
              </p>
              <p style={{ fontSize: 14, color: "#3A3A30", lineHeight: 1.5 }}>{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section
        className="container-narrow"
        style={{ padding: "0 32px 96px", textAlign: "center" }}
      >
        <p
          style={{
            fontFamily: "var(--font-fraunces), Georgia, serif",
            fontWeight: 800,
            fontSize: "clamp(28px, 4vw, 40px)",
            color: "#111109",
            letterSpacing: "-0.03em",
            marginBottom: 22,
          }}
        >
          Your best garden <em style={{ fontStyle: "italic", color: "#1C3D0A" }}>starts here</em>.
        </p>
        <Link
          href="/sign-up"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            background: "#1C3D0A",
            color: "#FDFDF8",
            padding: "14px 24px",
            borderRadius: 10,
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Start planning — free
          <span style={{ fontFamily: "var(--font-fraunces), Georgia, serif", fontStyle: "italic" }}>
            →
          </span>
        </Link>
      </section>
    </MarketingChrome>
  );
}
