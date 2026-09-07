/**
 * Opportunity Scorer — explainable composite score.
 * Sub-scores are computed independently, then combined with fixed weights so
 * every score can be decomposed back into its inputs (spec §5).
 */

export type SubScores = {
  icpMatch: number; // 0-100
  problemMatch: number; // 0-100
  buyingIntent: number; // 0-100
  recency: number; // 0-100 (100 = right now)
  competition: number; // 0-100 (LOWER is better)
  engagementPotential: number; // 0-100
};

export type Band = "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";

const WEIGHTS = {
  icpMatch: 0.3,
  problemMatch: 0.3,
  buyingIntent: 0.22,
  recency: 0.12,
  competition: 0.04, // uses (100 - competition)
  engagementPotential: 0.02,
} as const;

export function compositeScore(s: SubScores): number {
  const raw =
    WEIGHTS.icpMatch * s.icpMatch +
    WEIGHTS.problemMatch * s.problemMatch +
    WEIGHTS.buyingIntent * s.buyingIntent +
    WEIGHTS.recency * s.recency +
    WEIGHTS.competition * (100 - s.competition) +
    WEIGHTS.engagementPotential * s.engagementPotential;
  return Math.max(1, Math.min(100, Math.round(raw)));
}

export function bandOf(score: number): Band {
  if (score >= 90) return "VERY_HIGH";
  if (score >= 75) return "HIGH";
  if (score >= 55) return "MEDIUM";
  return "LOW";
}

export function bandLabel(band: Band): string {
  return { VERY_HIGH: "Very High", HIGH: "High", MEDIUM: "Medium", LOW: "Low" }[band];
}

/** Recency decay: 100 at 0h, ~70 at 24h, ~40 at 3d, ~10 at 14d, floor 5. */
export function recencyScore(ageHours: number): number {
  const v = 100 * Math.exp(-ageHours / 40) + 4;
  return Math.round(Math.min(100, v));
}

/** Competition: existing vendor replies + reply volume raise it. */
export function competitionScore(opts: { replyCount?: number; vendorMentions?: number; platformBase?: number }): number {
  const base = opts.platformBase ?? 35;
  const replies = Math.min(30, (opts.replyCount ?? 0) * 2);
  const vendors = Math.min(40, (opts.vendorMentions ?? 0) * 13);
  return Math.max(0, Math.min(100, base + replies + vendors));
}

export function engagementScore(opts: { authorActive?: boolean; isQuestion?: boolean; upvotes?: number; communityActivity?: number }): number {
  let s = 55;
  if (opts.isQuestion) s += 12;
  if (opts.authorActive) s += 12;
  s += Math.min(20, Math.round((opts.upvotes ?? 0) / 5));
  s += Math.min(8, opts.communityActivity ?? 0);
  return Math.max(20, Math.min(100, s));
}

export type ScoredOpportunity = {
  score: number;
  band: Band;
  subs: SubScores;
};

export function scoreOpportunity(subs: SubScores): ScoredOpportunity {
  const score = compositeScore(subs);
  return { score, band: bandOf(score), subs };
}

// ─── Explainability ───────────────────────────────────────────────────────────

export type Explanation = {
  what: string;
  whyMatters: string[];
  whyYou: string[];
  nextAction: string;
  caution?: string;
};

export function buildExplanation(input: {
  title: string;
  platform: string;
  community: string | null;
  ageHours: number;
  intentType: string;
  subs: SubScores;
  score: number;
  band: Band;
  matchedPhrases: string[];
  evidence: string[];
  authorName?: string | null;
}): Explanation {
  const where = input.community ? `${input.platform} · ${input.community}` : input.platform;
  const age =
    input.ageHours < 1 ? "under an hour" :
    input.ageHours < 24 ? `${Math.round(input.ageHours)}h ago` :
    `${Math.round(input.ageHours / 24)}d ago`;

  const what =
    `${input.authorName ?? "A user"} posted in ${where} ${age}: "${input.title.trim()}"`;

  const whyMatters: string[] = [];
  if (input.subs.buyingIntent >= 80) whyMatters.push(`Strong purchase signal — buying-intent ${input.subs.buyingIntent}/100`);
  else if (input.subs.buyingIntent >= 65) whyMatters.push(`Research-grade intent — buying-intent ${input.subs.buyingIntent}/100`);
  else whyMatters.push(`Early-stage signal — awareness-level intent (${input.subs.buyingIntent}/100)`);
  if (input.subs.recency >= 70) whyMatters.push(`Posted ${age} — still in the attention window`);
  if (input.subs.icpMatch >= 80) whyMatters.push(`Author profile matches your ICP (${input.subs.icpMatch}/100)`);
  if (input.subs.competition <= 40) whyMatters.push(`Low competitor presence (competition ${input.subs.competition}/100)`);
  if (input.intentType === "URGENT_NEED") whyMatters.push("Time pressure is explicit — early helpful answers win");
  if (input.intentType === "COMPETITOR_DISSATISFACTION" && input.evidence.length)
    whyMatters.push(`Competitor friction detected: ${input.evidence[0]}`);

  const whyYou = input.evidence.slice(0, 4).map((e) => `Relevant to your product: “${e}”`);
  if (whyYou.length === 0) whyYou.push("Shares the core problem your product addresses");

  const { nextAction, caution } = nextActionFor(input.intentType, input.platform, input.band);
  return { what, whyMatters, whyYou, nextAction, caution };
}

export function nextActionFor(intentType: string, platform: string, band: Band): { nextAction: string; caution?: string } {
  const p = platform.toUpperCase();
  switch (intentType) {
    case "ACTIVE_BUYING":
    case "VENDOR_COMPARISON":
      return {
        nextAction:
          "Answer the question genuinely and completely. Mention your product only where contextually appropriate, and disclose affiliation if rules require it.",
        caution: band === "VERY_HIGH" ? undefined : "Lead with help, not the pitch — the answer must stand on its own.",
      };
    case "RECOMMENDATION_REQUEST":
      return {
        nextAction:
          "Give a direct recommendation with honest trade-offs (yours included). One link max, disclosed.",
      };
    case "COMPETITOR_DISSATISFACTION":
      return {
        nextAction:
          "Acknowledge the frustration, share how you solve that specific part. Do not trash the competitor.",
        caution: "Never disparage the competitor by name.",
      };
    case "URGENT_NEED":
      return {
        nextAction: "Reply fast with the shortest path to unblocked. Offer a concrete next step today.",
      };
    case "PROBLEM_AWARENESS":
      return {
        nextAction:
          "Engage with an educational comment that helps first. Do not pitch yet — build familiarity for the next touch.",
        caution: "DON'T PITCH YET. This is awareness-stage; selling now reads as spam and burns the thread.",
      };
    case "PARTNERSHIP_OPPORTUNITY":
      return {
        nextAction: "Reach out privately with a concrete partnership structure (referral %, integration, co-marketing).",
      };
    default:
      return { nextAction: `Observe for now; engage ${p === "LINKEDIN" ? "with an insightful comment" : "naturally"} if you can add value.` };
  }
}

/** Effort estimate in minutes for the recommended action. */
export function effortMinutes(intentType: string, bodyLength: number): number {
  const base =
    intentType === "PARTNERSHIP_OPPORTUNITY" ? 25 :
    intentType === "COMPETITOR_DISSATISFACTION" ? 10 :
    intentType === "PROBLEM_AWARENESS" ? 7 : 8;
  return Math.min(30, base + Math.floor(bodyLength / 400));
}
