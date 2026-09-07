/**
 * Product service — the create/analyze pipeline (spec §2 + §18).
 * Creating a product runs: Product Analyst → ICPs → Personas → Distribution
 * Map → Community links → Competitors → initial discovery scan (sandbox + live).
 */

import { prisma } from "../db";
import { analyzeProduct, type ProductInput, type ProductIntelligence } from "../engines/product-analyst";
import { buildDistributionMap } from "../engines/distribution-map";
import { ARCHETYPES, COMMUNITIES } from "../engines/taxonomy";
import { jstr } from "../jsonfield";
import { assertWithin, planOf } from "../entitlements";
import { enqueueJob } from "../jobs/queue";
import { generateSandboxCandidates } from "../discovery/sandbox-templates";
import { runPipeline, communityMapFor } from "../discovery/orchestrator";

export async function createProduct(orgId: string, input: ProductInput) {
  const sub = await prisma.subscription.findUnique({ where: { orgId } });
  const plan = planOf(sub?.plan);
  const count = await prisma.product.count({ where: { orgId } });
  assertWithin(plan.limits.products, count, "Products");

  const isFirst = count === 0;
  const product = await prisma.product.create({
    data: {
      orgId,
      name: input.name,
      url: input.url || null,
      description: input.description,
      targetCustomer: input.targetCustomer || null,
      industry: input.industry || null,
      geography: input.geography || null,
      budgetBand: input.budgetBand || null,
      timePerWeek: input.timePerWeek ?? null,
      isDefault: isFirst,
    },
  });

  const intel = await analyzeProduct({
    name: input.name,
    url: input.url || null,
    description: input.description,
    targetCustomer: input.targetCustomer || null,
    industry: input.industry || null,
    geography: input.geography || null,
    budgetBand: input.budgetBand || null,
    timePerWeek: input.timePerWeek ?? null,
  });

  await persistIntelligence(product.id, orgId, intel, input);
  return { product, intel };
}

export async function persistIntelligence(
  productId: string,
  orgId: string,
  intel: ProductIntelligence,
  input: ProductInput
) {
  await prisma.productAnalysis.upsert({
    where: { productId },
    update: {
      category: intel.category,
      oneLiner: intel.oneLiner,
      positioning: intel.positioning,
      problems: jstr(intel.problems),
      useCases: jstr(intel.useCases),
      keywords: jstr(intel.keywords),
      buyingTriggers: jstr(intel.buyingTriggers),
      objections: jstr(intel.objections),
      model: intel.model,
      confidence: jstr({ ...intel.confidence, icpName: intel.icp.name, archetypeId: intel.archetypeId }),
      generatedAt: new Date(),
    },
    create: {
      productId,
      category: intel.category,
      oneLiner: intel.oneLiner,
      positioning: intel.positioning,
      problems: jstr(intel.problems),
      useCases: jstr(intel.useCases),
      keywords: jstr(intel.keywords),
      buyingTriggers: jstr(intel.buyingTriggers),
      objections: jstr(intel.objections),
      model: intel.model,
      confidence: jstr({ ...intel.confidence, icpName: intel.icp.name, archetypeId: intel.archetypeId }),
    },
  });

  // ICPs + personas (replace)
  await prisma.icp.deleteMany({ where: { productId } });
  await prisma.icp.create({
    data: {
      productId,
      name: intel.icp.name,
      description: intel.icp.description,
      buyerRole: intel.icp.buyerRole,
      seniority: intel.icp.seniority,
      companySize: intel.icp.companySize,
      geography: intel.icp.geography,
    },
  });

  await prisma.persona.deleteMany({ where: { productId } });
  for (const p of intel.personas) {
    await prisma.persona.create({
      data: {
        productId,
        name: p.name,
        role: p.role,
        quote: p.quote,
        goals: jstr(p.goals),
        pains: jstr(p.pains),
        wateringHoles: jstr(p.wateringHoles),
      },
    });
  }

  // Distribution map
  const map = buildDistributionMap(intel, { budgetBand: input.budgetBand, timePerWeek: input.timePerWeek });
  await prisma.channelScore.deleteMany({ where: { productId } });
  for (const c of map) {
    await prisma.channelScore.create({
      data: {
        productId,
        group: c.group,
        name: c.name,
        url: c.url ?? null,
        icpFit: c.icpFit,
        intentDensity: c.intentDensity,
        competition: c.competition,
        effort: c.effort,
        expectedConversion: c.expectedConversion,
        opportunity: c.opportunity,
        strategy: c.strategy,
        rank: c.rank,
      },
    });
  }

  // Community links based on archetype
  const arch = ARCHETYPES.find((a) => a.id === intel.archetypeId);
  await prisma.productCommunity.deleteMany({ where: { productId } });
  const allCommunities = await prisma.community.findMany();
  const byName = new Map(allCommunities.map((c) => [c.name, c]));
  let fit = 95;
  for (const key of arch?.communityKeys ?? []) {
    const community = byName.get(COMMUNITIES.find((c) => c.key === key)?.name ?? key);
    if (!community) continue;
    await prisma.productCommunity.upsert({
      where: { productId_communityId: { productId, communityId: community.id } },
      update: { fit },
      create: { productId, communityId: community.id, fit },
    });
    fit = Math.max(55, fit - 4);
  }

  // Competitor watchlist (from archetype + user-supplied). Names are unique per
  // org — a second product suggesting an already-watched name must skip, not crash.
  const existing = await prisma.competitor.findMany({ where: { orgId } });
  const existingNames = new Set(existing.map((c) => c.name.toLowerCase()));
  for (const comp of intel.competitors) {
    if (existingNames.has(comp.name.toLowerCase())) continue;
    await prisma.competitor
      .create({
        data: { orgId, productId, name: comp.name, url: comp.url === "#" ? null : comp.url, positioning: comp.positioning, monitor: true },
      })
      .catch(() => undefined); // P2002 race guard
    existingNames.add(comp.name.toLowerCase());
  }
}

/** Run an initial sandbox scan so a new workspace isn't empty, then schedule live scans. */
export async function runInitialDiscovery(orgId: string, productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId }, include: { analysis: true } });
  if (!product?.analysis) return { inserted: 0 };

  const confidence = JSON.parse(product.analysis.confidence) as { icpName?: string; archetypeId?: string };
  const archetypeId = confidence.archetypeId ?? "generic";
  const communityIds = await communityMapFor(orgId, productId);

  const candidates = generateSandboxCandidates(archetypeId, {
    productName: product.name,
    icpName: confidence.icpName ?? product.analysis.category,
    keywords: JSON.parse(product.analysis.keywords) as string[],
  });

  const outcome = await runPipeline(candidates, {
    orgId,
    productId,
    productName: product.name,
    category: product.analysis.category,
    icpName: confidence.icpName ?? product.analysis.category,
    keywords: JSON.parse(product.analysis.keywords) as string[],
    problems: JSON.parse(product.analysis.problems) as string[],
    communityIds,
  });

  // Schedule the first live scan (respects plan gating inside the handler).
  await enqueueJob("DISCOVERY_SCAN", orgId, { orgId, productId, live: true }, { runAt: new Date(Date.now() + 20_000), priority: 60 });
  await enqueueJob("COMPETITOR_WATCH", orgId, { orgId, productId }, { runAt: new Date(Date.now() + 90_000), priority: 80 });
  return outcome;
}
