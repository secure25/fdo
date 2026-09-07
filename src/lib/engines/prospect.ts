/**
 * Prospect Intelligence (spec §7) + Partnership Engine (spec §8).
 * Derives prospect profiles from opportunities, scores ICP fit and intent,
 * and clearly separates verified information from inference.
 */

import { jparse } from "../jsonfield";
import type { Opportunity, Prospect } from "@prisma/client";
import { nextActionFor } from "./scoring";

type OppLike = Pick<Opportunity, "id" | "title" | "body" | "author" | "authorUrl" | "platform" | "communityName" | "url" | "subIcp" | "subIntent" | "intentType" | "score" | "competitorName" | "matchedPhrases" | "postedAt" | "ageHours">;

export type ProspectDraft = {
  name: string;
  handle: string | null;
  company: string | null;
  role: string | null;
  website: string | null;
  industry: string | null;
  sourceOpportunityId: string | null;
  icpFit: number;
  intentScore: number;
  signalsVerified: string[];
  signalsInferred: string[];
  approach: string;
};

const COMPANY_HINTS = /(founder|ceo|cto|head of|director|manager|lead|owner)/i;

/** Derive a prospect profile from a single opportunity. */
export function prospectFromOpportunity(opp: OppLike, intel: { icpName: string; category: string }): ProspectDraft {
  const author = opp.author ?? "Unknown operator";
  const verified: string[] = [];
  const inferred: string[] = [];

  verified.push(`Publicly posted in ${opp.communityName ?? opp.platform} about “${opp.title.slice(0, 80)}”`);
  verified.push(`Posted ${opp.ageHours < 24 ? "today" : `${Math.round(opp.ageHours / 24)}d ago`}`);
  for (const p of jparse<string[]>(opp.matchedPhrases, []).slice(0, 3)) {
    verified.push(`Used intent phrase: “${p}”`);
  }
  if (opp.competitorName) verified.push(`Mentioned ${opp.competitorName} by name`);

  inferred.push(`Likely works in ${intel.icpName.toLowerCase()} based on the problem discussed`);
  if (COMPANY_HINTS.test(opp.body) || COMPANY_HINTS.test(opp.title)) {
    inferred.push("Signals a decision-making role (self-described in post)");
  } else {
    inferred.push("Role unconfirmed — treat as individual contributor until verified");
  }
  if (opp.body.length > 400) inferred.push("High context in post — likely deeply involved in the buying process");

  const icpFit = Math.max(35, Math.min(98, opp.subIcp));
  const intentScore = Math.max(30, Math.min(98, opp.subIntent));

  const { nextAction } = nextActionFor(opp.intentType, opp.platform, "HIGH");

  return {
    name: author,
    handle: opp.authorUrl ? author : null,
    company: null,
    role: null,
    website: null,
    industry: intel.category,
    sourceOpportunityId: opp.id,
    icpFit,
    intentScore,
    signalsVerified: verified,
    signalsInferred: inferred,
    approach: nextAction,
  };
}

// ─── Partnership engine ───────────────────────────────────────────────────────

export type PartnerType = "Agency" | "Consultant" | "Influencer" | "Newsletter operator" | "Community owner" | "Affiliate" | "Integrator" | "Technology partner";

export type PartnershipCandidate = {
  name: string;
  type: PartnerType;
  audience: string;
  reach: string;
  audienceFit: number; // 0-100
  customerOverlap: number; // 0-100
  relevance: number; // 0-100
  reachScore: number; // 0-100
  partnershipPotential: number; // composite
  recommendedModel: "Referral" | "Affiliate" | "Integration" | "Co-marketing" | "White-label" | "Agency partnership";
  rationale: string;
};

export function rankPartnershipModel(fit: number, overlap: number, type?: string): PartnershipCandidate["recommendedModel"] {
  // Deal model follows what the partner actually is — a newsletter can't be an
  // "agency partnership" and an agency shouldn't be sold as an "integration".
  const t = (type ?? "").toLowerCase();
  if (t.includes("newsletter")) return fit >= 78 ? "Co-marketing" : "Referral";
  if (t.includes("agency")) return fit >= 78 ? "Agency partnership" : "Referral";
  if (t.includes("consultant")) return "Referral";
  if (t.includes("technology") || t.includes("integrator")) return "Integration";
  if (t.includes("influencer")) return fit >= 80 ? "Affiliate" : "Co-marketing";
  if (t.includes("affiliate")) return "Affiliate";
  if (fit >= 85 && overlap >= 80) return "Referral";
  if (fit >= 80 && overlap >= 70) return "Agency partnership";
  if (fit >= 70 && overlap >= 60) return "Referral";
  if (fit >= 60) return "Co-marketing";
  if (overlap >= 70) return "Affiliate";
  return "White-label";
}

export function partnershipPotential(fit: number, overlap: number, relevance: number, reach: number): number {
  return Math.round(0.35 * fit + 0.25 * overlap + 0.25 * relevance + 0.15 * reach);
}

