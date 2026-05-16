import Link from "next/link";
import type { Metadata } from "next";
import { MarketingChrome, MarketingEyebrow } from "@/components/marketing/MarketingChrome";

export const metadata: Metadata = {
  title: "Terms of Service | Bare Root",
  description: "The agreement between you and Bare Root when you use the service.",
};

const LAST_UPDATED = "May 14, 2026";

export default function TermsPage() {
  return (
    <MarketingChrome>
      <article
        className="container-narrow"
        style={{ padding: "56px 24px 64px", maxWidth: 760, margin: "0 auto" }}
      >
        <div style={{ marginBottom: 16 }}>
          <MarketingEyebrow>§ Legal · Terms</MarketingEyebrow>
        </div>
        <h1
          style={{
            fontFamily: "var(--font-fraunces), Georgia, serif",
            fontSize: "clamp(36px, 5vw, 56px)",
            fontWeight: 800,
            color: "#111109",
            letterSpacing: "-0.035em",
            lineHeight: 0.95,
            fontVariationSettings: "'opsz' 64",
            marginBottom: 14,
          }}
        >
          Terms of <em style={{ fontStyle: "italic", color: "#1C3D0A" }}>Service</em>
        </h1>
        <p
          style={{
            fontFamily: "var(--font-ibm-plex-mono), monospace",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#ADADAA",
            marginBottom: 40,
          }}
        >
          Last updated · {LAST_UPDATED}
        </p>

        <Section title="Summary">
          <p>
            These terms cover your use of Bare Root. By creating an account or
            using the service, you agree to them. The short version: don&apos;t
            abuse the service, your data is yours, our liability is limited to
            what you&apos;ve paid us, and either of us can end the relationship
            with reasonable notice.
          </p>
        </Section>

        <Section title="The service">
          <p>
            Bare Root is a web-based garden planning tool. We provide a planner,
            a plant library, reminders, and related features. Some features
            require a paid subscription (&quot;Pro&quot;). The full feature list
            and current pricing live on the{" "}
            <Link href="/pricing" className="text-[#1C3D0A] underline">pricing page</Link>.
          </p>
          <p>
            We&apos;re building this actively. Features may be added, changed, or
            removed. We&apos;ll give meaningful notice before removing anything
            you actively depend on.
          </p>
        </Section>

        <Section title="Your account">
          <ul>
            <li>You must be at least 13 years old to use Bare Root.</li>
            <li>You&apos;re responsible for keeping your sign-in credentials safe.</li>
            <li>You&apos;re responsible for anything that happens under your account.</li>
            <li>One person, one account. Don&apos;t share logins.</li>
            <li>If you create accounts on behalf of others (e.g. for a family member), you confirm you have authority to do so and accept these terms for them.</li>
          </ul>
        </Section>

        <Section title="Subscriptions and billing">
          <ul>
            <li>The Free tier is free to use, with the limits described on the pricing page.</li>
            <li>Pro is billed in advance — monthly or annually — at the price shown when you subscribe. Prices include a 7-day free trial for first-time subscribers.</li>
            <li>Subscriptions auto-renew until you cancel. You can cancel anytime from <Link href="/settings/billing" className="text-[#1C3D0A] underline">Settings → Billing &amp; Plan</Link>.</li>
            <li>Cancellation takes effect at the end of the current billing period — you keep Pro access through what you&apos;ve already paid for.</li>
            <li>We don&apos;t generally offer refunds for partial periods, but if you think your situation is exceptional, email us and we&apos;ll consider it.</li>
            <li>Payment processing is handled by Stripe under their terms. We never see your full card number.</li>
            <li>If a payment fails, we&apos;ll retry and notify you. Repeated failures may result in Pro access being suspended.</li>
            <li>We may change prices with at least 30 days&apos; notice for renewing subscribers.</li>
          </ul>
        </Section>

        <Section title="Your content">
          <p>
            You own the garden data, photos, notes, and other content you put
            into Bare Root. We don&apos;t claim ownership of any of it.
          </p>
          <p>
            You grant us a limited license to store, display, and process your
            content as needed to run the service (e.g. showing your photos back
            to you, sending your reminders, generating your calendar). That
            license ends when you delete the content or your account.
          </p>
          <p>
            You&apos;re responsible for what you upload. Don&apos;t upload
            content that&apos;s illegal, infringes on someone else&apos;s
            rights, or violates the acceptable use rules below.
          </p>
        </Section>

        <Section title="Acceptable use">
          <p>Don&apos;t:</p>
          <ul>
            <li>Use Bare Root for anything illegal, harmful, harassing, or deceptive</li>
            <li>Attempt to break, probe, or scrape the service in ways that affect other users</li>
            <li>Upload malware or content that infringes on intellectual property</li>
            <li>Resell, sublicense, or commercially redistribute the service or its data</li>
            <li>Impersonate someone else or misrepresent your relationship with another person</li>
          </ul>
          <p>We may suspend or terminate accounts that violate these rules.</p>
        </Section>

        <Section title="Collaborators">
          <p>
            When you invite someone to a garden, you&apos;re vouching that
            you&apos;re entitled to share that data with them. Collaborators
            agree to these same terms when they accept an invitation.
          </p>
        </Section>

        <Section title="No gardening guarantee">
          <p>
            Bare Root provides planning information based on plant databases,
            location data, and general gardening practice. We do our best to be
            accurate, but gardening involves weather, pests, soil, and dozens
            of variables outside our control. We don&apos;t guarantee that
            following our suggestions will result in a successful harvest. Use
            your judgment.
          </p>
        </Section>

        <Section title="Termination">
          <p>
            You can delete your account anytime from settings or by emailing
            us. We can suspend or terminate your account if you violate these
            terms, abuse the service, or fail to pay for Pro. Where reasonable,
            we&apos;ll notify you first and give you a chance to fix things.
          </p>
        </Section>

        <Section title="Disclaimers">
          <p>
            Bare Root is provided &quot;as is&quot; and &quot;as available&quot;.
            We don&apos;t warrant that it will be uninterrupted, error-free, or
            meet every need. To the maximum extent permitted by law, we
            disclaim all implied warranties of merchantability, fitness for a
            particular purpose, and non-infringement.
          </p>
        </Section>

        <Section title="Limitation of liability">
          <p>
            To the maximum extent permitted by law, Bare Root is not liable for
            indirect, incidental, consequential, special, or exemplary damages.
            Our total aggregate liability for any claim arising out of or
            relating to the service is limited to the amount you paid us in
            the 12 months preceding the claim, or $50 if you&apos;re on the
            Free tier — whichever is greater.
          </p>
        </Section>

        <Section title="Changes to these terms">
          <p>
            We&apos;ll update these terms as the service evolves. Material
            changes will be announced via email or in-app notice at least 30
            days before they take effect. Continued use after the effective
            date means you accept the new terms.
          </p>
        </Section>

        <Section title="Governing law">
          <p>
            These terms are governed by the laws of the State of Wisconsin,
            United States, without regard to conflict-of-law principles. Any
            disputes will be resolved in the state or federal courts located
            in Wisconsin.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about these terms?{" "}
            <a href="mailto:hello@bareroot.garden" className="text-[#1C3D0A] underline">
              hello@bareroot.garden
            </a>
            .
          </p>
        </Section>
      </article>
    </MarketingChrome>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2
        style={{
          fontFamily: "var(--font-fraunces), Georgia, serif",
          fontSize: 22,
          fontWeight: 800,
          color: "#111109",
          letterSpacing: "-0.02em",
          marginBottom: 12,
          fontVariationSettings: "'opsz' 24",
        }}
      >
        {title}
      </h2>
      <div className="space-y-3 text-[#3A3A30] text-[15px] leading-relaxed [&_h3]:font-semibold [&_h3]:text-[#111109] [&_h3]:mt-4 [&_h3]:mb-1 [&_h3]:text-sm [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ul_li]:text-[14px]">
        {children}
      </div>
    </section>
  );
}
