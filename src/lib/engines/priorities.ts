/**
 * Founder Command Center (spec §11) — "What should I do today?"
 * Builds the prioritized, time-boxed daily plan from live data.
 */

export type Priority = {
  rank: number;
  title: string;
  detail: string;
  minutes: number;
  impact: "HIGH" | "MEDIUM" | "LOW";
  href: string;
  cta: string;
};

export type DailyBriefing = {
  greeting: string;
  headline: string;
  stats: { newOpportunities: number; highIntent: number; urgent: number; partnerships: number; readyDrafts: number };
  priorities: Priority[];
  totalMinutes: number;
  focusMessage: string;
};

export function greetingFor(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function buildPriorities(input: {
  topReplyTargets: { id: string; title: string; platform: string; communityName: string | null; score: number; effortMinutes: number; band: string }[];
  contactTargets: { id: string; name: string; company: string | null; icpFit: number; intentScore: number }[];
  followUps: { id: string; name: string; company: string | null; stage: string }[];
  readyDrafts: { id: string; title: string; channel: string }[];
  partnershipTargets: { id: string; name: string; type: string; potential: number }[];
  stats: { newOpportunities: number; highIntent: number; urgent: number; partnerships: number; readyDrafts: number };
}): { priorities: Priority[]; totalMinutes: number } {
  const priorities: Priority[] = [];

  if (input.topReplyTargets.length > 0) {
    const n = input.topReplyTargets.length;
    const minutes = input.topReplyTargets.reduce((s, o) => s + o.effortMinutes, 0);
    priorities.push({
      rank: 0,
      title: `Reply to ${n} high-intent conversation${n > 1 ? "s" : ""}`,
      detail: input.topReplyTargets.map((o) => `“${o.title.slice(0, 58)}${o.title.length > 58 ? "…" : ""}” (${o.communityName ?? o.platform}, ${o.score}/100)`).join("\n"),
      minutes,
      impact: "HIGH",
      href: "/app/opportunities?band=VERY_HIGH,HIGH&status=NEW",
      cta: "Open opportunities",
    });
  }

  if (input.contactTargets.length > 0) {
    const n = Math.min(5, input.contactTargets.length);
    priorities.push({
      rank: 0,
      title: `Contact ${n} qualified prospect${n > 1 ? "s" : ""}`,
      detail: input.contactTargets.slice(0, n).map((p) => `${p.name}${p.company ? ` — ${p.company}` : ""} (ICP ${p.icpFit}, intent ${p.intentScore})`).join("\n"),
      minutes: n * 4,
      impact: "HIGH",
      href: "/app/customers?stage=NEW",
      cta: "Open prospects",
    });
  }

  if (input.readyDrafts.length > 0) {
    const channelLabels: Record<string, string> = { SEO: "SEO", BLOG: "SEO", REDDIT: "Reddit", LINKEDIN: "LinkedIn", X: "X", YOUTUBE: "YouTube", EMAIL: "email" };
    const channelLabel = channelLabels[input.readyDrafts[0]!.channel] ?? input.readyDrafts[0]!.channel.toLowerCase();
    priorities.push({
      rank: 0,
      title: `Publish prepared ${channelLabel} content`,
      detail: input.readyDrafts.slice(0, 3).map((d) => `“${d.title.slice(0, 64)}”`).join("\n"),
      minutes: 5,
      impact: "MEDIUM",
      href: "/app/content?status=APPROVED",
      cta: "Open content",
    });
  }

  if (input.followUps.length >= 2) {
    priorities.push({
      rank: 0,
      title: `Follow up with ${input.followUps.length} warm lead${input.followUps.length > 1 ? "s" : ""}`,
      detail: input.followUps.slice(0, 4).map((p) => `${p.name}${p.company ? ` — ${p.company}` : ""} (${p.stage.toLowerCase()})`).join("\n"),
      minutes: input.followUps.length * 2,
      impact: "MEDIUM",
      href: "/app/customers?stage=ENGAGED",
      cta: "Open prospects",
    });
  }

  if (input.partnershipTargets.length > 0) {
    const p = input.partnershipTargets[0]!;
    priorities.push({
      rank: 0,
      title: `Send ${p.type.toLowerCase()} partnership proposal to ${p.name}`,
      detail: `${p.name} ranks ${p.potential}/100 on partnership potential. One partnership brings many customers — referral + integration offer is ready on the Partnerships board.`,
      minutes: 15,
      impact: "MEDIUM",
      href: "/app/distribution#partnerships",
      cta: "Open partnerships",
    });
  }

  priorities.forEach((p, i) => (p.rank = i + 1));
  return { priorities, totalMinutes: priorities.reduce((s, p) => s + p.minutes, 0) };
}

export function focusMessage(stats: DailyBriefing["stats"], totalMinutes: number): string {
  if (stats.urgent > 0) return `${stats.urgent} opportunit${stats.urgent === 1 ? "y is" : "ies are"} time-sensitive today — clear those first, then work the list top-down.`;
  if (stats.highIntent > 0) return `${stats.highIntent} high-intent conversations are waiting. Answers posted in the first 24h convert multiples better.`;
  if (totalMinutes === 0) return "Nothing is on fire. Good day to run an experiment or publish one educational piece.";
  return "A focused block today keeps the pipeline compounding.";
}
