/**
 * Prospects, distribution map, partnerships, content, campaigns, experiments
 * and competitors — mutation + query services for the app pages.
 */

import { prisma } from "../db";
import { notFound, limitReached } from "../errors";
import { assertWithin, resolveEffectivePlan } from "../entitlements";
import { candidatesForArchetype } from "../engines/prospect";
import { analyzeEvent, type CompetitorEventKind } from "../engines/competitor";
import { enqueueJob } from "../jobs/queue";
import { jparse } from "../jsonfield";

// ─── Prospects (spec §7) ──────────────────────────────────────────────────────

export async function listProspects(orgId: string, filters: { stage?: string[]; q?: string } = {}) {
  return prisma.prospect.findMany({
    where: {
      orgId,
      ...(filters.stage?.length ? { stage: { in: filters.stage } } : {}),
      ...(filters.q ? { OR: [{ name: { contains: filters.q } }, { company: { contains: filters.q } }] } : {}),
    },
    orderBy: [{ icpFit: "desc" }, { intentScore: "desc" }],
    take: 100,
    include: { sourceOpportunity: { select: { title: true, url: true, communityName: true } } },
  });
}

export async function updateProspect(orgId: string, id: string, data: { stage?: string; notes?: string; company?: string; role?: string }) {
  const existing = await prisma.prospect.findFirst({ where: { id, orgId } });
  if (!existing) throw notFound("Prospect not found");
  return prisma.prospect.update({ where: { id }, data });
}

// ─── Distribution map + partnerships (spec §3/§8) ─────────────────────────────

export async function getDistributionMap(orgId: string, productId: string | null) {
  const product = productId
    ? await prisma.product.findUnique({ where: { id: productId } })
    : await prisma.product.findFirst({ where: { orgId, isDefault: true } });
  if (!product) return { product: null, channels: [], communities: [], partners: [] };

  const [channels, productCommunities, analysis] = await Promise.all([
    prisma.channelScore.findMany({ where: { productId: product.id }, orderBy: { rank: "asc" } }),
    prisma.productCommunity.findMany({ where: { productId: product.id }, include: { community: true } }),
    prisma.productAnalysis.findUnique({ where: { productId: product.id } }),
  ]);

  const archetypeId = analysis ? (JSON.parse(analysis.confidence) as { archetypeId?: string }).archetypeId ?? "generic" : "generic";
  const icpName = analysis ? (JSON.parse(analysis.confidence) as { icpName?: string }).icpName ?? analysis.category : "";
  const partners = candidatesForArchetype(archetypeId, icpName, analysis?.category ?? "");

  return {
    product: { id: product.id, name: product.name },
    channels,
    communities: productCommunities.map((pc) => ({
      id: pc.community.id,
      platform: pc.community.platform,
      name: pc.community.name,
      url: pc.community.url,
      focus: pc.community.focus,
      memberEstimate: pc.community.memberEstimate,
      rules: jparse<string[]>(pc.community.rules, []),
      fit: pc.fit,
    })),
    partners,
  };
}

// ─── Content (spec §9/§10) ────────────────────────────────────────────────────