/** Seedable candidate pool per archetype (deterministic demo pool; live discovery enriches this). */
export function candidatesForArchetype(archetypeId: string, icpName: string, category: string): PartnershipCandidate[] {
  const pools: Record<string, { name: string; type: PartnerType; audience: string; reach: string; fit: number; overlap: number; rel: number; reachS: number; why: string }[]> = {
    "fashion-ecommerce": [
      { name: "Studio Mera", type: "Agency", audience: "DTC fashion brands on Shopify", reach: "~40 client brands", fit: 92, overlap: 88, rel: 90, reachS: 62, why: "Shopify-first fashion agency; every client is your ICP." },
      { name: "The Ecomm Roundup", type: "Newsletter operator", audience: "12k ecommerce operators", reach: "12,400 subscribers", fit: 84, overlap: 72, rel: 82, reachS: 74, why: "Newsletter readers actively evaluate storefront tooling." },
      { name: "Elena Voss", type: "Influencer", audience: "Fashion ecommerce founders on LinkedIn", reach: "28k followers", fit: 80, overlap: 66, rel: 78, reachS: 70, why: "Posts teardown articles about PDP conversion; strong trust." },
      { name: "FitTech Collective", type: "Technology partner", audience: "Sizing & fit tech vendors", reach: "6 partners", fit: 76, overlap: 84, rel: 80, reachS: 40, why: "Complementary sizing data; integration closes the loop." },
      { name: "Retainly Consulting", type: "Consultant", audience: "Returns & retention for apparel", reach: "Solo + 2 associates", fit: 86, overlap: 78, rel: 84, reachS: 38, why: "Advises exactly the brands drowning in returns." },
    ],
    "ai-devtools": [
      { name: "Cortex Devrel", type: "Agency", audience: "AI startup developer marketing", reach: "~15 clients", fit: 84, overlap: 70, rel: 82, reachS: 58, why: "Runs launches for AI startups; natural bundle." },
      { name: "Eval Weekly", type: "Newsletter operator", audience: "9k ML engineers", reach: "9,100 subscribers", fit: 90, overlap: 74, rel: 88, reachS: 66, why: "Niche eval-focused newsletter; high trust with your ICP." },
      { name: "Marcus Chen", type: "Influencer", audience: "AI engineering on X", reach: "61k followers", fit: 78, overlap: 58, rel: 76, reachS: 82, why: "Posts agent-eval threads that drive GitHub traffic." },
      { name: "CI-Platform Co", type: "Technology partner", audience: "CI/CD platform users", reach: "2,400 teams", fit: 72, overlap: 80, rel: 78, reachS: 76, why: "Integration puts you in the workflow where regressions appear." },
    ],
    "accounting-fintech": [
      { name: "Ledger & Lead", type: "Agency", audience: "Bookkeeping firms migrating to automation", reach: "~25 firms", fit: 88, overlap: 82, rel: 86, reachS: 46, why: "Implementer role: they recommend tooling during onboarding." },
      { name: "The Practice Grower", type: "Newsletter operator", audience: "7k accounting firm owners", reach: "7,300 subscribers", fit: 86, overlap: 70, rel: 84, reachS: 52, why: "Firm owners read it for ops efficiency ideas." },
      { name: "TaxFlow Apps", type: "Technology partner", audience: "Practice management suites", reach: "1,100 firms", fit: 74, overlap: 86, rel: 80, reachS: 60, why: "Marketplace listing delivers warm, in-context trials." },
      { name: "Priya Nair", type: "Consultant", audience: "Fractional CFO network", reach: "Independent", fit: 80, overlap: 64, rel: 78, reachS: 34, why: "Recommends tooling to every client for cash-flow ops." },
    ],
  };
  const generic = [
    { name: "Northbeam Advisory", type: "Consultant" as PartnerType, audience: `${icpName} operators`, reach: "Independent", fit: 74, overlap: 60, rel: 72, reachS: 36, why: "Consults inside your ICP on process problems you automate." },
    { name: "Vertical Weekly", type: "Newsletter operator" as PartnerType, audience: `${category} buyers`, reach: "8k subscribers", fit: 70, overlap: 58, rel: 68, reachS: 48, why: "Category newsletter with commercial-intent readership." },
    { name: "GrowthPair", type: "Agency" as PartnerType, audience: "SMB growth services", reach: "~20 clients", fit: 68, overlap: 62, rel: 66, reachS: 44, why: "Agency clients often need your category; referral-ready." },
  ];
  const pool = pools[archetypeId] ?? generic;
  return pool.map((c) => ({
    name: c.name,
    type: c.type,
    audience: c.audience,
    reach: c.reach,
    audienceFit: c.fit,
    customerOverlap: c.overlap,
    relevance: c.rel,
    reachScore: c.reachS,
    partnershipPotential: partnershipPotential(c.fit, c.overlap, c.rel, c.reachS),
    recommendedModel: rankPartnershipModel(c.fit, c.overlap, c.type),
    rationale: c.why,
  })).sort((a, b) => b.partnershipPotential - a.partnershipPotential);
}

export type ProspectRow = Prospect & { sourceOpportunity?: { title: string; url: string | null } | null };
