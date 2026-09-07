/**
 * Billing module — provider-agnostic checkout + webhooks.
 *
 * The active provider is chosen automatically from env:
 *   1. Paddle  (PADDLE_API_KEY)      — merchant of record; recommended for sellers
 *                                      outside Stripe's supported countries (e.g. South
 *                                      Africa). Handles global cards, PayPal, and tax.
 *   2. Stripe  (STRIPE_SECRET_KEY)
 *   3. Manual  (no keys)             — self-hosted/demo: plan changes activate instantly.
 *
 * ─── Paddle setup (live) ──────────────────────────────────────────────────────
 * 1. In Paddle Billing create one recurring monthly price per plan:
 *    Maker $15, Growth $39, Pro $99 → paste IDs into PADDLE_PRICE_MAKER/GROWTH/PRO.
 * 2. PADDLE_ENV=sandbox for sandbox-api.paddle.com, or "production" for api.paddle.com.
 * 3. Add a notification destination pointing at {APP_URL}/api/billing/webhook/paddle
 *    subscribed to transaction.completed and subscription.* events; put its
 *    secret key (pdl_ntfset_…) into PADDLE_WEBHOOK_SECRET.
 * 4. Ensure a default payment link exists (Paddle builds transaction checkout URLs
 *    from it — see createPaddleCheckout below).
 *
 * ─── Stripe setup (live) ─────────────────────────────────────────────────────
 * 1. Create one recurring Price per plan with lookup keys
 *    maker_monthly / growth_monthly / pro_monthly (amounts $15/$39/$99).
 * 2. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.
 * 3. Point a Stripe webhook at {APP_URL}/api/billing/webhook for
 *    checkout.session.completed and customer.subscription.updated.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "./db";
import { env } from "./env";
import { logger } from "./logger";
import type { PlanId } from "./entitlements";

export const PLAN_PRICES: Record<Exclude<PlanId, "FREE">, { lookupKey: string; label: string }> = {
  MAKER: { lookupKey: "maker_monthly", label: "Maker" },
  GROWTH: { lookupKey: "growth_monthly", label: "Growth" },
  PRO: { lookupKey: "pro_monthly", label: "Pro" },
};

const PAID_PLANS = ["MAKER", "GROWTH", "PRO"] as const;
export type PaidPlan = (typeof PAID_PLANS)[number];

export type PaymentProvider = "paddle" | "stripe" | "manual";

export function paymentProvider(): PaymentProvider {
  if (env.paddle.apiKey) return "paddle";
  if (env.stripe.secretKey) return "stripe";
  return "manual";
}

/** Kept for compatibility; prefer paymentProvider(). */
export function hasStripePlanGuard(): boolean {
  return Boolean(env.stripe.secretKey);
}

export function isPaidPlan(plan: string): plan is PaidPlan {
  return (PAID_PLANS as readonly string[]).includes(plan);
}

// ─── Stripe ───────────────────────────────────────────────────────────────────

async function stripeRequest(path: string, params?: URLSearchParams): Promise<Record<string, unknown>> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: params ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${env.stripe.secretKey}`,
      ...(params ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: params?.toString(),
  });
  const data = (await res.json()) as { error?: { message?: string } };
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${data.error?.message ?? "request failed"}`);
  return data;
}

/** Resolve a Stripe Price lookup key (e.g. "growth_monthly") to a live Price ID. */
async function resolvePriceId(lookupKey: string): Promise<string> {
  const data = (await stripeRequest(`prices?lookup_keys[]=${encodeURIComponent(lookupKey)}&active=true&limit=1`)) as {
    data?: { id?: string }[];
  };
  const id = data.data?.[0]?.id;
  if (!id) throw new Error(`No active Stripe price with lookup key "${lookupKey}" — create it in the Stripe dashboard first.`);
  return id;
}

async function createStripeCheckout(orgId: string, plan: PaidPlan): Promise<string> {
  const priceId = await resolvePriceId(PLAN_PRICES[plan].lookupKey);
  const params = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: `${env.appUrl}/app/billing?checkout=success`,
    cancel_url: `${env.appUrl}/app/billing?checkout=cancelled`,
    client_reference_id: orgId,
    "metadata[orgId]": orgId,
    "metadata[plan]": plan,
  });
  const data = (await stripeRequest("checkout/sessions", params)) as { url?: string };
  if (!data.url) throw new Error("Stripe checkout session returned no URL");
  return data.url;
}

// ─── Paddle ───────────────────────────────────────────────────────────────────