export async function listContent(orgId: string, filters: { status?: string[]; channel?: string } = {}) {
  return prisma.content.findMany({
    where: {
      orgId,
      ...(filters.status?.length ? { status: { in: filters.status } } : {}),
      ...(filters.channel ? { channel: filters.channel } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 80,
    include: { opportunity: { select: { title: true, communityName: true, platform: true } } },
  });
}

export async function updateContent(
  orgId: string,
  id: string,
  action: "approve" | "publish" | "archive" | "edit",
  data: { title?: string; body?: string; url?: string; metrics?: Record<string, number> }
) {
  const existing = await prisma.content.findFirst({ where: { id, orgId } });
  if (!existing) throw notFound("Content not found");
  if (action === "edit") {
    return prisma.content.update({ where: { id }, data: { title: data.title ?? existing.title, body: data.body ?? existing.body } });
  }
  if (action === "approve") return prisma.content.update({ where: { id }, data: { status: "APPROVED" } });
  if (action === "archive") return prisma.content.update({ where: { id }, data: { status: "ARCHIVED" } });
  // publish: mark published + record a learning observation
  const metrics = data.metrics ?? {};
  const existingWithOpp = await prisma.content.findFirst({
    where: { id, orgId },
    include: { opportunity: { select: { title: true } } },
  });
  const updated = await prisma.content.update({
    where: { id },
    data: { status: "PUBLISHED", publishedAt: new Date(), url: data.url ?? existing.url, metrics: JSON.stringify(metrics) },
  });
  const product = existing.productId
    ? await prisma.product.findUnique({ where: { id: existing.productId }, include: { analysis: true } })
    : null;
  await prisma.learningObservation.create({
    data: {
      orgId,
      productId: existing.productId,
      subjectType: "CONTENT",
      subjectRef: id,
      channel: existing.channel,
      topic: existingWithOpp?.opportunity?.title?.slice(0, 60) ?? product?.analysis?.category ?? existing.title,
      format: existing.format,
      icpTag: product?.analysis ? (JSON.parse(product.analysis.confidence) as { icpName?: string }).icpName ?? null : null,
      metrics: JSON.stringify(metrics),
      result: resultBandClient(metrics),
    },
  });
  return updated;
}

function resultBandClient(m: Record<string, number>): "HIGH" | "MEDIUM" | "LOW" {
  const score = (m.customers ?? 0) * 40 + (m.signups ?? 0) * 6 + (m.clicks ?? 0) * 0.5 + (m.engagements ?? 0) * 0.2;
  return score >= 100 ? "HIGH" : score >= 30 ? "MEDIUM" : "LOW";
}

// ─── Campaigns ────────────────────────────────────────────────────────────────

export async function listCampaigns(orgId: string) {
  return prisma.campaign.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    include: { actions: { orderBy: { status: "asc" }, include: { opportunity: { select: { title: true } }, prospect: { select: { name: true } } } } },
  });
}

export async function createCampaign(orgId: string, productId: string | null, data: { name: string; channel: string; objective: string; goalMetric?: string; scheduledAt?: string | null }) {
  const plan = await resolveEffectivePlan(orgId);
  const count = await prisma.campaign.count({ where: { orgId, status: { in: ["ACTIVE", "SCHEDULED", "DRAFT"] } } });
  if (count >= plan.limits.experiments * 2) throw limitReached("Active campaign limit reached on your plan.");
  const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
  const scheduled = scheduledAt && scheduledAt.getTime() > Date.now() + 60_000;
  return prisma.campaign.create({
    data: {
      orgId,
      productId,
      name: data.name,
      channel: data.channel,
      objective: data.objective,
      goalMetric: data.goalMetric,
      status: scheduled ? "SCHEDULED" : "ACTIVE",
      scheduledAt: scheduled ? scheduledAt : null,
      startedAt: scheduled ? null : new Date(),
    },
  });
}

export async function setCampaignStatus(orgId: string, campaignId: string, status: "ACTIVE" | "PAUSED" | "DONE" | "SCHEDULED") {
  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, orgId } });
  if (!campaign) throw notFound("Campaign not found");
  return prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status,
      startedAt: status === "ACTIVE" && !campaign.startedAt ? new Date() : campaign.startedAt,
      scheduledAt: status === "SCHEDULED" ? campaign.scheduledAt : null,
    },
  });
}

export async function setCampaignActionStatus(orgId: string, actionId: string, status: "TODO" | "DONE" | "SKIPPED") {
  const action = await prisma.campaignAction.findFirst({ where: { id: actionId, campaign: { orgId } } });
  if (!action) throw notFound("Action not found");
  return prisma.campaignAction.update({ where: { id: actionId }, data: { status, doneAt: status === "DONE" ? new Date() : null } });
}

