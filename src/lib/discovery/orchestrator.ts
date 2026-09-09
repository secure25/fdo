/**
 * Discovery Orchestrator — runs raw candidates through the full pipeline:
 * intent classification → problem matching → sub-scores → composite score →
 * explanation → dedupe → persistence (+ signals, prospects, recommendations).
 * Platform-agnostic by design (spec §4): adapters come and go, pipeline stays.
 */

import { prisma } from "../db";
import { classifyIntent, problemMatchScore } from "../engines/intent";
import {
  scoreOpportunity,
  buildExplanation,
  recencyScore,
  competitionScore,
  engagementScore,
  effortMinutes,
  type SubScores,
} from "../engines/scoring";
import { recommendActionForIntent } from "../engines/content-engine";
import type { RawCandidate } from "./adapters";
import { jparse, jstr } from "../jsonfield";
import { logger } from "../logger";
import { meter } from "../usage";
import { dispatchOutboundWebhook } from "../services/webhooks";

export type ProductPipelineContext = {
  orgId: string;
  productId: string;
  productName: string;
  category: string;
  icpName: string;
  keywords: string[];
  problems: string[];
  communityIds: Map<string, string>; // name (e.g. "r/shopify") -> Community.id
};

const PLATFORM_COMPETITION_BASE: Record<string, number> = {
  REDDIT: 38,
  HACKERNEWS: 42,
  LINKEDIN: 45,
  X: 40,
  SANDBOX: 30,
  FACEBOOK: 35,
  FORUM: 28,
  SLACK: 30,
  DISCORD: 26,
  OTHER: 35,
};

export type PipelineOutcome = {
  scanned: number;
  inserted: number;
  skippedDuplicates: number;
  veryHigh: number;
};

