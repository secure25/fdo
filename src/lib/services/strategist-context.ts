/**
 * Assembles the AI Strategist's live context from platform data (spec §17),
 * then answers questions — deterministic router, optional LLM streaming.
 */

import { prisma } from "../db";
import { answerStrategist, strategistSystemPrompt, type StrategistContext } from "../engines/strategist";
import { computeHealth } from "../engines/health";
import { getChannelFunnels } from "./analytics";
import { candidatesForArchetype } from "../engines/prospect";
import { jparse } from "../jsonfield";
import { tryAI } from "../ai/provider";
import { hasAI } from "../env";

export async function buildStrategistContext(orgId: string): Promise<StrategistContext> {
  const product = await prisma.product.findFirst({
    where: { orgId, isDefault: true },
    include: { analysis: true, channels: { orderBy: { rank: "asc" }, take: 3 }, icps: true, personas: true },
  }) ?? await prisma.product.findFirst({
    where: { orgId },
    include: { analysis: true, channels: { orderBy: { rank: "asc" }, take: 3 }, icps: true, personas: true },
  });

  const [newOpportunities, highIntent, urgent, partnerships] = await Promise.all([
    prisma.opportunity.count({ where: { orgId, status: "NEW" } }),
    prisma.opportunity.count({ where: { orgId, band: { in: ["HIGH", "VERY_HIGH"] }, status: "NEW" } }),
    prisma.opportunity.count({ where: { orgId, intentType: "URGENT_NEED", status: "NEW" } }),
    prisma.opportunity.count({ where: { orgId, isPartnerSignal: true, status: "NEW" } }),
  ]);

  const topOpportunities = await prisma.opportunity.findMany({
    where: { orgId, status: "NEW" },
    orderBy: { score: "desc" },
    take: 6,
    select: { id: true, title: true, platform: true, score: true, intentType: true, communityName: true },
  });

  const prospects = await prisma.prospect.findMany({
    where: { orgId, stage: { in: ["NEW", "CONTACTED"] } },
    orderBy: { icpFit: "desc" },
    take: 6,
    select: { id: true, name: true, company: true, icpFit: true, intentScore: true, stage: true },
  });

  const { channels } = await getChannelFunnels(orgId);

  const storedInsights = await prisma.learningInsight.findMany({ where: { orgId }, take: 5, orderBy: { confidence: "desc" } });
  const observations = await prisma.learningObservation.findMany({ where: { orgId }, take: 12, orderBy: { observedAt: "desc" } });
  const { deriveInsights } = await import("../engines/learning");
  const derived = deriveInsights(
    observations.map((o) => ({ channel: o.channel, topic: o.topic, format: o.format, icpTag: o.icpTag, metrics: jparse(o.metrics, {}) }))
  );

  const competitors = await prisma.competitor.findMany({
    where: { orgId },
    include: { events: { orderBy: { detectedAt: "desc" }, take: 1 } },
  });

  const experiments = await prisma.experiment.findMany({ where: { orgId }, take: 3, orderBy: { startedAt: "desc" }, include: { results: true } });

  // Health snapshot for the strategist
  const [signupCount, customerCount, contentPublished, prospectsContacted, prospectsTotal] = await Promise.all([
    prisma.customer.count({ where: { orgId, status: { in: ["SIGNUP", "ACTIVATED", "CUSTOMER"] } } }),
    prisma.customer.count({ where: { orgId, status: "CUSTOMER" } }),
    prisma.content.count({ where: { orgId, status: "PUBLISHED" } }),
    prisma.prospect.count({ where: { orgId, stage: { in: ["CONTACTED", "ENGAGED", "QUALIFIED", "CUSTOMER"] } } }),
    prisma.prospect.count({ where: { orgId } }),
  ]);
  const health = computeHealth({
    hasIcp: (product?.icps.length ?? 0) > 0,
    hasPersonas: (product?.personas.length ?? 0) > 0,
    keywordCount: product?.analysis ? (JSON.parse(product.analysis.keywords) as string[]).length : 0,
    topChannelOpportunity: product?.channels[0] ? product.channels[0].icpFit : 40,
    highIntentNew: highIntent,
    actedOnHighIntent: await prisma.opportunity.count({ where: { orgId, band: { in: ["HIGH", "VERY_HIGH"] }, status: { in: ["ACTED", "CONVERTED"] } } }),
    contentDrafts: 0,
    contentPublished,
    contentEngagements: 0,
    prospectsContacted,
    prospectsTotal,
    followUpsDue: 0,
    partnershipOpportunities: partnerships,
    partnershipsActed: 0,
    seoAssets: await prisma.content.count({ where: { orgId, channel: { in: ["SEO", "BLOG"] } } }),
    signupCount,
    customerCount,
    experimentsRunning: experiments.filter((e) => e.status === "RUNNING").length,
  });

  const analysis = product?.analysis;
  const archetypeId = analysis ? (JSON.parse(analysis.confidence) as { archetypeId?: string }).archetypeId ?? "generic" : "generic";
  const icpName = analysis ? (JSON.parse(analysis.confidence) as { icpName?: string }).icpName ?? analysis.category : "";
  const partners = candidatesForArchetype(archetypeId, icpName, analysis?.category ?? "").map((p) => ({
    name: p.name, type: p.type, potential: p.partnershipPotential, recommendedModel: p.recommendedModel,
  }));

  return {
    productName: product?.name ?? "your product",
    icpName: icpName || "your ICP",
    category: analysis?.category ?? "SaaS",
    healthScore: health.score,
    weakestArea: health.weakest.label,
    stats: { newOpportunities, highIntent, urgent, partnerships },
    topOpportunities: topOpportunities.map((o) => ({ id: o.id, title: o.title, platform: o.platform, score: o.score, intentType: o.intentType, community: o.communityName })),
    channelFunnels: channels.map((c) => ({ channel: c.channel, impressions: c.impressions, visits: c.visits, signups: c.signups, customers: c.customers, mrrCents: c.mrrCents })),
    channelRecommendations: (product?.channels ?? []).map((c) => ({ name: c.name, opportunity: c.opportunity, strategy: c.strategy, rank: c.rank })),
    prospects: prospects.map((p) => ({ id: p.id, name: p.name, company: p.company, icpFit: p.icpFit, intentScore: p.intentScore, stage: p.stage })),
    insights: [
      ...derived.insights.map((i) => ({ statement: i.statement, recommendation: i.recommendation, dimension: i.dimension })),
      ...storedInsights.map((i) => ({ statement: i.statement, recommendation: i.recommendation, dimension: i.dimension })),
    ],
    partners,
    competitors: competitors.map((c) => ({ name: c.name, events: c.events.length, latestEvent: c.events[0]?.title ?? null })),
    experiments: experiments.map((e) => {
      const totals = e.results.reduce(
        (acc, r) => {
          acc[r.channel] ??= { customers: 0, hours: 0 };
          acc[r.channel]!.customers += r.customers;
          acc[r.channel]!.hours += r.hoursInvested;
          return acc;
        },
        {} as Record<string, { customers: number; hours: number }>
      );
      const entries = Object.entries(totals).map(([ch, v]) => ({ ch, eff: v.hours > 0 ? v.customers / v.hours : 0 }));
      entries.sort((a, b) => b.eff - a.eff);
      const winner = entries[0];
      const loser = entries[1];
      return {
        name: e.name,
        status: e.status,
        winner: winner && winner.eff > 0 ? winner.ch : null,
        multiple: winner && loser && loser.eff > 0 ? Math.round((winner.eff / loser.eff) * 10) / 10 : null,
      };
    }),
  };
}

export function answer(question: string, ctx: StrategistContext): { text: string; actions: { label: string; href: string }[]; systemPrompt: string; hasAI: boolean } {
  return { ...answerStrategist(question, ctx), systemPrompt: strategistSystemPrompt(ctx), hasAI: hasAI() };
}

export { tryAI };
