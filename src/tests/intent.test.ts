import { describe, expect, it } from "vitest";
import { classifyIntent, problemMatchScore } from "@/lib/engines/intent";

describe("Intent engine (spec §4)", () => {
  it("classifies the canonical intent phrases", () => {
    const cases: [string, string][] = [
      ["Looking for an affordable virtual try-on solution for Shopify.", "ACTIVE_BUYING"],
      ["Is there an alternative to Botika that works with flat lays?", "VENDOR_COMPARISON"],
      ["Does anyone know a tool for automating invoice capture?", "RECOMMENDATION_REQUEST"],
      ["How do I improve PDP conversion?", "PROBLEM_AWARENESS"],
      ["Anyone tried the AI tools in this space?", "SOLUTION_RESEARCH"],
      ["I need software that handles on-model imagery.", "ACTIVE_BUYING"],
      ["I wish there was a cheaper way to do this.", "PROBLEM_AWARENESS"],
      ["We switched away from 3DLOOK last week — frustrated with pricing.", "COMPETITOR_DISSATISFACTION"],
      ["URGENT: need on-model images by Friday.", "URGENT_NEED"],
      ["Agency owner here — want to partner up on a referral arrangement.", "PARTNERSHIP_OPPORTUNITY"],
    ];
    for (const [text, intent] of cases) {
      const result = classifyIntent(text, "");
      expect(result.intentType, `"${text}"`).toBe(intent);
    }
  });

  it("extracts intent phrases and signals with weights", () => {
    const result = classifyIntent("Looking for a tool — urgent, need it by Friday", "I need software that integrates with Shopify. Any recommendations?");
    expect(result.matchedPhrases.length).toBeGreaterThanOrEqual(2);
    expect(result.signals.some((s) => s.kind === "URGENCY")).toBe(true);
    expect(result.buyingIntent).toBeGreaterThanOrEqual(85);
    expect(result.signals.some((s) => s.kind === "TECH_STACK" && s.phrase === "shopify")).toBe(true);
  });

  it("defaults to problem awareness with a low base when nothing matches", () => {
    const result = classifyIntent("Beautiful weather today", "Nothing relevant here.");
    expect(result.intentType).toBe("PROBLEM_AWARENESS");
    expect(result.buyingIntent).toBeLessThanOrEqual(40);
    expect(result.matchedPhrases).toHaveLength(0);
  });

  it("scores problem match using product keywords and problems", () => {
    const product = {
      keywords: ["virtual try-on", "shopify", "returns"],
      problems: ["High return rates from sizing uncertainty"],
      category: "AI fashion technology",
    };
    const good = problemMatchScore(
      "Looking for virtual try-on for Shopify",
      "Our return rates are terrible, mostly sizing uncertainty.",
      product
    );
    const bad = problemMatchScore("Best pizza toppings?", "Deep dish vs thin crust discussion.", product);
    expect(good.score).toBeGreaterThan(40);
    expect(good.evidence.length).toBeGreaterThan(0);
    expect(bad.score).toBeLessThan(35);
  });
});
