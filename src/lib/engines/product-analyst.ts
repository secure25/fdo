/**
 * Product Analyst — turns raw founder input into structured product
 * intelligence (spec §2). Runs the deterministic engine always; when an AI
 * provider is configured, the LLM enriches/overrides the deterministic draft
 * and the deterministic result remains the fallback.
 */

import { detectArchetype, type Archetype } from "./taxonomy";
import { tryAI, parseJsonLoose } from "../ai/provider";
import { hasAI } from "../env";
import { logger } from "../logger";

export type ProductInput = {
  name: string;
  url?: string | null;
  description: string;
  targetCustomer?: string | null;
  industry?: string | null;
  geography?: string | null;
  budgetBand?: string | null;
  timePerWeek?: number | null;
};

export type ProductIntelligence = {
  category: string;
  oneLiner: string;
  positioning: string;
  problems: string[];
  useCases: string[];
  keywords: string[];
  buyingTriggers: string[];
  objections: string[];
  icp: { name: string; description: string; buyerRole: string; seniority: string; companySize: string; geography: string };
  personas: { name: string; role: string; quote: string; goals: string[]; pains: string[]; wateringHoles: string[] }[];
  competitors: { name: string; url: string; positioning: string }[];
  archetypeId: string;
  detectionConfidence: number;
  detectedFrom: string[];
  model: string;
  /** Which fields are user-verified vs machine inference (spec §22/§7). */
  confidence: Record<string, "VERIFIED" | "INFERENCE" | "RECOMMENDATION">;
};

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "your", "are", "from", "into", "our", "app", "software", "tool", "platform", "product", "saas", "build", "built", "helps", "help",
  "without", "within", "their", "there", "these", "those", "them", "they", "have", "has", "had", "was", "were", "will", "would", "could", "should", "can", "may", "might",
  "also", "just", "like", "make", "makes", "made", "uses", "used", "using", "need", "needs", "needed", "want", "gets", "get", "gives", "give", "take", "takes",
  "every", "each", "most", "more", "less", "very", "much", "many", "some", "such", "only", "than", "then", "them", "when", "where", "while", "which", "who", "whom", "whose", "why", "how", "what",
  "generation", "generates", "generate", "existing", "exists", "provide", "provides", "enables", "enable", "allows", "allow", "creates", "create", "designed", "design",
  "cutting", "cuts", "reduce", "reduces", "reducing", "caused", "causes", "cause", "team", "teams", "users", "user", "customers", "customer", "business", "businesses",
  "minutes", "minute", "seconds", "simple", "easy", "easier", "faster", "fast", "better", "best", "great", "good", "new", "old", "own", "one", "two", "three", "all", "any", "not", "but", "its", "it's",
  "integrate", "integrates", "integration", "integrated", "minutes.", "includes", "including", "include", "support", "supports", "powered", "power", "based", "solution", "solutions", "system", "systems",
]);

function extractKeywords(arch: Archetype, input: ProductInput, detected: string[]): string[] {
  const kw = new Set<string>();
  for (const k of arch.keywords) kw.add(k);
  for (const d of detected) kw.add(d.toLowerCase());
  const words = `${input.name} ${input.description} ${input.targetCustomer ?? ""}`.toLowerCase().match(/[a-z][a-z\-]{2,}/g) ?? [];
  for (const w of words) if (!STOPWORDS.has(w) && w.length >= 5) kw.add(w);
  return Array.from(kw).slice(0, 40);
}

/** First sentence of the description, word-boundary truncated — never mid-word. */
export function deriveOneLiner(text: string, cap = 160): string {
  const clean = text.trim().replace(/\s+/g, " ");
  const sentence = clean.match(/^.{10,}?[.!?](\s|$)/)?.[0]?.trim() ?? clean;
  let s = sentence;
  if (s.length > cap) {
    s = s.slice(0, cap);
    const cut = s.lastIndexOf(" ");
    if (cut > cap * 0.6) s = s.slice(0, cut);
    s = s.replace(/[,;:.\-—]+$/, "");
  }
  return s;
}

