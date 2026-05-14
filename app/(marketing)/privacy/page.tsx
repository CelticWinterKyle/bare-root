import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Bare Root",
  description: "How Bare Root collects, uses, and protects your data.",
};

const LAST_UPDATED = "May 14, 2026";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#FAF7F2]">
      <nav className="flex items-center justify-between px-8 py-6 max-w-3xl mx-auto">
        <Link href="/" className="font-display text-2xl font-semibold text-[#1C3D0A]">Bare Root</Link>
        <Link href="/" className="text-sm text-[#6B6B5A] hover:text-[#111109]">Back to home</Link>
      </nav>

      <article className="max-w-3xl mx-auto px-6 pt-8 pb-24">
        <p className="text-xs uppercase tracking-wider text-[#7DA84E] font-mono mb-3">Legal</p>
        <h1 className="font-display text-4xl font-semibold text-[#111109] mb-2">Privacy Policy</h1>
        <p className="text-sm text-[#ADADAA] mb-12">Last updated: {LAST_UPDATED}</p>

        <Section title="Summary">
          <p>
            Bare Root is a garden planning tool. We collect the data you give us
            (your account info, the gardens and plants you track, and any photos
            or notes you add) plus the minimum operational data needed to run
            the service. We don&apos;t sell your data, we don&apos;t use it for
            advertising, and we share it with third parties only when they help
            us run the service (payments, email, hosting).
          </p>
          <p>
            If you have questions or want your data removed, email{" "}
            <a href="mailto:hello@bareroot.garden" className="text-[#1C3D0A] underline">
              hello@bareroot.garden
            </a>
            .
          </p>
        </Section>

        <Section title="Who we are">
          <p>
            Bare Root is operated by Celtic Winter, an independent software
            developer based in the United States. References to &quot;we&quot;,
            &quot;us&quot;, and &quot;Bare Root&quot; in this policy mean the same.
          </p>
        </Section>

        <Section title="What we collect">
          <p>We collect three categories of data:</p>
          <h3>Account data</h3>
          <ul>
            <li>Email address (required, used for sign-in and notifications)</li>
            <li>Display name (optional)</li>
            <li>Profile picture (optional, only if you upload one to Clerk)</li>
            <li>Password (stored and verified entirely by our authentication provider Clerk — we never see it)</li>
          </ul>
          <h3>Garden data (everything you enter)</h3>
          <ul>
            <li>Garden name, description, and dimensions</li>
            <li>Location: ZIP code (used to look up your USDA hardiness zone and frost dates). We do not collect your precise address.</li>
            <li>Bed names, dimensions, and positions; cell sun levels</li>
            <li>Plantings: which plant, when, current status, variety, notes, rating</li>
            <li>Harvest logs, growth notes, and photos you upload</li>
            <li>Seed inventory you choose to track</li>
            <li>Collaborator invitations you send (email addresses)</li>
          </ul>
          <h3>Operational data</h3>
          <ul>
            <li>Subscription tier and Stripe customer ID (for Pro users)</li>
            <li>Notification preferences and push subscription endpoints</li>
            <li>Timezone (used to send reminders at the right time)</li>
            <li>Standard server logs (IP, user agent, timestamp) retained for security and debugging — typically 30 days</li>
          </ul>
        </Section>

        <Section title="How we use it">
          <ul>
            <li>To provide the service: showing your garden, suggesting planting dates, generating reminders, sending notifications</li>
            <li>To process payments if you upgrade to Pro</li>
            <li>To respond to your support requests</li>
            <li>To detect and prevent abuse, fraud, or security incidents</li>
            <li>To improve the product (aggregate, non-identifying analysis only)</li>
          </ul>
          <p>
            We do not use your garden data, photos, or notes for advertising, and
            we do not sell or rent it to anyone.
          </p>
        </Section>

        <Section title="Who we share it with">
          <p>Bare Root runs on top of these third-party processors. Each only sees what they need to do their job:</p>
          <ul>
            <li><strong>Clerk</strong> — authentication and password storage</li>
            <li><strong>Stripe</strong> — payment processing (only Pro upgrades; we never store your card data ourselves)</li>
            <li><strong>Vercel</strong> — hosting, database (Postgres), and file storage (your uploaded photos)</li>
            <li><strong>Resend</strong> — transactional email (reminders, invitations)</li>
            <li><strong>Web push services (Apple, Google, Mozilla)</strong> — delivering push notifications you opt in to</li>
            <li><strong>Perenual / Wikipedia</strong> — public plant data we look up. We do NOT share your data with them; we only fetch plant info.</li>
          </ul>
          <p>
            We may also disclose data if compelled by law (subpoena, court order)
            or to protect our rights or others&apos; safety. We&apos;ll push back on
            overly broad requests and notify you when legally permitted.
          </p>
        </Section>

        <Section title="Photos and uploads">
          <p>
            Photos you upload are stored privately and are only accessible to
            you and the collaborators you invite to that garden. We do not look
            at your photos, scan them, or train any model on them.
          </p>
        </Section>

        <Section title="Collaborators">
          <p>
            When you invite someone to a garden, they receive an email with an
            invite link. Once they accept, they can see (and, if you grant
            editor access, modify) data in that garden. They cannot see data
            from your other gardens.
          </p>
        </Section>

        <Section title="Your rights">
          <ul>
            <li><strong>Access</strong> — request a copy of your data</li>
            <li><strong>Correct</strong> — fix anything inaccurate (most fields are editable in the app)</li>
            <li><strong>Delete</strong> — delete your account and all associated data</li>
            <li><strong>Export</strong> — get your data in a portable format</li>
          </ul>
          <p>
            To exercise any of these, email{" "}
            <a href="mailto:hello@bareroot.garden" className="text-[#1C3D0A] underline">
              hello@bareroot.garden
            </a>
            . We&apos;ll respond within 30 days.
          </p>
        </Section>

        <Section title="Data retention">
          <p>
            We keep your data as long as your account exists. If you delete your
            account, we delete your garden data within 30 days. Backups are
            purged within 90 days. We may retain limited records (e.g. payment
            history) longer where required by law.
          </p>
        </Section>

        <Section title="Security">
          <p>
            Data is encrypted in transit (HTTPS everywhere) and at rest. We use
            reputable infrastructure providers (Vercel, Clerk, Stripe) with
            strong security track records. No system is bulletproof, but if we
            ever experience a breach affecting your data we&apos;ll notify you
            promptly.
          </p>
        </Section>

        <Section title="Children">
          <p>
            Bare Root is not directed at children under 13 and we do not
            knowingly collect their data. If you believe a child has signed up,
            email us and we&apos;ll delete the account.
          </p>
        </Section>

        <Section title="International users">
          <p>
            Bare Root&apos;s servers are located in the United States. If you
            use the service from outside the US, you consent to your data being
            transferred and processed in the US. Many planning features
            (growing zones, frost dates) currently only work for US ZIP codes.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            We&apos;ll update this page if our practices change. The
            &quot;Last updated&quot; date at the top reflects the most recent
            revision. Material changes will be announced via email or in-app
            notice before they take effect.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions, complaints, or data requests:{" "}
            <a href="mailto:hello@bareroot.garden" className="text-[#1C3D0A] underline">
              hello@bareroot.garden
            </a>
            .
          </p>
        </Section>
      </article>

      <footer className="border-t border-[#E4E4DC] py-8 text-center text-sm text-[#ADADAA]">
        <div className="flex items-center justify-center gap-6 mb-3">
          <Link href="/" className="hover:text-[#111109]">Home</Link>
          <Link href="/pricing" className="hover:text-[#111109]">Pricing</Link>
          <Link href="/privacy" className="hover:text-[#111109]">Privacy</Link>
          <Link href="/terms" className="hover:text-[#111109]">Terms</Link>
        </div>
      </footer>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="font-display text-xl font-semibold text-[#111109] mb-3">{title}</h2>
      <div className="space-y-3 text-[#3A3A30] text-[15px] leading-relaxed [&_h3]:font-semibold [&_h3]:text-[#111109] [&_h3]:mt-4 [&_h3]:mb-1 [&_h3]:text-sm [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ul_li]:text-[14px]">
        {children}
      </div>
    </section>
  );
}
