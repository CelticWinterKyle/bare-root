import Link from "next/link";

// Shared marketing-page shell: warm-paper background, editorial nav with
// lowercase italic "bare root" wordmark + sage dot, and the same footer
// links you see at the bottom of the landing page. Used by /pricing,
// /privacy, /terms, /sign-in, /sign-up so they all read as the same
// product instead of five different design systems.

export function MarketingChrome({
  children,
  showFooter = true,
}: {
  children: React.ReactNode;
  showFooter?: boolean;
}) {
  return (
    <main
      style={{
        background: "#FDFDF8",
        color: "#111109",
        minHeight: "100vh",
        fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
      }}
    >
      <nav
        className="container-narrow"
        style={{
          padding: "22px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link
          href="/"
          style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none" }}
        >
          <span
            style={{
              fontFamily: "var(--font-fraunces), Georgia, serif",
              fontStyle: "italic",
              fontWeight: 800,
              fontSize: 22,
              color: "#1C3D0A",
              letterSpacing: "-0.025em",
              lineHeight: 1,
              fontVariationSettings: "'opsz' 28",
            }}
          >
            bare root
          </span>
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "#7DA84E",
              flexShrink: 0,
              marginBottom: 2,
            }}
          />
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <Link
            href="/pricing"
            style={{ fontSize: 13, color: "#6B6B5A", textDecoration: "none" }}
          >
            Pricing
          </Link>
          <Link
            href="/sign-in"
            style={{ fontSize: 13, color: "#6B6B5A", textDecoration: "none" }}
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#FDFDF8",
              background: "#1C3D0A",
              padding: "8px 14px",
              borderRadius: 8,
              textDecoration: "none",
            }}
          >
            Start free
          </Link>
        </div>
      </nav>

      <div style={{ borderBottom: "1px solid #E4E4DC", marginBottom: 1 }} />

      {children}

      {showFooter && (
        <footer
          style={{
            borderTop: "1px solid #E4E4DC",
            marginTop: 80,
            padding: "32px 24px",
          }}
        >
          <div
            className="container-narrow"
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              fontFamily: "var(--font-ibm-plex-mono), monospace",
              fontSize: 10,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "#ADADAA",
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 22 }}>
              <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>
                Home
              </Link>
              <Link href="/pricing" style={{ color: "inherit", textDecoration: "none" }}>
                Pricing
              </Link>
              <Link href="/sign-in" style={{ color: "inherit", textDecoration: "none" }}>
                Sign in
              </Link>
              <Link href="/privacy" style={{ color: "inherit", textDecoration: "none" }}>
                Privacy
              </Link>
              <Link href="/terms" style={{ color: "inherit", textDecoration: "none" }}>
                Terms
              </Link>
            </div>
            <span>Bare Root · 2026</span>
          </div>
        </footer>
      )}
    </main>
  );
}

/** Editorial eyebrow — IBM Plex Mono sage label with a thin sage rule before it. */
export function MarketingEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-ibm-plex-mono), monospace",
        fontSize: 11,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: "#7DA84E",
        fontWeight: 500,
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: 24,
          height: 1.5,
          background: "#7DA84E",
          borderRadius: 1,
        }}
      />
      {children}
    </span>
  );
}