export function deterministicAnalyst(input: ProductInput): ProductIntelligence {
  const { archetype, confidence, matched } = detectArchetype(
    `${input.name} ${input.description} ${input.industry ?? ""} ${input.targetCustomer ?? ""}`
  );
  const icp = { ...archetype.icp };
  if (input.targetCustomer) {
    icp.name = input.targetCustomer;
    icp.description = `${input.targetCustomer} — refined from the founder's own description`;
  }
  if (input.geography) icp.geography = input.geography;

  const oneLiner = deriveOneLiner(input.description);

  return {
    category: archetype.category,
    oneLiner,
    positioning: `${input.name} is for ${icp.name.toLowerCase()} who struggle with ${archetype.problems[0].toLowerCase()}. Unlike generic ${archetype.category.toLowerCase()} tools, it focuses on the ${icp.buyerRole.toLowerCase()}'s actual workflow.`,
    problems: archetype.problems,
    useCases: archetype.useCases,
    keywords: extractKeywords(archetype, input, matched),
    buyingTriggers: archetype.buyingTriggers,
    objections: archetype.objections,
    icp,
    personas: archetype.personas,
    competitors: archetype.competitors,
    archetypeId: archetype.id,
    detectionConfidence: confidence,
    detectedFrom: matched.slice(0, 10),
    model: "heuristic-v1",
    confidence: {
      category: confidence >= 60 ? "INFERENCE" : "INFERENCE",
      problems: "INFERENCE",
      icp: input.targetCustomer ? "VERIFIED" : "INFERENCE",
      personas: "INFERENCE",
      competitors: "INFERENCE",
      keywords: "INFERENCE",
      positioning: "RECOMMENDATION",
    },
  };
}

const LLM_SYSTEM = `You are the Product Analyst of a customer-acquisition platform for founders.
Given a product description, produce JSON product intelligence.
Rules:
- Ground everything in the description; do not invent facts about the company.
- "verified" marks fields the founder stated; everything derived is "inference".
- Competitors must be real, well-known products in the same space.
- Write like an operator, not a marketer. No buzzwords.
Return JSON exactly shaped as:
{
  "category": string, "oneLiner": string, "positioning": string,
  "problems": string[4], "useCases": string[4], "keywords": string[8-14],
  "buyingTriggers": string[4], "objections": string[3],
  "icp": { "name": string, "description": string, "buyerRole": string, "seniority": string, "companySize": string, "geography": string },
  "personas": [ { "name": string, "role": string, "quote": string, "goals": string[3], "pains": string[3], "wateringHoles": string[3] } ],
  "competitors": [ { "name": string, "url": string, "positioning": string } ]
}`;

/** Full analysis pipeline. AI optional; deterministic always available. */
export async function analyzeProduct(input: ProductInput): Promise<ProductIntelligence> {
  const base = deterministicAnalyst(input);

  if (!hasAI()) return base;

  const enriched = await tryAI(async (ai) => {
    const user = `Product: ${input.name}
URL: ${input.url ?? "unknown"}
Description: ${input.description}
Stated target customer: ${input.targetCustomer ?? "not given"}
Stated industry: ${input.industry ?? "not given"}
Geography: ${input.geography ?? "not given"}

Return ONLY the JSON object.`;
    const text = await ai.complete({
      system: LLM_SYSTEM,
      messages: [{ role: "user", content: user }],
      temperature: 0.3,
      json: true,
      maxTokens: 1500,
    });
    const parsed = parseJsonLoose<Partial<ProductIntelligence>>(text);
    if (!parsed || !parsed.icp || !Array.isArray(parsed.problems)) return null;
    return mergeLLMIntel(base, parsed, ai.model, input);
  }, { label: "product-analyst" });

  return enriched ?? base;
}

/**
 * Merge untrusted LLM output into the deterministic intelligence baseline.
 * Every field is normalized to the intelligence shape so persistence can't
 * crash on missing/null/garbled values. Shared by the onboarding analyst and
 * the deep-research AI_ANALYZE job.
 */
