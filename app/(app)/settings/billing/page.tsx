import { requireUser } from "@/lib/auth";
import { BillingClient } from "@/components/settings/BillingClient";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const user = await requireUser();
  const { success } = await searchParams;

  const isPro = user.subscriptionTier === "PRO";
  const trialEndsAt = user.trialEndsAt?.toISOString() ?? null;

  const monthlyPriceId = process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? "";
  const annualPriceId = process.env.STRIPE_PRO_ANNUAL_PRICE_ID ?? "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const billingConfigured = !!monthlyPriceId && !!annualPriceId && !!appUrl;

  if (!billingConfigured) {
    return (
      <div className="container-narrow px-6 py-16">
        <div
          className="rounded-xl border p-6"
          style={{ background: "#FDF2E0", borderColor: "rgba(212,130,10,0.3)" }}
        >
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 22,
              fontWeight: 800,
              color: "#7A4A0A",
              marginBottom: 6,
            }}
          >
            Billing isn&apos;t set up yet
          </h1>
          <p style={{ color: "#7A4A0A", fontSize: 14, lineHeight: 1.5 }}>
            One or more of <code>STRIPE_PRO_MONTHLY_PRICE_ID</code>,{" "}
            <code>STRIPE_PRO_ANNUAL_PRICE_ID</code>, or{" "}
            <code>NEXT_PUBLIC_APP_URL</code> is missing from the Vercel
            environment. Add them in <em>Settings → Environment Variables</em>{" "}
            and redeploy to enable subscriptions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <BillingClient
      isPro={isPro}
      hadTrial={user.hadTrial}
      trialEndsAt={trialEndsAt}
      hasStripeCustomer={!!user.stripeCustomerId}
      justUpgraded={success === "1"}
      monthlyPriceId={monthlyPriceId}
      annualPriceId={annualPriceId}
    />
  );
}
