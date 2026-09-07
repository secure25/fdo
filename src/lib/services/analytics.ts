/**
 * Analytics service — ROI + customer funnel per channel (spec §15) and
 * experiment/learning assembly (spec §13/§14).
 */

import { prisma } from "../db";
import { buildChannelFunnel, channelVerdict, rankChannels, type ChannelFunnel } from "../engines/roi";
import { computeFunnel, conclude, type ExperimentConclusion, type ExperimentFunnel } from "../engines/experiments";
import { deriveInsights, resultBand, type InsightDraft, type LearningInsights } from "../engines/learning";
import { jparse } from "../jsonfield";

export async function getChannelFunnels(orgId: string): Promise<{ channels: ChannelFunnel[]; verdict: string; totalMrrCents: number }> {
  const [conversions, visitRows, revenues] = await Promise.all([
    prisma.conversion.groupBy({
      by: ["channel", "stage"],
      where: { orgId },
      _sum: { count: true },
    }),
    prisma.conversion.findMany({ where: { orgId, stage: "VISIT" }, select: { channel: true, meta: true } }),
    prisma.revenueEvent.findMany({ where: { orgId }, select: { channel: true, amountCents: true, kind: true, isRecurring: true } }),
  ]);

  const channelNames = new Set<string>([...conversions.map((c) => c.channel), ...revenues.map((r) => r.channel)]);
  const channels: ChannelFunnel[] = [];

  for (const name of channelNames) {
    const stageSum = (stage: string) => conversions.find((c) => c.channel === name && c.stage === stage)?._sum.count ?? 0;
    const rev = revenues.filter((r) => r.channel === name);
    const mrr = rev.filter((r) => r.isRecurring && r.kind !== "CHURN" && r.kind !== "REFUND").reduce((s, r) => s + r.amountCents, 0);
    const revenue = rev.filter((r) => r.kind !== "REFUND").reduce((s, r) => s + r.amountCents, 0);
    const visitMeta = visitRows.find((c) => c.channel === name);
    const impressions = jparse<{ impressions?: number }>(visitMeta?.meta ?? null, {}).impressions ?? Math.round(stageSum("VISIT") * 12);
    channels.push(
      buildChannelFunnel({
        channel: name,
        impressions,
        visits: stageSum("VISIT"),
        signups: stageSum("SIGNUP"),
        activations: stageSum("ACTIVATION"),
        customers: stageSum("CUSTOMER"),
        mrrCents: mrr,
        revenueCents: revenue,
        spendCents: 0,
      })
    );
  }

  return { channels: rankChannels(channels), verdict: channelVerdict(channels), totalMrrCents: channels.reduce((s, c) => s + c.mrrCents, 0) };
}

export async function getExperimentView(orgId: string) {
  const experiments = await prisma.experiment.findMany({
    where: { orgId },
    orderBy: { startedAt: "desc" },
    include: { results: true },
  });
  return experiments.map((e) => {
    const byChannel = new Map<string, ExperimentFunnel>();
    for (const r of e.results) {
      const agg = byChannel.get(r.channel);
      if (agg) {
        agg.opportunities += r.opportunities;
        agg.engagements += r.engagements;
        agg.clicks += r.clicks;
        agg.signups += r.signups;
        agg.activations += r.activations;
        agg.customers += r.customers;
        agg.revenueCents += r.revenueCents;
        agg.hoursInvested += r.hoursInvested;
      } else {
        byChannel.set(r.channel, computeFunnel({ channel: r.channel, opportunities: r.opportunities, engagements: r.engagements, clicks: r.clicks, signups: r.signups, activations: r.activations, customers: r.customers, revenueCents: r.revenueCents, hoursInvested: r.hoursInvested }));
      }
    }
    const a = byChannel.get(e.channelA);
    const b = byChannel.get(e.channelB);
    let conclusion: ExperimentConclusion | null = null;
    if (a && b) conclusion = conclude(a, b);
    return {
      id: e.id,
      name: e.name,
      hypothesis: e.hypothesis,
      channelA: e.channelA,
      channelB: e.channelB,
      status: e.status,
      startedAt: e.startedAt.toISOString(),
      funnels: Array.from(byChannel.values()),
      conclusion,
    };
  });
}

export type LearningView = { insights: InsightDraft[]; bestCombo: LearningInsights["bestCombo"]; observations: { channel: string; topic: string | null; format: string | null; result: string; metrics: Record<string, number> }[] };

export async function getLearningView(orgId: string): Promise<LearningView> {
  const [stored, observations] = await Promise.all([
    prisma.learningInsight.findMany({ where: { orgId }, orderBy: { confidence: "desc" } }),
    prisma.learningObservation.findMany({ where: { orgId }, orderBy: { observedAt: "desc" }, take: 30 }),
  ]);

  const derived = deriveInsights(
    observations.map((o) => ({
      channel: o.channel,
      topic: o.topic,
      format: o.format,
      icpTag: o.icpTag,
      metrics: jparse<Record<string, number>>(o.metrics, {}),
    }))
  );

  const merged = new Map<string, InsightDraft>();
  for (const i of derived.insights) merged.set(i.statement, i);
  for (const s of stored) {
    const evidence = jparse<string[]>(s.evidence, []);
    merged.set(s.statement, {
      statement: s.statement,
      dimension: s.dimension as InsightDraft["dimension"],
      confidence: s.confidence,
      evidence,
      recommendation: s.recommendation,
    });
  }

  return {
    insights: Array.from(merged.values()).sort((a, b) => b.confidence - a.confidence),
    bestCombo: derived.bestCombo,
    observations: observations.map((o) => ({
      channel: o.channel,
      topic: o.topic,
      format: o.format,
      result: o.result,
      metrics: jparse<Record<string, number>>(o.metrics, {}),
    })),
  };
}

export { resultBand };