export async function runPipeline(candidates: RawCandidate[], ctx: ProductPipelineContext): Promise<PipelineOutcome> {
  const productIntel = {
    keywords: ctx.keywords,
    problems: ctx.problems,
    category: ctx.category,
  };

  let inserted = 0;
  let skipped = 0;
  let veryHigh = 0;

  for (const c of candidates) {
    const ageHours = Math.max(0.2, (Date.now() - c.postedAt.getTime()) / 3_600_000);

    const intent = classifyIntent(c.title, c.body);
    const problem = problemMatchScore(c.title, c.body, productIntel);

    const icpMatch = Math.max(25, Math.min(98, problem.score * 0.55 + (c.platform === "REDDIT" || c.platform === "HACKERNEWS" ? 30 : 24) + (intent.signals.some((s) => s.kind === "TECH_STACK") ? 8 : 0)));
    const subs: SubScores = {
      icpMatch: Math.round(icpMatch),
      problemMatch: problem.score,
      buyingIntent: intent.buyingIntent,
      recency: recencyScore(ageHours),
      competition: competitionScore({
        replyCount: c.replyCount,
        vendorMentions: c.vendorMentions,
        platformBase: PLATFORM_COMPETITION_BASE[c.platform] ?? 35,
      }),
      engagementPotential: engagementScore({
        isQuestion: /\?/.test(c.title + c.body),
        authorActive: Boolean(c.author),
        upvotes: c.upvotes,
        communityActivity: c.replyCount > 5 ? 6 : 2,
      }),
    };

    const { score, band } = scoreOpportunity(subs);

    // Live-ingestion quality bar: weakly-relevant posts (LOW band) never enter
    // the feed. Sandbox/curated content is exempt so demo workspaces stay rich.
    if (c.adapter !== "sandbox" && band === "LOW") {
      skipped += 1;
      continue;
    }

    const explanation = buildExplanation({
      title: c.title,
      platform: c.platform,
      community: c.communityName,
      ageHours,
      intentType: intent.intentType,
      subs,
      score,
      band,
      matchedPhrases: intent.matchedPhrases,
      evidence: problem.evidence,
      authorName: c.author,
    });
    const action = recommendActionForIntent(intent.intentType);

    const communityId = c.communityName ? ctx.communityIds.get(c.communityName.toLowerCase()) ?? null : null;

    try {
      const created = await prisma.opportunity.create({
        data: {
          orgId: ctx.orgId,
          productId: ctx.productId,
          communityId,
          adapter: c.adapter,
          externalId: c.externalId,
          url: c.url,
          platform: c.platform,
          communityName: c.communityName,
          title: c.title.slice(0, 300),
          body: c.body.slice(0, 4000),
          author: c.author,
          authorUrl: c.authorUrl,
          postedAt: c.postedAt,
          ageHours,
          isPartnerSignal: c.isPartnerSignal || intent.intentType === "PARTNERSHIP_OPPORTUNITY",
          competitorName: intent.competitorName,
          intentType: intent.intentType,
          subIcp: subs.icpMatch,
          subProblem: subs.problemMatch,
          subIntent: subs.buyingIntent,
          subRecency: subs.recency,
          subCompetition: subs.competition,
          subEngagement: subs.engagementPotential,
          score,
          band,
          effortMinutes: effortMinutes(intent.intentType, c.body.length),
          potential: band,
          explanation: jstr(explanation),
          matchedPhrases: jstr(intent.matchedPhrases),
          isLive: c.adapter !== "sandbox",
          signals: {
            create: intent.signals.slice(0, 8).map((s) => ({
              kind: s.kind,
              phrase: s.phrase.slice(0, 180),
              weight: s.weight,
            })),
          },
        },
      });

      inserted += 1;
      if (band === "VERY_HIGH") veryHigh += 1;

      // Dispatch outbound webhook for high-intent opportunities (score >= 75 or VERY_HIGH)
      if (band === "VERY_HIGH" || score >= 75) {
        dispatchOutboundWebhook(ctx.orgId, "opportunity.created", {
          id: created.id,
          title: created.title,
          url: created.url,
          platform: created.platform,
          communityName: created.communityName,
          author: created.author,
          score: created.score,
          band: created.band,
          intentType: created.intentType,
          postedAt: created.postedAt.toISOString(),
          what: explanation.what,
          whyMatters: explanation.whyMatters,
          nextAction: explanation.nextAction,
        }).catch(() => undefined);
      }

      // Auto-create a recommendation for very-high-intent opportunities.
      if (band === "VERY_HIGH") {
        await prisma.recommendation.create({
          data: {
            orgId: ctx.orgId,
            productId: ctx.productId,
            kind: intent.intentType === "PARTNERSHIP_OPPORTUNITY" ? "PARTNER" : "REPLY",
            title: `Respond to: ${c.title.slice(0, 70)}`,
            body: explanation.whyMatters.join(" "),
            what: `${action.label} in ${c.communityName ?? c.platform}`,
            why: `Score ${score}/100 — ${intent.intentType.toLowerCase().replace(/_/g, " ")} from your ICP.`,
            impact: "HIGH",
            effortMinutes: effortMinutes(intent.intentType, c.body.length),
            nextAction: explanation.nextAction,
            refType: "opportunity",
            refId: created.id,
            priority: 100 - Math.min(50, Math.round(ageHours)),
          },
        });

        // High-intent authors become prospects automatically (spec §7).
        if (c.author && c.author !== "[deleted]" && intent.buyingIntent >= 70) {
          const draft = prospectDraftFromCandidate(c, ctx, subs.icpMatch, subs.buyingIntent, created.id);
          await prisma.prospect.create({ data: { ...draft, orgId: ctx.orgId, productId: ctx.productId } });
        }
      }
    } catch (err) {
      // Unique constraint => duplicate; anything else gets logged.
      const code = (err as { code?: string }).code;
      if (code === "P2002") {
        skipped += 1;
      } else {
        logger.error("pipeline insert failed", { externalId: c.externalId, err: err instanceof Error ? err.message : String(err) });
        skipped += 1;
      }
    }
  }

  return { scanned: candidates.length, inserted, skippedDuplicates: skipped, veryHigh };
}

function prospectDraftFromCandidate(
  c: RawCandidate,
  ctx: ProductPipelineContext,
  icpFit: number,
  intentScore: number,
  opportunityId: string
) {
  const verified = [
    `Posted in ${c.communityName ?? c.platform}: “${c.title.slice(0, 90)}”`,
    `Author: ${c.author}`,
  ];
  const inferred = [
    `Likely part of ${ctx.icpName.toLowerCase()} based on problem match`,
    "Role/decision authority unconfirmed — verify in first conversation",
  ];
  return {
    name: c.author ?? "Unknown",
    handle: c.author,
    company: null,
    role: null,
    website: null,
    industry: ctx.category,
    sourceOpportunityId: opportunityId,
    icpFit,
    intentScore,
    signalsVerified: jstr(verified),
    signalsInferred: jstr(inferred),
    approach:
      "Open with a personalized response to their exact stated problem. No pitch in the first message.",
    stage: "NEW",
  };
}

/** Resolve the sandbox authoring context: community name -> id map for an org's product. */
export async function communityMapFor(orgId: string, productId: string | null): Promise<Map<string, string>> {
  const links = await prisma.productCommunity.findMany({
    where: { product: { orgId, ...(productId ? { id: productId } : {}) } },
    include: { community: true },
  });
  const map = new Map<string, string>();
  for (const l of links) map.set(l.community.name.toLowerCase(), l.communityId);
  return map;
}

export { jparse };
