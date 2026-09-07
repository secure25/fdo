import { describe, expect, it } from "vitest";
import { scoreOpportunity, bandOf, recencyScore, competitionScore, effortMinutes, buildExplanation } from "@/lib/engines/scoring";

describe("Opportunity Scorer (spec §5)", () => {
  it("scores the flagship spec example at 96 with the documented sub-scores", () => {
    const { score, band } = scoreOpportunity({
      icpMatch: 98,
      problemMatch: 97,
      buyingIntent: 94,
      recency: 99,
      competition: 31,
      engagementPotential: 89,
    });
    expect(score).toBe(96);
    expect(band).toBe("VERY_HIGH");
  });

  it("produces the full band ladder", () => {
    expect(bandOf(96)).toBe("VERY_HIGH");
    expect(bandOf(80)).toBe("HIGH");
    expect(bandOf(60)).toBe("MEDIUM");
    expect(bandOf(30)).toBe("LOW");
  });

  it("decays recency monotonically", () => {
    const fresh = recencyScore(1);
    const day = recencyScore(24);
    const week = recencyScore(24 * 7);
    expect(fresh).toBeGreaterThan(day);
    expect(day).toBeGreaterThan(week);
    expect(week).toBeGreaterThanOrEqual(4);
  });

  it("raises competition with vendor replies", () => {
    const quiet = competitionScore({ replyCount: 0, vendorMentions: 0, platformBase: 35 });
    const crowded = competitionScore({ replyCount: 10, vendorMentions: 2, platformBase: 35 });
    expect(crowded).toBeGreaterThan(quiet);
    expect(crowded).toBeLessThanOrEqual(100);
  });

  it("caps effort at 30 minutes and scales with body length", () => {
    expect(effortMinutes("ACTIVE_BUYING", 200)).toBeLessThan(effortMinutes("ACTIVE_BUYING", 4000));
    expect(effortMinutes("ACTIVE_BUYING", 100_000)).toBe(30);
    expect(effortMinutes("PARTNERSHIP_OPPORTUNITY", 0)).toBe(25);
  });

  it("builds a complete explanation with all four required parts (spec §5)", () => {
    const e = buildExplanation({
      title: "Looking for an affordable virtual try-on solution for Shopify.",
      platform: "REDDIT",
      community: "r/shopify",
      ageHours: 3,
      intentType: "ACTIVE_BUYING",
      subs: { icpMatch: 98, problemMatch: 97, buyingIntent: 94, recency: 99, competition: 31, engagementPotential: 89 },
      score: 96,
      band: "VERY_HIGH",
      matchedPhrases: ["Looking for an affordable"],
      evidence: ["virtual try-on", "Shopify"],
      authorName: "meredith_lou",
    });
    expect(e.what).toContain("r/shopify");
    expect(e.whyMatters.length).toBeGreaterThan(0);
    expect(e.whyYou.length).toBeGreaterThan(0);
    expect(e.nextAction).toContain("genuinely");
    expect(e.nextAction.toLowerCase()).toContain("disclose");
  });

  it("says don't-pitch-yet for awareness-stage opportunities (spec §10)", () => {
    const e = buildExplanation({
      title: "Our clothing returns are killing margins.",
      platform: "LINKEDIN",
      community: "LinkedIn",
      ageHours: 12,
      intentType: "PROBLEM_AWARENESS",
      subs: { icpMatch: 98, problemMatch: 96, buyingIntent: 55, recency: 90, competition: 33, engagementPotential: 80 },
      score: 80,
      band: "HIGH",
      matchedPhrases: [],
      evidence: ["returns"],
    });
    expect(e.caution).toBeTruthy();
    expect(e.caution!.toUpperCase()).toContain("DON'T PITCH");
  });
});
