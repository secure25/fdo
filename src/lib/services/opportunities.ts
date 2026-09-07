/**
 * Opportunity service — the central feed (spec §6) with plan-aware surfacing.
 */

import { prisma } from "../db";
import { notFound, forbidden } from "../errors";
import { spendCredits } from "../usage";
import { generateDraft, type ContentWarning } from "../engines/content-engine";
import { jparse, jstr } from "../jsonfield";

export type OpportunityDTO = ReturnType<typeof toDTO>;

export function toDTO(o: {
  id: string; platform: string; communityName: string | null; title: string; body: string; author: string | null;
  authorUrl: string | null; url: string | null; postedAt: Date; ageHours: number; score: number; band: string;
  intentType: string; effortMinutes: number; status: string; explanation: string; matchedPhrases: string;
  subIcp: number; subProblem: number; subIntent: number; subRecency: number; subCompetition: number; subEngagement: number;
  isLive: boolean; competitorName: string | null; isPartnerSignal: boolean;
  signals?: { kind: string; phrase: string; weight: number }[];
}) {
  return {
    id: o.id,
    platform: o.platform,
    community: o.communityName,
    title: o.title,
    body: o.body,
    author: o.author,
    authorUrl: o.authorUrl,
    url: o.url,
    postedAt: o.postedAt.toISOString(),
    ageHours: o.ageHours,
    score: o.score,
    band: o.band,
    intentType: o.intentType,
    effortMinutes: o.effortMinutes,
    status: o.status,
    explanation: jparse(o.explanation, { what: "", whyMatters: [], whyYou: [], nextAction: "" }),
    matchedPhrases: jparse<string[]>(o.matchedPhrases, []),
    subs: { icp: o.subIcp, problem: o.subProblem, intent: o.subIntent, recency: o.subRecency, competition: o.subCompetition, engagement: o.subEngagement },
    isLive: o.isLive,
    competitorName: o.competitorName,
    isPartnerSignal: o.isPartnerSignal,
    signals: (o.signals ?? []).map((s) => ({ kind: s.kind, phrase: s.phrase, weight: s.weight })),
  };
}

export async function listOpportunities(
  orgId: string,
  filters: { band?: string[]; status?: string[]; intent?: string[]; q?: string; productId?: string; limit?: number } = {}
) {
  const where = {
    orgId,
    ...(filters.productId ? { productId: filters.productId } : {}),
    ...(filters.band?.length ? { band: { in: filters.band } } : {}),
    ...(filters.status?.length ? { status: { in: filters.status } } : {}),
    ...(filters.intent?.length ? { intentType: { in: filters.intent } } : {}),
    ...(filters.q ? { OR: [{ title: { contains: filters.q } }, { body: { contains: filters.q } }] } : {}),
  };
  const rows = await prisma.opportunity.findMany({
    where,
    orderBy: [{ score: "desc" }, { postedAt: "desc" }],
    take: Math.min(120, filters.limit ?? 60),
    include: { signals: true },
  });
  return rows.map(toDTO);
}

export async function getOpportunity(orgId: string, id: string) {
  const row = await prisma.opportunity.findFirst({ where: { id, orgId }, include: { signals: true, contents: true } });
  if (!row) throw notFound("Opportunity not found");
  return { ...toDTO(row), contents: row.contents.map((c) => ({ id: c.id, title: c.title, body: c.body, status: c.status, channel: c.channel })) };
}

export async function setOpportunityStatus(orgId: string, id: string, status: string) {
  const row = await prisma.opportunity.findFirst({ where: { id, orgId } });
  if (!row) throw notFound("Opportunity not found");
  return prisma.opportunity.update({ where: { id }, data: { status } });
}

export async function generateResponseFor(
  orgId: string,
  productId: string | null,
  opportunityId: string
): Promise<{ contentId: string; title: string; body: string; spamRisk: number; warnings: ContentWarning[]; model: string }> {
  const opp = await prisma.opportunity.findFirst({ where: { id: opportunityId, orgId } });
  if (!opp) throw notFound("Opportunity not found");

  const product = productId
    ? await prisma.product.findUnique({ where: { id: productId }, include: { analysis: true } })
    : await prisma.product.findFirst({ where: { orgId, isDefault: true }, include: { analysis: true } });
  if (!product?.analysis) throw notFound("No product with analysis found");

  const pitchAllowed = ["ACTIVE_BUYING", "VENDOR_COMPARISON", "RECOMMENDATION_REQUEST", "URGENT_NEED", "COMPETITOR_DISSATISFACTION", "PARTNERSHIP_OPPORTUNITY"].includes(opp.intentType);

  const channel = opp.platform === "LINKEDIN" ? "LINKEDIN" : opp.platform === "HACKERNEWS" ? "BLOG" : "REDDIT";
  const draft = await generateDraft({
    channel,
    format: channel === "LINKEDIN" ? "COMMENT" : "REPLY",
    opportunity: {
      title: opp.title,
      body: opp.body,
      platform: opp.platform,
      communityName: opp.communityName,
      author: opp.author,
      intentType: opp.intentType,
      competitorName: opp.competitorName,
    },
    product: {
      name: product.name,
      url: product.url,
      oneLiner: product.analysis.oneLiner,
      problems: jparse<string[]>(product.analysis.problems, []),
      keywords: jparse<string[]>(product.analysis.keywords, []),
      icpName: (JSON.parse(product.analysis.confidence) as { icpName?: string }).icpName ?? product.analysis.category,
      category: product.analysis.category,
    },
    pitchAllowed,
  });

  await spendCredits(orgId, 2, { kind: "draft", opportunityId });

  const content = await prisma.content.create({
    data: {
      orgId,
      productId: product.id,
      channel,
      format: channel === "LINKEDIN" ? "COMMENT" : "REPLY",
      title: draft.title.slice(0, 200),
      body: draft.body,
      opportunityId: opp.id,
      spamRisk: draft.spamRisk,
      warnings: jstr(draft.warnings),
    },
  });

  // If the draft is blocked from pitching, downgrade the suggested action in the explanation.
  if (!pitchAllowed && opp.score >= 85) {
    await prisma.opportunity.update({
      where: { id: opp.id },
      data: { status: opp.status === "NEW" ? "SAVED" : opp.status },
    });
  }

  return { contentId: content.id, title: draft.title, body: draft.body, spamRisk: draft.spamRisk, warnings: draft.warnings, model: draft.model };
}

export async function feedStats(orgId: string) {
  const [newCount, highIntent, urgent, partnerships, actedHighIntent] = await Promise.all([
    prisma.opportunity.count({ where: { orgId, status: "NEW" } }),
    prisma.opportunity.count({ where: { orgId, band: { in: ["HIGH", "VERY_HIGH"] }, status: "NEW" } }),
    prisma.opportunity.count({ where: { orgId, intentType: "URGENT_NEED", status: "NEW" } }),
    prisma.opportunity.count({ where: { orgId, isPartnerSignal: true, status: "NEW" } }),
    prisma.opportunity.count({ where: { orgId, band: { in: ["HIGH", "VERY_HIGH"] }, status: { in: ["ACTED", "CONVERTED"] } } }),
  ]);
  return { newCount, highIntent, urgent, partnerships, actedHighIntent };
}

export { forbidden };
