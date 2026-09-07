/**
 * Dashboard service — assembles the Founder Command Center (spec §11) and
 * Distribution Health (spec §12) from live data.
 */

import { prisma } from "../db";
import { computeHealth, type HealthResult } from "../engines/health";
import { buildPriorities, focusMessage, greetingFor, type DailyBriefing } from "../engines/priorities";
import { feedStats } from "./opportunities";
import { startOfToday } from "../utils";

export async function getOverview(orgId: string): Promise<{
  briefing: DailyBriefing;
  health: HealthResult;
  productName: string | null;
}> {
  const product = await prisma.product.findFirst({
    where: { orgId, isDefault: true },
    include: { analysis: true, channels: { orderBy: { rank: "asc" }, take: 1 }, icps: true, personas: true },
  });
  const fallbackProduct = product ?? (await prisma.product.findFirst({ where: { orgId }, include: { analysis: true, channels: { orderBy: { rank: "asc" }, take: 1 }, icps: true, personas: true } }));

  const stats = await feedStats(orgId);

  const topReplyTargets = await prisma.opportunity.findMany({
    where: { orgId, status: "NEW", band: { in: ["HIGH", "VERY_HIGH"] }, intentType: { not: "PARTNERSHIP_OPPORTUNITY" } },
    orderBy: { score: "desc" },
    take: 3,
  });

  const contactTargets = await prisma.prospect.findMany({
    where: { orgId, stage: "NEW" },
    orderBy: [{ icpFit: "desc" }, { intentScore: "desc" }],
    take: 5,
  });

  const followUps = await prisma.prospect.findMany({
    where: { orgId, stage: { in: ["CONTACTED", "ENGAGED"] } },
    take: 6,
  });

  const readyDrafts = await prisma.content.findMany({
    where: { orgId, status: "APPROVED" },
    orderBy: { updatedAt: "desc" },
    take: 3,
  });

  const partnershipOpportunities = await prisma.opportunity.count({ where: { orgId, isPartnerSignal: true } });
  const partnershipsActed = await prisma.campaignAction.count({ where: { campaign: { orgId }, type: "PARTNER", status: "DONE" } });

  const contentPublished = await prisma.content.count({ where: { orgId, status: "PUBLISHED" } });
  const contentDrafts = await prisma.content.count({ where: { orgId, status: { in: ["DRAFT", "APPROVED"] } } });
  const contents = await prisma.content.findMany({ where: { orgId, status: "PUBLISHED" }, select: { metrics: true } });
  const contentEngagements = contents.reduce((s, c) => {
    const m = JSON.parse(c.metrics ?? "{}") as { engagements?: number };
    return s + (m.engagements ?? 0);
  }, 0);

  const seoAssets = await prisma.content.count({ where: { orgId, channel: { in: ["SEO", "BLOG"] }, status: { in: ["APPROVED", "PUBLISHED"] } } });
  const prospectsTotal = await prisma.prospect.count({ where: { orgId } });
  const prospectsContacted = await prisma.prospect.count({ where: { orgId, stage: { in: ["CONTACTED", "ENGAGED", "QUALIFIED", "CUSTOMER"] } } });
  const followUpsDue = followUps.length;
  const signupCount = await prisma.customer.count({ where: { orgId, status: { in: ["SIGNUP", "ACTIVATED", "CUSTOMER"] } } });
  const customerCount = await prisma.customer.count({ where: { orgId, status: "CUSTOMER" } });
  const experimentsRunning = await prisma.experiment.count({ where: { orgId, status: "RUNNING" } });

  const health = computeHealth({
    hasIcp: (fallbackProduct?.icps.length ?? 0) > 0,
    hasPersonas: (fallbackProduct?.personas.length ?? 0) > 0,
    keywordCount: fallbackProduct?.analysis ? (JSON.parse(fallbackProduct.analysis.keywords) as string[]).length : 0,
    topChannelOpportunity: fallbackProduct?.channels[0]
      ? Math.round(0.35 * fallbackProduct.channels[0].icpFit + 0.3 * fallbackProduct.channels[0].intentDensity + 0.2 * fallbackProduct.channels[0].expectedConversion + 0.15 * (100 - fallbackProduct.channels[0].competition))
      : 40,
    highIntentNew: stats.highIntent,
    actedOnHighIntent: stats.actedHighIntent,
    contentDrafts,
    contentPublished,
    contentEngagements,
    prospectsContacted,
    prospectsTotal,
    followUpsDue,
    partnershipOpportunities,
    partnershipsActed,
    seoAssets,
    signupCount,
    customerCount,
    experimentsRunning,
  });

  const { priorities, totalMinutes } = buildPriorities({
    topReplyTargets: topReplyTargets.map((o) => ({
      id: o.id, title: o.title, platform: o.platform, communityName: o.communityName, score: o.score, effortMinutes: o.effortMinutes, band: o.band,
    })),
    contactTargets: contactTargets.map((p) => ({ id: p.id, name: p.name, company: p.company, icpFit: p.icpFit, intentScore: p.intentScore })),
    followUps: followUps.map((p) => ({ id: p.id, name: p.name, company: p.company, stage: p.stage })),
    readyDrafts: readyDrafts.map((c) => ({ id: c.id, title: c.title, channel: c.channel })),
    partnershipTargets: [],
    stats: { newOpportunities: stats.newCount, highIntent: stats.highIntent, urgent: stats.urgent, partnerships: stats.partnerships, readyDrafts: readyDrafts.length },
  });

  const briefing: DailyBriefing = {
    greeting: greetingFor(),
    headline: `${stats.newCount} new opportunit${stats.newCount === 1 ? "y" : "ies"} · ${stats.highIntent} high intent · ${stats.urgent} urgent · ${stats.partnerships} partnership${stats.partnerships === 1 ? "" : "s"}`,
    stats: { newOpportunities: stats.newCount, highIntent: stats.highIntent, urgent: stats.urgent, partnerships: stats.partnerships, readyDrafts: readyDrafts.length },
    priorities,
    totalMinutes,
    focusMessage: focusMessage(
      { newOpportunities: stats.newCount, highIntent: stats.highIntent, urgent: stats.urgent, partnerships: stats.partnerships, readyDrafts: readyDrafts.length },
      totalMinutes
    ),
  };

  return { briefing, health, productName: fallbackProduct?.name ?? null };
}

export async function recentActivity(orgId: string, limit = 8) {
  const [recentOpps, recentContent, recentEvents] = await Promise.all([
    prisma.opportunity.findMany({ where: { orgId, score: { gte: 45 } }, orderBy: { createdAt: "desc" }, take: limit, select: { id: true, title: true, score: true, band: true, createdAt: true, status: true } }),
    prisma.content.findMany({ where: { orgId }, orderBy: { updatedAt: "desc" }, take: limit, select: { id: true, title: true, status: true, channel: true, updatedAt: true } }),
    prisma.competitorEvent.findMany({ where: { orgId }, orderBy: { detectedAt: "desc" }, take: limit, include: { competitor: { select: { name: true } } } }),
  ]);
  return { recentOpps, recentContent, recentEvents: recentEvents.map((e) => ({ id: e.id, competitor: e.competitor.name, title: e.title, severity: e.severity, detectedAt: e.detectedAt })) };
}

export { startOfToday };
