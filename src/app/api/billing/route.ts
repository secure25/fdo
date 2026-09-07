import { withRoute, json } from "@/lib/api";
import { requireApi, assertSameOrigin } from "@/lib/auth/guard";
import { billingSchema } from "@/lib/validation/schemas";
import { changePlan, addCredits, creditsSummary } from "@/lib/usage";
import { creditPackPriceCents } from "@/lib/entitlements";
import { enqueueJob } from "@/lib/jobs/queue";
import { paymentProvider } from "@/lib/billing";

export const POST = withRoute(
  async ({ req }) => {
    await assertSameOrigin();
    const auth = await requireApi();
    const data = billingSchema.parse(await req.json());

    if (data.plan) {
      const provider = paymentProvider();
      if (provider !== "manual") {
        // Paddle / Stripe mode: create a hosted checkout via the billing module.
        const { createCheckoutSession } = await import("@/lib/billing");
        const sessionUrl = await createCheckoutSession(auth.orgId, data.plan);
        return json({ mode: provider, checkoutUrl: sessionUrl });
      }
      // Built-in simulated checkout (self-hosted / demo mode): activates immediately.
      await changePlan(auth.orgId, data.plan, { provider: "MANUAL", providerRef: `manual_${Date.now()}` });
      return json({ mode: "manual", plan: data.plan });
    }

    if (data.credits && data.credits > 0) {
      await addCredits(auth.orgId, data.credits, `credits_${Date.now()}`);
      return json({ mode: "credits", added: data.credits, priceCents: creditPackPriceCents(data.credits) });
    }

    return json({ error: { code: "BAD_REQUEST", message: "Nothing to do" } }, { status: 400 });
  },
  { name: "billing/purchase" }
);

export const GET = withRoute(
  async () => {
    const auth = await requireApi();
    const summary = await creditsSummary(auth.orgId);
    return json(summary);
  },
  { name: "billing/summary" }
);
