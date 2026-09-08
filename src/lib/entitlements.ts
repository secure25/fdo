import { prisma } from "./db";
import { AppError, limitReached } from "./errors";
import { isBetaEntitlementActive } from "./betaEntitlement/betaEntitlement.service";

export type PlanId = "FREE" | "MAKER" | "GROWTH" | "PRO";
export type EntitlementId = "MAKER" | "GROWTH" | "PRO";

export type Plan = {
  id: PlanId;
  name: string;
  priceCents: number;
  tagline: string;
  limits: {
    products: number;
    opportunitiesSurfaced: number; // per scan day
    aiCreditsPerMonth: number;
    seats: number;
    experiments: number;
    competitors: number;
    liveDiscovery: boolean;
    api: boolean;
    automation: boolean;
    crm: boolean;
  };
  features: string[];
  cta: string;
};

export const PLANS: Record<PlanId, Plan> = {
  FREE: {
    id: "FREE",
    name: "Free",
    priceCents: 0,
    tagline: "Validate the loop on one product.",
    limits: {
      products: 1,
      opportunitiesSurfaced: 15,
      aiCreditsPerMonth: 50,
      seats: 1,
      experiments: 1,
      competitors: 1,
      liveDiscovery: false,
      api: false,
      automation: false,
      crm: false,
    },
    features: ["1 product", "Basic intelligence", "Limited opportunities", "Basic strategist"],
    cta: "Start free",
  },
  MAKER: {
    id: "MAKER",
    name: "Maker",
    priceCents: 1500,
    tagline: "For solo founders hunting their first 100 customers.",
    limits: {
      products: 2,
      opportunitiesSurfaced: 60,
      aiCreditsPerMonth: 500,
      seats: 1,
      experiments: 3,
      competitors: 3,
      liveDiscovery: true,
      api: false,
      automation: false,
      crm: false,
    },
    features: [
      "Expanded discovery",
      "Intent detection",
      "Opportunity scoring",
      "AI content drafts",
      "Basic analytics",
    ],
    cta: "Get Maker",
  },
  GROWTH: {
    id: "GROWTH",
    name: "Growth",
    priceCents: 3900,
    tagline: "For teams running distribution as a system.",
    limits: {
      products: 5,
      opportunitiesSurfaced: 200,
      aiCreditsPerMonth: 2000,
      seats: 3,
      experiments: 10,
      competitors: 10,
      liveDiscovery: true,
      api: false,
      automation: true,
      crm: false,
    },
    features: [
      "Multiple products",
      "Prospect intelligence",
      "Experiments",
      "Competitor monitoring",
      "Advanced analytics",
    ],
    cta: "Get Growth",
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    priceCents: 9900,
    tagline: "The full distribution department, automated.",
    limits: {
      products: 25,
      opportunitiesSurfaced: 1000,
      aiCreditsPerMonth: 10000,
      seats: 10,
      experiments: 50,
      competitors: 50,
      liveDiscovery: true,
      api: true,
      automation: true,
      crm: true,
    },
    features: [
      "Advanced discovery",
      "Teams",
      "API access",
      "Automation",
      "Advanced learning",
      "CRM integrations",
    ],
    cta: "Get Pro",
  },
};

export const PLAN_ORDER: PlanId[] = ["FREE", "MAKER", "GROWTH", "PRO"];

export function planOf(planId: string | null | undefined): Plan {
  return PLANS[(planId as PlanId) ?? "FREE"] ?? PLANS.FREE;
}

export function creditPackPriceCents(credits: number): number {
  // Usage-based credits: $1 per 20 AI credits, sold in packs.
  return Math.round((credits / 20) * 100);
}

export function assertWithin(limit: number, current: number, label: string) {
  if (current >= limit) {
    throw new LimitReached(label, limit, current);
  }
}

export class LimitReached extends AppError {
  constructor(
    public label: string,
    public limit: number,
    public current: number
  ) {
    // 402 Payment Required: the message tells the user exactly which plan
    // limit they hit, and the UI surfaces it instead of a generic 500.
    super("PLAN_LIMIT", `${label} limit reached (${current}/${limit}) on your plan.`, 402, { label, limit, current });
  }
}

/**
 * Resolves the effective plan for an organization, considering:
 * 1. Active paid subscription (highest priority)
 * 2. Active beta entitlement (second priority)
 * 3. Free plan (fallback)
 */
export async function resolveEffectivePlan(orgId: string): Promise<Plan> {
  // 1. Check for active paid subscription
  const subscription = await prisma.subscription.findUnique({
    where: { orgId },
  });

  if (subscription && subscription.status === "ACTIVE") {
    return planOf(subscription.plan);
  }

  // 2. Check for active beta entitlement
  const isBetaActive = await isBetaEntitlementActive(orgId);
  if (isBetaActive) {
    // Beta entitlement grants PRO plan features
    return PLANS.PRO;
  }

  // 3. Fall back to free plan
  return PLANS.FREE;
}

/**
 * Checks if the organization has access to a specific plan or higher.
 * @param orgId The organization ID
 * @param planId The plan ID to check access for
 * @returns True if the organization has access to the plan or higher
 */
export async function hasPlanAccess(orgId: string, planId: PlanId): Promise<boolean> {
  const effectivePlan = await resolveEffectivePlan(orgId);
  const planOrder: PlanId[] = ["FREE", "MAKER", "GROWTH", "PRO"];
  const effectivePlanIndex = planOrder.indexOf(effectivePlan.id);
  const requiredPlanIndex = planOrder.indexOf(planId);
  
  return effectivePlanIndex >= requiredPlanIndex;
}

/**
 * Checks if the organization has exceeded a specific limit.
 * @param orgId The organization ID
 * @param limitName The name of the limit to check
 * @param current The current value
 * @returns True if the limit has been exceeded
 */
export async function assertLimit(orgId: string, limitName: keyof Plan["limits"], current: number): Promise<void> {
  const effectivePlan = await resolveEffectivePlan(orgId);
  const limit = effectivePlan.limits[limitName];
  
  if (typeof limit === "number" && current >= limit) {
    throw new LimitReached(limitName, limit, current);
  }
}

/**
 * Wrapper for the existing assertWithin function to use our plan resolution
 * @param orgId The organization ID
 * @param limitName The name of the limit to check
 * @param current The current value
 */
export async function assertWithinPlan(orgId: string, limitName: keyof Plan["limits"], current: number): Promise<void> {
  await assertLimit(orgId, limitName, current);
}

/**
 * Gets the price in cents for a plan, considering effective plan resolution
 * @param orgId The organization ID
 * @param planId The plan ID
 * @returns The price in cents
 */
export async function getPlanPriceCents(orgId: string, planId: PlanId): Promise<number> {
  return planOf(planId).priceCents;
}

/**
 * Checks if beta entitlement is active for an organization
 * @param orgId The organization ID
 * @returns True if beta entitlement is active
 */
export async function isBetaActive(orgId: string): Promise<boolean> {
  return await isBetaEntitlementActive(orgId);
}

export { limitReached };
