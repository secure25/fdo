/**
 * Shared test helpers: pure (DB-free) versions of the discovery pipeline,
 * used by tests to validate scoring/explanations without persistence.
 */

import { classifyIntent, problemMatchScore } from "@/lib/engines/intent";
import {
  scoreOpportunity,
  buildExplanation,
  recencyScore,
  competitionScore,
  engagementScore,
  effortMinutes,
} from "@/lib/engines/scoring";
import type { RawCandidate } from "@/lib/discovery/adapters";
import type { Explanation } from "@/lib/engines/scoring";

export type PipelineResult = {
  intentType: string;
  buyingIntent: number;
  subs: {
    icpMatch: number;
    problemMatch: number;
    buyingIntent: number;
    recency: number;
    competition: number;
    engagementPotential: number;
  };
  score: number;
  band: string;
  explanation: Explanation;
};

export function classifyIntentAndScore(
  candidate: Pick<RawCandidate, "title" | "body" | "platform" | "communityName" | "replyCount" | "vendorMentions" | "upvotes" | "author" | "postedAt">,
  product: { keywords: string[]; problems: string[]; category: string }
): PipelineResult {
  const ageHours = Math.max(0.2, (Date.now() - candidate.postedAt.getTime()) / 3_600_000);
  const intent = classifyIntent(candidate.title, candidate.body);
  const problem = problemMatchScore(candidate.title, candidate.body, product);
  const subs = {
    icpMatch: Math.max(25, Math.min(98, problem.score * 0.55 + 30)),
    problemMatch: problem.score,
    buyingIntent: intent.buyingIntent,
    recency: recencyScore(ageHours),
    competition: competitionScore({ replyCount: candidate.replyCount, vendorMentions: candidate.vendorMentions, platformBase: 35 }),
    engagementPotential: engagementScore({ isQuestion: /\?/.test(candidate.title + candidate.body), authorActive: true, upvotes: candidate.upvotes }),
  };
  const { score, band } = scoreOpportunity(subs);
  const explanation = buildExplanation({
    title: candidate.title,
    platform: candidate.platform,
    community: candidate.communityName,
    ageHours,
    intentType: intent.intentType,
    subs,
    score,
    band,
    matchedPhrases: intent.matchedPhrases,
    evidence: problem.evidence,
    authorName: candidate.author,
  });
  return {
    intentType: intent.intentType,
    buyingIntent: intent.buyingIntent,
    subs,
    score,
    band,
    explanation,
  };
}

export { effortMinutes };