function paddleApiBase(): string {
  return env.paddle.sandbox ? "https://sandbox-api.paddle.com" : "https://api.paddle.com";
}

/** Extract the hosted-checkout URL from a Paddle transaction response (pure, testable). */
export function paddleCheckoutUrlFromTransaction(
  txn: unknown
): string | null {
  const url = (txn as { checkout?: { url?: string } } | null | undefined)?.checkout?.url;
  return typeof url === "string" && url.startsWith("https://") ? url : null;
}

/** Map a Paddle price ID (pri_…) back to a plan using the configured env prices (pure, testable). */
export function paddlePlanFromPriceId(
  priceId: string,
  map: Record<string, string> = env.paddle.prices
): PaidPlan | null {
  if (!priceId) return null;
  for (const [plan, id] of Object.entries(map)) {
    if (id && id === priceId && isPaidPlan(plan)) return plan as PaidPlan;
  }
  return null;
}

async function createPaddleCheckout(orgId: string, plan: PaidPlan): Promise<string> {
  const priceId = env.paddle.prices[plan];
  if (!priceId) {
    throw new Error(`PADDLE_PRICE_${plan} is not set — create the ${PLAN_PRICES[plan].label} monthly price in Paddle and paste its pri_… ID into env.`);
  }
  const res = await fetch(`${paddleApiBase()}/transactions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.paddle.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: [{ price_id: priceId, quantity: 1 }],
      custom_data: { orgId, plan },
      checkout: { url: `${env.appUrl}/app/billing?checkout=success` },
    }),
  });
  const body = (await res.json()) as { data?: unknown; error?: { detail?: string } };
  if (!res.ok) throw new Error(`Paddle ${res.status}: ${body.error?.detail ?? "request failed"}`);
  const url = paddleCheckoutUrlFromTransaction(body.data);
  if (!url) {
    throw new Error("Paddle returned no checkout URL — set a default payment link for your Paddle account (Paddle dashboard → checkout settings).");
  }
  return url;
}

/**
 * Verifies Paddle's signature scheme: `Paddle-Signature: ts=<unix>;h1=<hex>`
 * HMAC-SHA256 over `${ts}:${rawBody}` with the notification destination's
 * secret key, plus a 5-minute replay window (Paddle SDKs default to 5s; we
 * allow a wider window to tolerate delivery latency while staying replay-safe).
 */
export function verifyPaddleSignature(payload: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  let ts: string | undefined;
  const sigs: string[] = [];
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    const value = part.slice(eq + 1).trim();
    if (key === "ts") ts = value;
    else if (key === "h1" && value) sigs.push(value.toLowerCase());
  }
  if (!ts || sigs.length === 0) return false;

  const ageSec = Math.abs(Math.floor(Date.now() / 1000) - Number(ts));
  if (!Number.isFinite(ageSec) || ageSec > 300) return false; // replay protection

  const expected = createHmac("sha256", secret).update(`${ts}:${payload}`).digest("hex");
  try {
    return sigs.some((sig) => sig.length === expected.length && timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex")));
  } catch {
    return false;
  }
}

async function paddleOrgByProviderRef(refs: (string | undefined)[]): Promise<string | null> {
  const ids = refs.filter((r): r is string => Boolean(r));
  if (ids.length === 0) return null;
  const row = await prisma.subscription.findFirst({
    where: { provider: "PADDLE", providerRef: { in: ids } },
    select: { orgId: true },
  });
  return row?.orgId ?? null;
}

async function setPaddleSubscriptionStatus(orgId: string, status: "CANCELED" | "PAST_DUE") {
  try {
    await prisma.subscription.update({ where: { orgId }, data: { status } });
  } catch {
    logger.warn("paddle webhook: no subscription row to update", { orgId });
  }
}

type PaddleEventShape = {
  event_type?: string;
  data?: {
    id?: string;
    status?: string;
    subscription_id?: string;
    customer_id?: string;
    custom_data?: { orgId?: string; plan?: string };
    items?: { price?: { id?: string } }[];
  };
};

export async function handlePaddleEvent(payload: string, signature: string | null): Promise<{ handled: boolean; type?: string }> {
  if (env.paddle.webhookSecret && !verifyPaddleSignature(payload, signature, env.paddle.webhookSecret)) {
    throw new Error("Invalid Paddle signature");
  }
  const event = JSON.parse(payload) as PaddleEventShape;
  const type = event.event_type ?? "";
  const data = event.data ?? {};

  // Attribution: custom_data set on the transaction flows through checkout;
  // for later subscription events fall back to the stored providerRef, and
  // plan is additionally resolvable from the configured price IDs.
  const resolveOrg = async () => data.custom_data?.orgId ?? (await paddleOrgByProviderRef([data.id, data.subscription_id, data.customer_id]));
  const resolvePlan = (): PaidPlan | null => {
    if (data.custom_data?.plan && isPaidPlan(data.custom_data.plan)) return data.custom_data.plan as PaidPlan;
    for (const item of data.items ?? []) {
      const fromPrice = paddlePlanFromPriceId(item.price?.id ?? "");
      if (fromPrice) return fromPrice;
    }
    return null;
  };

  const { changePlan } = await import("./usage");

  if (type === "transaction.completed") {
    const orgId = await resolveOrg();
    const plan = resolvePlan();
    if (orgId && plan) {
      await changePlan(orgId, plan, { provider: "PADDLE", providerRef: data.subscription_id ?? data.customer_id ?? data.id });
      return { handled: true, type };
    }
    logger.warn("paddle webhook: unattributable transaction.completed", { id: data.id });
    return { handled: false, type };
  }

  if (type.startsWith("subscription.")) {
    const orgId = await resolveOrg();
    if (!orgId) {
      logger.warn("paddle webhook: unattributable subscription event", { type, id: data.id });
      return { handled: false, type };
    }
    if (type === "subscription.canceled") {
      await setPaddleSubscriptionStatus(orgId, "CANCELED");
      return { handled: true, type };
    }
    if (type === "subscription.past_due") {
      await setPaddleSubscriptionStatus(orgId, "PAST_DUE");
      return { handled: true, type };
    }
    // created / activated / resumed / updated → activate the plan it maps to.
    const plan = resolvePlan();
    if (plan) {
      await changePlan(orgId, plan, { provider: "PADDLE", providerRef: data.id ?? data.customer_id });
      return { handled: true, type };
    }
    return { handled: false, type };
  }

  return { handled: false, type };
}

// ─── Public entry points ──────────────────────────────────────────────────────

export async function createCheckoutSession(orgId: string, plan: PlanId): Promise<string> {
  if (plan === "FREE") return `${env.appUrl}/app/billing`;

  const provider = paymentProvider();
  if (provider === "paddle") {
    // Fail loudly on errors — never silently simulate a paid upgrade.
    return createPaddleCheckout(orgId, plan as PaidPlan);
  }
  if (provider === "stripe") {
    return createStripeCheckout(orgId, plan as PaidPlan);
  }

  // Self-hosted/demo: manual checkout activates immediately.
  return `${env.appUrl}/app/billing?checkout=simulated&plan=${plan}`;
}

// ─── Stripe webhooks ──────────────────────────────────────────────────────────

/**
 * Verifies Stripe's signature scheme: `stripe-signature: t=<ts>,v1=<hmac>`
 * over `${ts}.${payload}` with STRIPE_WEBHOOK_SECRET, with 5-minute replay
 * protection. Required whenever the webhook secret is configured.
 */
export function verifyStripeSignature(payload: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const parts = header.split(",").reduce<Record<string, string[]>>((acc, part) => {
    const [k, v] = part.split("=");
    if (!k || !v) return acc;
    (acc[k.trim()] ??= []).push(v.trim());
    return acc;
  }, {});
  const timestamp = parts.t?.[0];
  const signatures = parts.v1 ?? [];
  if (!timestamp || signatures.length === 0) return false;

  const ageSec = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(ageSec) || ageSec > 300) return false; // replay protection

  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  try {
    return signatures.some((sig) => timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex")));
  } catch {
    return false;
  }
}

export async function handleStripeEvent(payload: string, signature: string | null): Promise<{ handled: boolean; type?: string }> {
  if (env.stripe.webhookSecret && !verifyStripeSignature(payload, signature, env.stripe.webhookSecret)) {
    throw new Error("Invalid Stripe signature");
  }
  const event = JSON.parse(payload) as { type: string; data: { object: Record<string, unknown> } };
  if (event.type === "checkout.session.completed" || event.type === "customer.subscription.updated") {
    const obj = event.data.object as { client_reference_id?: string; metadata?: Record<string, string>; customer?: string };
    const orgId = obj.metadata?.orgId ?? obj.client_reference_id;
    const plan = (obj.metadata?.plan ?? "MAKER") as PlanId;
    if (orgId) {
      const { changePlan } = await import("./usage");
      await changePlan(orgId, plan, { provider: "STRIPE", providerRef: String(obj.customer ?? "") });
    }
    return { handled: true, type: event.type };
  }
  return { handled: false, type: event.type };
}

export { prisma as _billingPrisma };
