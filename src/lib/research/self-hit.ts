/**
 * Self-hit & namesake suppression for research results.
 *
 * A same-name search hit is NOT automatically the same product — many
 * businesses share names while selling something entirely different. Three
 * layers, from strongest to weakest evidence:
 *
 *  1. Own-domain match (deterministic): a hit on the product's own domain is
 *     the product itself. Always suppressed.
 *  2. Brand-mention pre-filter: only hits that actually mention the product's
 *     brand are worth adjudicating — everything else is third-party by default.
 *  3. LLM adjudication (conservative): a hit is suppressed only when the model
 *     is HIGHLY confident it is either this exact product (SELF) or a different
 *     company that merely shares the name (NAMESAKE). Anything uncertain stays
 *     in the feed — a wrongly suppressed real lead is worse than a namesake.
 */

import { tryAI, parseJsonLoose } from "../ai/provider";
import type { SearchHit } from "./firecrawl";

export type ClassifiedHit = SearchHit & { suppressed?: boolean; suppressionReason?: string };

export type HitClassification = {
  kind: "SELF" | "NAMESAKE" | "OTHER";
  reason: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
};

// ─── Deterministic signals ────────────────────────────────────────────────────

/** Lowercased hostname with a leading "www." stripped. */
export function domainOf(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return "";
  }
}

/** True when the hit lives on the product's own domain (or a subdomain of it). */
export function isOwnSite(hitUrl: string, productUrl: string | null | undefined): boolean {
  if (!productUrl) return false;
  const hit = domainOf(hitUrl);
  const own = domainOf(productUrl);
  if (!hit || !own) return false;
  return hit === own || hit.endsWith(`.${own}`) || own.endsWith(`.${hit}`);
}

const GENERIC_BRAND_WORDS = new Set([
  "app", "software", "platform", "tool", "tools", "tracker", "solutions", "solution",
  "labs", "tech", "inc", "ltd", "llc", "the", "for", "and", "pro", "hq", "cloud", "saas", "ai",
]);

/**
 * Brand tokens for candidate pre-filtering: whole words first (keeping
 * compound brands intact — "GeekBot" → "geekbot"), then camelCase fragments
 * (≥4 chars) as extra candidates. Generic words removed. Over-matching here
 * is safe — the LLM adjudication decides; under-matching would miss self-hits.
 */
export function brandTokens(name: string): string[] {
  const rawWords = name.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  const out = new Set<string>();
  for (const word of rawWords) {
    const lower = word.toLowerCase();
    if (lower.length >= 3 && !GENERIC_BRAND_WORDS.has(lower)) out.add(lower);
    for (const frag of word.replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(/[^a-zA-Z0-9]+/)) {
      const f = frag.toLowerCase();
      if (f.length >= 4 && !GENERIC_BRAND_WORDS.has(f) && f !== lower) out.add(f);
    }
  }
  return Array.from(out);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Hits worth LLM adjudication: they mention the product's brand (full name or
 * any brand token) on a domain that is NOT the product's own.
 */
export function hitMentionsBrand(hit: { title: string; description: string }, name: string): boolean {
  const tokens = brandTokens(name);
  if (tokens.length === 0) return false;
  const text = `${hit.title} ${hit.description}`.replace(/\s+/g, " ").toLowerCase();
  const fullName = name.replace(/\s+/g, " ").trim().toLowerCase();
  if (fullName && text.includes(fullName)) return true;
  return tokens.some((t) => new RegExp(`\\b${escapeRegex(t)}\\b`).test(text));
}

// ─── LLM adjudication ─────────────────────────────────────────────────────────

const CLASSIFY_SYSTEM = `You classify web search results for a SaaS company to protect its leads pipeline.
Given the company's product context and numbered search results (each with title, description and domain), classify every result:
- "SELF": the result is about THIS exact product — its own site/pages/docs, its app-store listings, or listings/press unambiguously describing this same product.
- "NAMESAKE": the result clearly belongs to a DIFFERENT company that happens to share a similar brand name.
- "OTHER": anything else — competitors, market discussions, reviews, comparisons, unrelated content.

Rules:
- A shared or similar brand name alone is NEVER sufficient. Many unrelated businesses share names.
- DIFFERENT DOMAIN, same industry, similar name: this is a NAMESAKE or an OTHER, never SELF, unless the result is unambiguously this company's own page hosted elsewhere (official subdomain, or it quotes the product's own unique positioning verbatim).
- If the hit is on a different domain and you cannot be CERTAIN it is the same company, answer OTHER — a wrongly suppressed real lead is worse than a kept namesake.
- NAMESAKE requires clear evidence of a different company: clearly different industry, different offering, or different audience.
- Community discussions (Reddit, Hacker News, forums) that mention the product are NOT SELF even when they discuss this exact product — they are engagement opportunities: mark OTHER.

Return ONLY JSON: {"classifications": [{"i": <number>, "kind": "SELF"|"NAMESAKE"|"OTHER", "reason": "<short evidence-based reason>", "confidence": "HIGH"|"MEDIUM"|"LOW"}]}`;

const MAX_CLASSIFY_HITS = 25;

/**
 * Classify the given hits via the configured LLM. Returns null when no AI is
 * available or the call fails — callers must then suppress nothing (fail-safe).
 */
export async function classifyResearchHits(
  product: { name: string; url: string | null; description: string; category: string },
  hits: SearchHit[]
): Promise<Map<number, HitClassification> | null> {
  const subset = hits.slice(0, MAX_CLASSIFY_HITS);
  if (subset.length === 0) return new Map();
  const listing = subset
    .map((h, i) => `${i}. [${domainOf(h.url) || "unknown-domain"}] ${h.title} — ${h.description.slice(0, 220)}`)
    .join("\n");
  const user = `Product: ${product.name}
Own domain: ${product.url ? domainOf(product.url) : "unknown"}
Category: ${product.category}
Description: ${product.description}

Search results to classify:
${listing}

Return ONLY the JSON object.`;

  return tryAI(
    async (ai) => {
      const text = await ai.complete({
        system: CLASSIFY_SYSTEM,
        messages: [{ role: "user", content: user }],
        temperature: 0.2,
        json: true,
        maxTokens: 1600,
      });
      const parsed = parseJsonLoose<{ classifications?: { i?: number; kind?: string; reason?: string; confidence?: string }[] }>(text);
      const out = new Map<number, HitClassification>();
      for (const c of parsed?.classifications ?? []) {
        if (typeof c.i !== "number" || c.i < 0 || c.i >= subset.length) continue;
        const kind = c.kind === "SELF" || c.kind === "NAMESAKE" ? c.kind : "OTHER";
        const confidence = c.confidence === "HIGH" || c.confidence === "MEDIUM" ? c.confidence : "LOW";
        out.set(c.i, { kind, reason: typeof c.reason === "string" ? c.reason.slice(0, 200) : "", confidence });
      }
      return out;
    },
    { label: "self-hit-classifier" }
  );
}

/** Suppression rule: only HIGH-confidence SELF or NAMESAKE verdicts suppress a hit. */
export function shouldSuppress(cls: HitClassification | undefined): boolean {
  if (!cls) return false;
  return cls.confidence === "HIGH" && (cls.kind === "SELF" || cls.kind === "NAMESAKE");
}