export function mergeLLMIntel(
  base: ProductIntelligence,
  parsed: Partial<ProductIntelligence>,
  model: string,
  input?: ProductInput
): ProductIntelligence {
  const icp = (parsed.icp ?? {}) as Partial<ProductIntelligence["icp"]>;
  return {
    ...base,
    category: strOr(parsed.category, base.category),
    oneLiner: strOr(parsed.oneLiner, base.oneLiner),
    positioning: strOr(parsed.positioning, base.positioning),
    problems: pickArr(parsed.problems, base.problems, 8),
    useCases: pickArr(parsed.useCases, base.useCases, 8),
    keywords: dedupe([...strArr(parsed.keywords).map((s) => s.toLowerCase()), ...base.keywords]).slice(0, 40),
    buyingTriggers: pickArr(parsed.buyingTriggers, base.buyingTriggers, 6),
    objections: pickArr(parsed.objections, base.objections, 6),
    icp: {
      name: strOr(icp.name, base.icp.name),
      description: strOr(icp.description, base.icp.description),
      buyerRole: strOr(icp.buyerRole, base.icp.buyerRole),
      seniority: strOr(icp.seniority, base.icp.seniority),
      companySize: strOr(icp.companySize, base.icp.companySize),
      geography: strOr(icp.geography, base.icp.geography),
    },
    personas: pickPersonas(parsed.personas, base.personas),
    competitors: pickCompetitors(parsed.competitors, base.competitors),
    archetypeId: base.archetypeId, // keep taxonomy link for discovery routing
    detectionConfidence: Math.max(base.detectionConfidence, 80),
    model,
    confidence: {
      ...base.confidence,
      category: "INFERENCE",
      icp: input?.targetCustomer ? "VERIFIED" : "INFERENCE",
    },
  };
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr.map((s) => String(s).toLowerCase().trim()).filter(Boolean)));
}

// ─── LLM output normalization helpers ─────────────────────────────────────────

function strOr(v: unknown, fallback: string): string {
  const s = typeof v === "string" ? v.trim() : "";
  return s && s.toLowerCase() !== "null" ? s : fallback;
}

function strArr(v: unknown, cap = 24): string[] {
  if (!Array.isArray(v)) return [];
  return Array.from(
    new Set(v.map((s) => String(s).trim()).filter((s) => s.length > 0 && s.toLowerCase() !== "null"))
  ).slice(0, cap);
}

function pickArr(v: unknown, fallback: string[], cap: number): string[] {
  const arr = strArr(v, cap);
  return arr.length ? arr : fallback;
}

function pickPersonas(raw: unknown, base: ProductIntelligence["personas"]): ProductIntelligence["personas"] {
  if (!Array.isArray(raw) || raw.length === 0) return base;
  const out = raw.slice(0, 5).map((p, i) => {
    const o = (p ?? {}) as Record<string, unknown>;
    const name = strOr(o.name, `Persona ${i + 1}`);
    return {
      name,
      role: strOr(o.role, "Decision maker"),
      quote: strOr(o.quote, `We need a better way to handle this today.`),
      goals: strArr(o.goals, 5),
      pains: strArr(o.pains, 5),
      wateringHoles: strArr(o.wateringHoles, 6),
    };
  });
  return out.length ? out : base;
}

function pickCompetitors(raw: unknown, base: ProductIntelligence["competitors"]): ProductIntelligence["competitors"] {
  if (!Array.isArray(raw) || raw.length === 0) return base;
  const out = raw
    .slice(0, 6)
    .map((c) => {
      const o = (c ?? {}) as Record<string, unknown>;
      const name = strOr(o.name, "");
      if (!name) return null;
      const url = String(o.url ?? "").trim();
      return {
        name,
        url: /^https?:\/\//.test(url) ? url : "#",
        positioning: strOr(o.positioning, "Alternative solution"),
      };
    })
    .filter((c): c is ProductIntelligence["competitors"][number] => c !== null);
  return out.length ? out : base;
}

/** Keyword overlap helper used by scoring + prospecting. */
export function icpEvidence(text: string, intel: Pick<ProductIntelligence, "keywords" | "icp">): string[] {
  const lower = text.toLowerCase();
  return intel.keywords.filter((k) => k.length >= 4 && lower.includes(k.toLowerCase())).slice(0, 8);
}

export function logAnalysis(intel: ProductIntelligence) {
  logger.info("product analyzed", { category: intel.category, model: intel.model, confidence: intel.detectionConfidence });
}