export async function addCampaignAction(orgId: string, campaignId: string, data: { type: string; title: string; opportunityId?: string; prospectId?: string; dueAt?: string | null }) {
  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, orgId } });
  if (!campaign) throw notFound("Campaign not found");
  const dueAt = data.dueAt ? new Date(data.dueAt) : null;
  return prisma.campaignAction.create({
    data: { campaignId, type: data.type, title: data.title, opportunityId: data.opportunityId, prospectId: data.prospectId, dueAt: dueAt && !isNaN(dueAt.getTime()) ? dueAt : null },
  });
}

// ─── Experiments (spec §13) ───────────────────────────────────────────────────

export async function createExperiment(orgId: string, productId: string | null, data: { name: string; hypothesis: string; channelA: string; channelB: string }) {
  const plan = await resolveEffectivePlan(orgId);
  const count = await prisma.experiment.count({ where: { orgId, status: "RUNNING" } });
  assertWithin(plan.limits.experiments, count, "Running experiments");
  return prisma.experiment.create({ data: { orgId, productId, name: data.name, hypothesis: data.hypothesis, channelA: data.channelA, channelB: data.channelB } });
}

export async function addExperimentResult(orgId: string, experimentId: string, data: {
  channel: string; opportunities: number; engagements: number; clicks: number; signups: number;
  activations: number; customers: number; revenueCents: number; spendCents: number; hoursInvested: number;
}) {
  const experiment = await prisma.experiment.findFirst({ where: { id: experimentId, orgId } });
  if (!experiment) throw notFound("Experiment not found");
  const row = await prisma.experimentResult.create({ data: { ...data, experimentId } });
  return row;
}

export async function concludeExperiment(orgId: string, experimentId: string) {
  const experiment = await prisma.experiment.findFirst({ where: { id: experimentId, orgId } });
  if (!experiment) throw notFound("Experiment not found");
  return prisma.experiment.update({ where: { id: experimentId }, data: { status: "CONCLUDED", endedAt: new Date() } });
}

// ─── Competitors (spec §16) ───────────────────────────────────────────────────

export async function listCompetitors(orgId: string) {
  const competitors = await prisma.competitor.findMany({
    where: { orgId },
    orderBy: { name: "asc" },
    include: { events: { orderBy: { detectedAt: "desc" }, take: 10 } },
  });
  return competitors;
}

export async function addCompetitor(orgId: string, productId: string | null, data: { name: string; url?: string; positioning?: string }) {
  const plan = await resolveEffectivePlan(orgId);
  const count = await prisma.competitor.count({ where: { orgId } });
  assertWithin(plan.limits.competitors, count, "Monitored competitors");
  return prisma.competitor.upsert({
    where: { orgId_name: { orgId, name: data.name } },
    update: { url: data.url ?? null, positioning: data.positioning ?? null },
    create: { orgId, productId, name: data.name, url: data.url ?? null, positioning: data.positioning ?? null },
  });
}

export async function addCompetitorEventManually(orgId: string, data: { competitorId: string; kind: CompetitorEventKind; detail: string }) {
  const comp = await prisma.competitor.findFirst({ where: { id: data.competitorId, orgId } });
  if (!comp) throw notFound("Competitor not found");
  const draft = analyzeEvent(data.kind, comp.name, data.detail);
  return prisma.competitorEvent.create({
    data: {
      competitorId: comp.id,
      orgId,
      kind: data.kind,
      title: draft.title,
      detail: data.detail,
      whatChanged: draft.whatChanged,
      whyItMatters: draft.whyItMatters,
      potentialResponse: draft.potentialResponse,
      severity: draft.severity,
    },
  });
}

export async function toggleCompetitorMonitor(orgId: string, id: string, monitor: boolean) {
  const comp = await prisma.competitor.findFirst({ where: { id, orgId } });
  if (!comp) throw notFound("Competitor not found");
  const updated = await prisma.competitor.update({ where: { id }, data: { monitor } });
  if (monitor) await enqueueJob("COMPETITOR_WATCH", orgId, { orgId, productId: comp.productId }, { runAt: new Date(Date.now() + 5_000) });
  return updated;
}

export { analyzeEvent };
