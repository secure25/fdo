import { prisma } from "./db";
import { planOf, type PlanId } from "./entitlements";
import { limitReached } from "./errors";
import { logger } from "./logger";
import { jstr } from "./jsonfield";

/** Ensure an org always has a subscription row (defaults to FREE). */
export async function ensureSubscription(orgId: string) {
  const existing = await prisma.subscription.findUnique({ where: { orgId } });
  if (existing) return existing;
  return prisma.subscription.create({
    data: {
      orgId,
      plan: "FREE",
      status: "ACTIVE",
      seats: 1,
      creditsBalance: 200,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    },
  });
}

export async function getSubscription(orgId: string) {
  return ensureSubscription(orgId);
}

export async function changePlan(orgId: string, plan: PlanId, opts: { provider?: string; providerRef?: string } = {}) {
  await ensureSubscription(orgId);
  const p = planOf(plan);
  return prisma.subscription.update({
    where: { orgId },
    data: {
      plan,
      status: "ACTIVE",
      provider: opts.provider ?? "MANUAL",
      providerRef: opts.providerRef,
      seats: Math.max(1, p.limits.seats),
      creditsBalance: p.limits.aiCreditsPerMonth,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    },
  });
}

export async function addCredits(orgId: string, credits: number, providerRef?: string) {
  await ensureSubscription(orgId);
  return prisma.subscription.update({
    where: { orgId },
    data: { creditsBalance: { increment: credits } },
  });
}

/** Meter a usage event and deduct credits when the kind is metered. */
export async function meter(
  orgId: string,
  kind: "AI_CREDIT" | "DISCOVERY_SCAN" | "SEAT",
  amount = 1,
  meta?: Record<string, unknown>
) {
  await prisma.usageEvent.create({ data: { orgId, kind, amount, meta: meta ? jstr(meta) : null } });
  if (kind === "AI_CREDIT") {
    await prisma.subscription.updateMany({
      where: { orgId },
      data: { creditsBalance: { decrement: amount } },
    });
  }
}

/** Credits available this month (balance + plan grant resets). */
export async function creditsSummary(orgId: string) {
  const sub = await ensureSubscription(orgId);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const used = await prisma.usageEvent.aggregate({
    where: { orgId, kind: "AI_CREDIT", createdAt: { gte: startOfMonth } },
    _sum: { amount: true },
  });
  const plan = planOf(sub.plan);
  return {
    plan: sub.plan as PlanId,
    balance: Math.max(0, sub.creditsBalance),
    usedThisMonth: used._sum.amount ?? 0,
    monthlyGrant: plan.limits.aiCreditsPerMonth,
  };
}

/** Spend AI credits or throw a paywall error. */
export async function spendCredits(orgId: string, amount: number, meta?: Record<string, unknown>) {
  const sub = await ensureSubscription(orgId);
  if (sub.creditsBalance < amount) {
    logger.warn("credit spend rejected", { orgId, amount, balance: sub.creditsBalance });
    throw limitReached(
      "AI credits exhausted for this billing period. Upgrade your plan or buy a credit pack.",
      { balance: sub.creditsBalance, needed: amount }
    );
  }
  await meter(orgId, "AI_CREDIT", amount, meta);
}
