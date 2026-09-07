import { prisma } from "./db";
import { limitReached, LimitReached } from "./limitReached";
import { limitReached as limitReachedFunc, assertWithin } from "./limitReached";
import { getActiveBetaEntitlement, isBetaEntitlementActive } from "./betaEntitlement/betaEntitlement.service";

export type PlanId = "FREE" | "MAKER" | "GROWTH" | "PRO";
export type EntitlementId = "MAKER" | "GROWTH" | "PRO";

export type Plan = {
  name: PlanId;
  priceCents: number;
  limits: {
    products: number;
    seats: number;
    opportunitiesSurfaced: number;
    experiments: number;
    competitors: number;
    liveDiscovery: boolean;
    aiCreditsPerMonth: number;
  };
};

export const PLANS: Record<PlanId, Plan> = {
  FREE: {
    name: "FREE",
    priceCents: 0,
    limits: {
      products: 3,
      seats: 1,
      opportunitiesSurfaced: 5,
      experiments: 0,
      competitors: 0,
      liveDiscovery: false,
      aiCreditsPerMonth: 0,
    },
  },
  MAKER: {
    name: "MAKER",
    priceCents: 1500,
    limits: {
      products: 10,
      seats: 3,
      opportunitiesSurfaced: 15,
      experiments: 1,
      competitors: 1,
      liveDiscovery: true,
      aiCreditsPerMonth: 100,
    },
  },
  GROWTH: {
    name: "GROWTH",
    priceCents: 3900,
    limits: {
      products: 25,
      seats: 5,
      opportunitiesSurfaced: 25,
      experiments: 2,
      competitors: 5,
      liveDiscovery: true,
      aiCreditsPerMonth: 250,
    },
  },
  PRO: {
    name: "PRO",
    priceCents: 9900,
    limits: {
      products: 100,
      seats: 10,
      opportunitiesSurfaced: 50,
      experiments: 5,
      competitors: 10,
      liveDiscovery: true,
      aiCreditsPerMonth: 500,
    },
  },
};

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
    // Map the subscription plan to the corresponding Plan object
    switch (subscription.plan) {
      case "MAKER":
        return PLANS.MAKER;
      case "GROWTH":
        return PLANS.GROWTH;
      case "PRO":
        return PLANS.PRO;
      case "FREE":
        return PLANS.FREE;
      default:
        return PLANS.FREE;
    }
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
  const effectivePlanIndex = planOrder.indexOf(effectivePlan.name);
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
  
  if (current >= limit) {
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
  // For beta entitlement checks, we still return the actual plan price
  // The entitlement check happens at the feature level, not pricing level
  switch (planId) {
    case "MAKER": return PLANS.MAKER.priceCents;
    case "GROWTH": return PLANS.GROWTH.priceCents;
    case "PRO": return PLANS.PRO.priceCents;
    case "FREE": return PLANS.FREE.priceCents;
    default: return PLANS.FREE.priceCents;
  }
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
