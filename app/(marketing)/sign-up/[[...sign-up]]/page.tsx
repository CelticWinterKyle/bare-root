import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { MarketingChrome, MarketingEyebrow } from "@/components/marketing/MarketingChrome";

export default function SignUpPage() {
  return (
    <MarketingChrome showFooter={false}>
      <section
        className="container-narrow"
        style={{
          padding: "56px 24px 80px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 440 }}>
          <div style={{ marginBottom: 14, display: "inline-flex" }}>
            <MarketingEyebrow>§ Start free</MarketingEyebrow>
          </div>
          <h1
            style={{
              fontFamily: "var(--font-fraunces), Georgia, serif",
              fontSize: 38,
              fontWeight: 800,
              color: "#111109",
              letterSpacing: "-0.03em",
              lineHeight: 1,
              fontVariationSettings: "'opsz' 48",
              marginBottom: 10,
            }}
          >
            Plant your <em style={{ fontStyle: "italic", color: "#1C3D0A" }}>first row</em>.
          </h1>
          <p
            style={{
              fontFamily: "var(--font-fraunces), Georgia, serif",
              fontStyle: "italic",
              fontSize: 16,
              color: "#3A3A30",
              fontVariationSettings: "'opsz' 18",
            }}
          >
            No credit card. Free forever tier. Sets up in under three minutes.
          </p>
        </div>
        <SignUp
          appearance={{
            elements: {
              card: "shadow-sm border border-[#E4E4DC] rounded-2xl",
              headerTitle: "hidden",
              headerSubtitle: "hidden",
              formButtonPrimary:
                "bg-[#1C3D0A] hover:bg-[#3A6B20] text-white font-semibold",
              footerActionLink: "text-[#1C3D0A] hover:text-[#3A6B20]",
            },
            variables: {
              colorPrimary: "#1C3D0A",
              colorText: "#111109",
              colorTextSecondary: "#6B6B5A",
              colorBackground: "#FDFDF8",
              colorInputBackground: "#FDFDF8",
              colorInputText: "#111109",
              fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
              borderRadius: "10px",
            },
          }}
          fallbackRedirectUrl="/onboarding"
        />
        <p
          style={{
            maxWidth: 380,
            textAlign: "center",
            fontSize: 12,
            color: "#6B6B5A",
            lineHeight: 1.5,
          }}
        >
          By signing up you agree to our{" "}
          <Link href="/terms" style={{ color: "#1C3D0A", textDecoration: "underline" }}>
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" style={{ color: "#1C3D0A", textDecoration: "underline" }}>
            Privacy Policy
          </Link>
          .
        </p>
      </section>
    </MarketingChrome>
  );
}
