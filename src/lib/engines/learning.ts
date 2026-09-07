/**
 * Learning Engine (spec §14) — distills observations into insights:
 * WHAT works → FOR WHOM → WHERE → WHEN → WHY, then biases future
 * recommendations toward what works.
 */

export type ObservationMetrics = {
  impressions?: number;
  engagements?: number;
  clicks?: number;
  signups?: number;
  customers?: number;
  revenueCents?: number;
};

export type ObservationInput = {
  channel: string;
  topic?: string | null;
  format?: string | null;
  icpTag?: string | null;
  metrics: ObservationMetrics;
};

export function resultBand(m: ObservationMetrics): "HIGH" | "MEDIUM" | "LOW" {
  const score =
    (m.customers ?? 0) * 40 +
    (m.signups ?? 0) * 6 +
    (m.clicks ?? 0) * 0.5 +
    (m.engagements ?? 0) * 0.2;
  if (score >= 100) return "HIGH";
  if (score >= 30) return "MEDIUM";
  return "LOW";
}

export type InsightDraft = {
  statement: string;
  dimension: "TOPIC" | "FORMAT" | "CHANNEL" | "ICP" | "TIMING" | "WHY";
  confidence: number;
  evidence: string[];
  recommendation: string;
};

export type LearningInsights = {
  insights: InsightDraft[];
  bestCombo: { topic: string; format: string; icp: string; channel: string } | null;
};

export function deriveInsights(observations: ObservationInput[]): LearningInsights {
  const insights: InsightDraft[] = [];
  const high = observations.filter((o) => resultBand(o.metrics) === "HIGH");

  // Group by channel
  const byChannel = group(observations, (o) => o.channel);
  const channelScores = Object.entries(byChannel).map(([ch, obs]) => ({
    channel: ch,
    customers: sum(obs, (o) => o.metrics.customers ?? 0),
    signups: sum(obs, (o) => o.metrics.signups ?? 0),
    engagements: sum(obs, (o) => o.metrics.engagements ?? 0),
  })).sort((a, b) => b.customers - a.customers || b.signups - a.signups);

  if (channelScores.length >= 2) {
    const best = channelScores[0]!;
    const worst = channelScores[channelScores.length - 1]!;
    if (best.customers > 0) {
      insights.push({
        statement: `${best.channel} produces customers; ${worst.channel === best.channel ? "other channels" : worst.channel} currently does not.`,
        dimension: "CHANNEL",
        confidence: Math.min(90, 55 + best.customers * 8),
        evidence: channelScores.map((c) => `${c.channel}: ${c.customers} customers, ${c.signups} signups, ${fmt(c.engagements)} engagements`),
        recommendation: `Put the next two weeks of effort into ${best.channel}. Re-check ${worst.channel === best.channel ? "remaining channels" : worst.channel} only after ${best.channel} is saturated.`,
      });
    }
  }

  // Group by topic among high performers
  const topicGroups = group(high, (o) => o.topic ?? "general");
  const bestTopic = Object.entries(topicGroups).sort((a, b) => sum(b[1], (o) => obsScore(o.metrics)) - sum(a[1], (o) => obsScore(o.metrics)))[0];
  if (bestTopic && bestTopic[1].length > 0) {
    const sample = bestTopic[1][0]!;
    insights.push({
      statement: `Topic "${bestTopic[0]}" is your strongest performer.`,
      dimension: "TOPIC",
      confidence: Math.min(88, 50 + bestTopic[1].length * 12),
      evidence: bestTopic[1].slice(0, 3).map((o) => `${o.channel} · ${o.format ?? "post"}: ${fmt(o.metrics.engagements ?? 0)} engagements, ${o.metrics.customers ?? 0} customers`),
      recommendation: `Double down on "${bestTopic[0]}" content this week across ${sample.channel} and your other top channel.`,
    });
  }

  // Format signal
  const formatGroups = group(high, (o) => o.format ?? "post");
  const bestFormat = Object.entries(formatGroups).sort((a, b) => sum(b[1], (o) => obsScore(o.metrics)) - sum(a[1], (o) => obsScore(o.metrics)))[0];
  if (bestFormat) {
    insights.push({
      statement: `Educational/${bestFormat[0]} format outperforms promotional formats for your audience.`,
      dimension: "FORMAT",
      confidence: 72,
      evidence: bestFormat[1].slice(0, 3).map((o) => `${o.channel}: ${fmt(o.metrics.engagements ?? 0)} engagements`),
      recommendation: "Keep formats educational with a numeric payoff. Avoid product-first posts entirely.",
    });
  }

  // ICP dimension
  const icpTags = new Set(high.map((o) => o.icpTag).filter(Boolean) as string[]);
  if (icpTags.size > 0) {
    insights.push({
      statement: `Your converting audience self-identifies as: ${Array.from(icpTags).join(", ")}.`,
      dimension: "ICP",
      confidence: 70,
      evidence: high.slice(0, 3).map((o) => `${o.icpTag} via ${o.channel}`),
      recommendation: "Keep ICP language verbatim in content titles and outreach subject lines — it is converting.",
    });
  }

  // What doesn't work — channel-level aggregate, not single weak posts
  const zeroCustomerChannels = channelScores.filter((c) => c.customers === 0 && c.signups === 0);
  if (zeroCustomerChannels.length > 0 && channelScores.length >= 2) {
    const weakest = zeroCustomerChannels[zeroCustomerChannels.length - 1]!;
    insights.push({
      statement: `${weakest.channel} repeatedly underperforms for you.`,
      dimension: "WHY",
      confidence: 64,
      evidence: [`${weakest.channel}: ${fmt(weakest.engagements)} engagements → 0 signups, 0 customers`],
      recommendation: `Either change the format on ${weakest.channel} (educational, problem-first) or cut it this month and reinvest the hours in your top channel.`,
    });
  }

  const bestTopicObs = bestTopic?.[1]?.[0];
  const bestCombo = bestTopicObs
    ? { topic: bestTopicObs.topic ?? "general", format: bestTopicObs.format ?? "post", icp: bestTopicObs.icpTag ?? "core ICP", channel: bestTopicObs.channel }
    : null;

  return { insights, bestCombo };
}

function obsScore(m: ObservationMetrics): number {
  return (m.customers ?? 0) * 40 + (m.signups ?? 0) * 6 + (m.clicks ?? 0) * 0.5 + (m.engagements ?? 0) * 0.2;
}

function group<T>(arr: T[], key: (t: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const item of arr) {
    const k = key(item);
    (out[k] ??= []).push(item);
  }
  return out;
}

function sum<T>(arr: T[], f: (t: T) => number): number {
  return arr.reduce((s, x) => s + f(x), 0);
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}
