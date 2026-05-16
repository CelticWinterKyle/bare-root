import { SignIn } from "@clerk/nextjs";
import { MarketingChrome, MarketingEyebrow } from "@/components/marketing/MarketingChrome";

export default function SignInPage() {
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
            <MarketingEyebrow>§ Welcome back</MarketingEyebrow>
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
            Sign in to <em style={{ fontStyle: "italic", color: "#1C3D0A" }}>Bare Root</em>.
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
            The garden remembers where you left off.
          </p>
        </div>
        <SignIn
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
          fallbackRedirectUrl="/dashboard"
        />
      </section>
    </MarketingChrome>
  );
}
