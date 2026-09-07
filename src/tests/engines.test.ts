import { describe, expect, it } from "vitest";
import { computeHealth } from "@/lib/engines/health";
import { buildPriorities } from "@/lib/engines/priorities";
import { conclude, computeFunnel } from "@/lib/engines/experiments";
import { deriveInsights } from "@/lib/engines/learning";
import { buildChannelFunnel, channelVerdict } from "@/lib/engines/roi";

describe("Distribution health (spec §12)", () => {
  it("flags intent capture as weakest when the founder creates content but ignores high-intent threads", () => {
    const result = computeHealth({
      hasIcp: true,
      hasPersonas: true,
      keywordCount: 20,
      topChannelOpportunity: 84,
      highIntentNew: 14,
      actedOnHighIntent: 2,
      contentDrafts: 4,
      contentPublished: 3,
      contentEngagements: 200,
      prospectsContacted: 9,
      prospectsTotal: 14,
      followUpsDue: 0,
      partnershipOpportunities: 5,
      partnershipsActed: 4,
      seoAssets: 3,
      signupCount: 25,
      customerCount: 9,
      experimentsRunning: 1,
    });
    expect(result.score).toBeGreaterThan(60);
    expect(result.score).toBeLessThan(95);
    expect(result.weakest.key).toBe("intentCapture");
    expect(result.weakest.diagnosis).toContain("intent capture");
  });
});

describe("Command center priorities (spec §11)", () => {
  it("builds a ranked, time-boxed plan", () => {
    const { priorities, totalMinutes } = buildPriorities({
      topReplyTargets: [
        { id: "1", title: "Looking for an affordable virtual try-on", platform: "REDDIT", communityName: "r/shopify", score: 96, effortMinutes: 7, band: "VERY_HIGH" },
        { id: "2", title: "Alternative to Botika?", platform: "REDDIT", communityName: "r/ecommerce", score: 91, effortMinutes: 8, band: "HIGH" },
        { id: "3", title: "URGENT images needed", platform: "REDDIT", communityName: "r/fashionbusiness", score: 95, effortMinutes: 6, band: "VERY_HIGH" },
      ],
      contactTargets: Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, company: null, icpFit: 90, intentScore: 80 })),
      followUps: [],
      readyDrafts: [{ id: "c1", title: "Sizing uncertainty post", channel: "LINKEDIN" }],
      partnershipTargets: [{ id: "pt1", name: "Studio Mera", type: "Agency", potential: 88 }],
      stats: { newOpportunities: 23, highIntent: 7, urgent: 3, partnerships: 2, readyDrafts: 1 },
    });
    expect(priorities[0]!.title).toContain("Reply to 3");
    expect(priorities[0]!.minutes).toBe(21);
    expect(priorities.some((p) => p.title.startsWith("Contact 5"))).toBe(true);
    expect(priorities.some((p) => p.title.startsWith("Publish prepared"))).toBe(true);
    expect(totalMinutes).toBe(priorities.reduce((s, p) => s + p.minutes, 0));
    expect(priorities.map((p) => p.rank)).toEqual([1, 2, 3, 4]);
  });
});

describe("Experiment engine (spec §13)", () => {
  it("computes the Reddit vs LinkedIn conclusion with an efficiency multiple", () => {
    const reddit = computeFunnel({ channel: "Reddit", opportunities: 14, engagements: 40, clicks: 27, signups: 11, activations: 6, customers: 4, revenueCents: 39600, hoursInvested: 6.5 });
    const linkedin = computeFunnel({ channel: "LinkedIn", opportunities: 31, engagements: 130, clicks: 92, signups: 14, activations: 7, customers: 1, revenueCents: 9900, hoursInvested: 8 });
    const conclusion = conclude(reddit, linkedin);
    expect(conclusion.winner).toBe("Reddit");
    expect(conclusion.efficiencyMultiple).toBeGreaterThan(3);
    expect(conclusion.recommendation).toMatch(/Reddit currently produces customers \d+\.\d× more efficiently than LinkedIn/);
  });

  it("recommends more signal collection when there are no customers", () => {
    const a = computeFunnel({ channel: "A", opportunities: 5, engagements: 2, clicks: 1, signups: 0, activations: 0, customers: 0, revenueCents: 0, hoursInvested: 2 });
    const b = computeFunnel({ channel: "B", opportunities: 5, engagements: 2, clicks: 1, signups: 0, activations: 0, customers: 0, revenueCents: 0, hoursInvested: 2 });
    const conclusion = conclude(a, b);
    expect(conclusion.winner).toBeNull();
    expect(conclusion.recommendation).toContain("Not enough signal");
  });
});

describe("Learning engine (spec §14)", () => {
  it("derives the what-works-for-whom-where insight from the spec example", () => {
    const { insights, bestCombo } = deriveInsights([
      { channel: "LinkedIn", topic: "Return reduction", format: "Educational", icpTag: "Fashion ecommerce", metrics: { impressions: 2400, engagements: 94, clicks: 31, signups: 8, customers: 3, revenueCents: 29700 } },
      { channel: "LinkedIn", topic: "Product launch promo", format: "Promotional", icpTag: "Fashion ecommerce", metrics: { impressions: 1100, engagements: 12, clicks: 4, signups: 0, customers: 0 } },
      { channel: "Reddit", topic: "Returns reduction", format: "REPLY", icpTag: "Fashion ecommerce", metrics: { impressions: 1420, engagements: 40, clicks: 27, signups: 6, customers: 2 } },
      { channel: "TikTok", topic: "Behind the scenes", format: "Video", icpTag: "Broad", metrics: { impressions: 8000, engagements: 120, clicks: 9, signups: 0, customers: 0 } },
    ]);
    expect(insights.some((i) => i.dimension === "CHANNEL" && i.statement.includes("LinkedIn"))).toBe(true);
    expect(insights.some((i) => i.dimension === "TOPIC")).toBe(true);
    expect(insights.some((i) => i.dimension === "WHY" && i.statement.includes("TikTok"))).toBe(true);
    expect(bestCombo).toEqual({ topic: "Return reduction", format: "Educational", icp: "Fashion ecommerce", channel: "LinkedIn" });
  });
});

describe("ROI engine (spec §15)", () => {
  it("ranks Reddit above LinkedIn on the spec funnel numbers", () => {
    const reddit = buildChannelFunnel({ channel: "Reddit", impressions: 1420, visits: 27, signups: 11, activations: 6, customers: 4, mrrCents: 39600, revenueCents: 39600, spendCents: 0 });
    const linkedin = buildChannelFunnel({ channel: "LinkedIn", impressions: 12400, visits: 92, signups: 14, activations: 7, customers: 1, mrrCents: 9900, revenueCents: 9900, spendCents: 0 });
    const verdict = channelVerdict([linkedin, reddit]);
    expect(verdict).toContain("Reddit is currently the stronger acquisition channel");
    expect(reddit.customerRate).toBeGreaterThan(linkedin.customerRate);
  });
});
