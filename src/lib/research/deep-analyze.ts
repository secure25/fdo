/**
 * Deep product intelligence — the AI_ANALYZE stage. Re-analyzes a product
 * grounded in REAL evidence gathered by the FETCH_SITE and RESEARCH stages:
 * the product's actual website markdown and real web/Reddit/HN search results.
 * Output merges into the same intelligence shape and is persisted over the
 * baseline analysis; on failure the baseline simply stays.
 */

import { prisma } from "../db";
import { hasAI } from "../env";
import { tryAI, parseJsonLoose } from "../ai/provider";
import {
  deterministicAnalyst,
  mergeLLMIntel,
  type ProductInput,
  type ProductIntelligence,
} from "../engines/product-analyst";
import type { SearchHit } from "./firecrawl";

const WEBSITE_PROMPT_CHARS = 9_000;
const MAX_RESEARCH_LINES = 40;

const DEEP_SYSTEM = `You are a senior product-marketing strategist and market researcher.
You are given:
1. The current product intelligence (baseline) for a SaaS product.
2. The ACTUAL website content of the product (clean markdown).
3. REAL web search results (title + description + source) from Reddit, Hacker News and the general web — these are evidence of what real people say about this problem space, its competitors and its buyers.

Produce upgraded product intelligence that is GROUNDED in this evidence:
- "category": the market category the website actually positions itself in.
- "oneLiner": based on the product's real copy (max 160 chars, no marketing fluff).
- "positioning": one paragraph, evidence-based.
- "problems": the concrete problems the product solves, phrased the way REAL users describe them (borrow phrasing from Reddit/HN results where it fits).
- "useCases": concrete jobs-to-be-done visible on the site.
- "keywords": search terms buyers actually use (from copy + queries the results answer).
- "buyingTriggers": events that make the ICP look for this solution.
- "objections": real objections visible in reviews/comparisons/discussions.
- "icp": the most precise buyer profile the evidence supports.
- "personas": 3 buyer personas, each with a realistic quote in their own voice.
- "competitors": real competitors actually named on the website or appearing in the search results (4-6). Use their real URLs when the evidence shows them; otherwise use "#".
Ground rules: never invent facts the evidence doesn't support; prefer evidence phrasing over generic SaaS language; competitors must be real products.

Return ONLY a JSON object with exactly this shape:
{"category": string, "oneLiner": string, "positioning": string,
 "problems": string[5], "useCases": string[5], "keywords": string[10],
 "buyingTriggers": string[4], "objections": string[3],
 "icp": { "name": string, "description": string, "buyerRole": string, "seniority": string, "companySize": string, "geography": string },
 "personas": [ { "name": string, "role": string, "quote": string, "goals": string[3], "pains": string[3], "wateringHoles": string[3] } ],
 "competitors": [ { "name": string, "url": string, "positioning": string } ]
}`;

export type WebsiteEvidence = { url: string; markdown: string } | null;
export type ResearchEvidence = { results: SearchHit[] } | null;

function researchLines(results: SearchHit[]): string {
  return results
    .slice(0, MAX_RESEARCH_LINES)
    .map((r) => `- [${r.source}] ${r.title} — ${r.description} (${r.url})`)
    .join("\n");
}

export async function deepAnalyzeProduct(opts: {
  orgId: string;
  productId: string;
  website: WebsiteEvidence;
  research: ResearchEvidence;
}): Promise<ProductIntelligence> {
  const product = await prisma.product.findUnique({ where: { id: opts.productId } });
  if (!product) throw new Error("Product not found for deep analysis");

  const input: ProductInput = {
    name: product.name,
    url: product.url,
    description: product.description,
    targetCustomer: product.targetCustomer,
    industry: product.industry,
    geography: product.geography,
    budgetBand: product.budgetBand,
    timePerWeek: product.timePerWeek,
  };
  const base = deterministicAnalyst(input);

  if (!hasAI()) throw new Error("AI not configured — deep analysis unavailable (baseline retained)");

  const sections: string[] = [
    `## Current baseline intelligence\n${JSON.stringify(
      {
        category: base.category,
        oneLiner: base.oneLiner,
        positioning: base.positioning,
        problems: base.problems,
        keywords: base.keywords,
        icp: base.icp.name,
        competitors: base.competitors.map((c) => c.name),
      },
      null,
      1
    )}`,
  ];
  if (opts.website?.markdown) {
    sections.push(`## Product website content (${opts.website.url})\n${opts.website.markdown.slice(0, WEBSITE_PROMPT_CHARS)}`);
  } else {
    sections.push(`## Product website content\n(not available — rely on the description and search results)`);
  }
  if (opts.research?.results?.length) {
    sections.push(`## Real search results (market evidence)\n${researchLines(opts.research.results)}`);
  } else {
    sections.push(`## Real search results\n(none available)`);
  }
  sections.push("Product description (founder-stated):\n" + product.description);

  const intel = await tryAI(
    async (ai) => {
      const text = await ai.complete({
        system: DEEP_SYSTEM,
        messages: [{ role: "user", content: sections.join("\n\n") }],
        temperature: 0.25,
        json: true,
        maxTokens: 2200,
      });
      const parsed = parseJsonLoose<Partial<ProductIntelligence>>(text);
      if (!parsed || !parsed.icp || !Array.isArray(parsed.problems)) return null;
      return mergeLLMIntel(base, parsed, ai.model, input);
    },
    { label: "deep-analyze" }
  );

  if (!intel) throw new Error("Deep analysis failed — model unavailable or unparseable (baseline retained)");
  return intel;
}
