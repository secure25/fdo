/**
 * Intent Engine — classifies raw posts into intent types and extracts signals.
 * Deterministic, explainable, zero-cost. LLM enrichment is layered on top
 * elsewhere; this engine always runs first and is the source of truth for
 * matched phrases.
 */

import { INTENT_PATTERNS, KNOWN_TOOL_NAMES, type IntentType } from "./taxonomy";

export type ExtractedSignal = {
  kind: "INTENT_PHRASE" | "ICP_EVIDENCE" | "COMPETITOR_MENTION" | "PRICE_SIGNAL" | "URGENCY" | "TECH_STACK" | "PARTNER_SIGNAL";
  phrase: string;
  weight: number;
};

export type IntentResult = {
  intentType: IntentType;
  buyingIntent: number; // 0-100
  signals: ExtractedSignal[];
  competitorName: string | null;
  matchedPhrases: string[];
};

const TECH_TOKENS = ["shopify", "woocommerce", "magento", "bigcommerce", "wordpress", "squarespace", "wix", "quickbooks", "xero", "klaviyo", "stripe", "react", "next.js", "python", "rails", "aws", "gcp"];

export function classifyIntent(title: string, body: string): IntentResult {
  const text = `${title}\n${body}`;
  const signals: ExtractedSignal[] = [];
  const matchedPhrases: string[] = [];

  let bestIntent: IntentType = "PROBLEM_AWARENESS";
  let bestBase = 35;
  let competitorName: string | null = null;

  for (const p of INTENT_PATTERNS) {
    const m = text.match(p.re);
    if (!m) continue;
    const phrase = m[0].trim().slice(0, 120);
    matchedPhrases.push(phrase);
    if (p.signal === "INTENT_PHRASE") signals.push({ kind: "INTENT_PHRASE", phrase, weight: p.base });
    if (p.signal === "PRICE_SIGNAL") signals.push({ kind: "PRICE_SIGNAL", phrase, weight: 70 });
    if (p.signal === "URGENCY") signals.push({ kind: "URGENCY", phrase, weight: 80 });
    if (p.signal === "PARTNER_SIGNAL") signals.push({ kind: "PARTNER_SIGNAL", phrase, weight: 60 });
    if (!p.signalOnly && p.base > bestBase) {
      bestBase = p.base;
      bestIntent = p.intent;
    }
    if (p.signal === "COMPETITOR_MENTION" && !competitorName) {
      const cap = text.match(/alternative to ([A-Za-z0-9\.\- ]{2,30})/i) || text.match(/(?:from|left|with) ([A-Z][A-Za-z0-9\.\-]{2,20})\b/);
      if (cap) competitorName = cap[1]!.trim();
    }
  }

  // Known tool mentions -> competitor mention signal
  if (!competitorName) {
    for (const tool of KNOWN_TOOL_NAMES) {
      if (new RegExp(`\\b${tool}\\b`, "i").test(text)) {
        competitorName = tool.charAt(0).toUpperCase() + tool.slice(1);
        signals.push({ kind: "COMPETITOR_MENTION", phrase: tool, weight: 55 });
        break;
      }
    }
  }

  // Tech-stack evidence strengthens ICP fit downstream
  for (const t of TECH_TOKENS) {
    if (new RegExp(`\\b${t}\\b`, "i").test(text)) {
      signals.push({ kind: "TECH_STACK", phrase: t, weight: 60 });
    }
  }

  // Urgent phrases stack on top of the primary intent
  if (bestIntent !== "URGENT_NEED" && signals.some((s) => s.kind === "URGENCY")) {
    bestBase = Math.min(96, bestBase + 10);
  }
  // Price pressure stacks intent without changing the type
  if (bestIntent !== "VENDOR_COMPARISON" && signals.some((s) => s.kind === "PRICE_SIGNAL")) {
    bestBase = Math.min(96, bestBase + 8);
  }

  // Multiple distinct intent phrases compound confidence
  const phraseCount = signals.filter((s) => s.kind === "INTENT_PHRASE").length;
  if (phraseCount > 1) bestBase = Math.min(97, bestBase + 4 * (phraseCount - 1));

  return {
    intentType: bestIntent,
    buyingIntent: Math.round(Math.min(98, bestBase)),
    signals,
    competitorName,
    matchedPhrases,
  };
}

/** How well a post matches the product's problem space. 0-100. */
export function problemMatchScore(
  title: string,
  body: string,
  product: { keywords: string[]; problems: string[]; category: string }
): { score: number; evidence: string[] } {
  const text = `${title} ${body}`.toLowerCase();
  const evidence: string[] = [];
  let score = 20; // baseline: same channel as ICP
  for (const kw of product.keywords) {
    if (kw.length < 3) continue;
    if (text.includes(kw.toLowerCase())) {
      score += kw.length > 6 ? 9 : 6;
      evidence.push(kw);
    }
  }
  const categoryWords = product.category.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  for (const w of categoryWords) {
    if (text.includes(w)) {
      score += 5;
      if (!evidence.includes(w)) evidence.push(w);
    }
  }
  for (const problem of product.problems) {
    const words = problem.toLowerCase().split(/\W+/).filter((w) => w.length > 4);
    const hits = words.filter((w) => text.includes(w)).length;
    if (hits >= 2) {
      score += 12;
      evidence.push(problem.slice(0, 60));
    }
  }
  return { score: Math.min(100, score), evidence };
}

export { type IntentType };
