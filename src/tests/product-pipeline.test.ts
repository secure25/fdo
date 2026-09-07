import { describe, expect, it } from "vitest";
import { analyzeProduct, icpEvidence, type ProductIntelligence } from "@/lib/engines/product-analyst";
import { buildDistributionMap } from "@/lib/engines/distribution-map";
import { generateSandboxCandidates } from "@/lib/discovery/sandbox-templates";
import { classifyIntent } from "@/lib/engines/intent";
import { classifyIntentAndScore, type PipelineResult } from "./helpers";

describe("Product analyst — unknown SaaS (spec §18)", () => {
  it("independently derives ICP, buyer, keywords and competitors for InvoicePilot", async () => {
    const intel = await analyzeProduct({
      name: "InvoicePilot",
      description:
        "InvoicePilot is invoice automation for accounting firms. It captures client invoices, codes them to the right ledger, and chases missing documents automatically — replacing manual data entry during tax season.",
      geography: "US",
    });

    expect(intel.archetypeId).toBe("accounting-fintech");
    expect(intel.icp.name.toLowerCase()).toContain("accounting");
    expect(intel.icp.buyerRole.toLowerCase()).toContain("partner");
    expect(intel.keywords).toContain("invoice");
    expect(intel.competitors.length).toBeGreaterThanOrEqual(2);
    expect(intel.problems.length).toBeGreaterThanOrEqual(3);
    expect(Object.values(intel.confidence)).toContain("INFERENCE");
  });

  it("falls back to the generic archetype for unrecognizable products", async () => {
    const intel = await analyzeProduct({
      name: "MysteryApp",
      description: "A helpful application that makes teams happier and more productive in an unusual way.",
    });
    expect(intel.archetypeId).toBe("generic");
    expect(intel.icp.buyerRole).toBeTruthy();
  });

  it("marks user-stated ICP as verified and detects fashion ecommerce", async () => {
    const intel = await analyzeProduct({
      name: "Atelier",
      description: "Virtual try-on for online fashion retailers, reduces clothing returns from sizing uncertainty.",
      targetCustomer: "Online fashion retailers",
    });
    expect(intel.confidence.icp).toBe("VERIFIED");
    expect(intel.archetypeId).toBe("fashion-ecommerce");
    expect(icpEvidence("our shopify returns are killing margins", intel).length).toBeGreaterThan(0);
  });
});

describe("Distribution map (spec §3)", () => {
  const intel = {
    category: "AI fashion technology",
    archetypeId: "fashion-ecommerce",
    keywords: ["try-on"],
    problems: ["returns"],
    icp: { name: "Online fashion retailers", description: "", buyerRole: "", seniority: "", companySize: "", geography: "" },
  } as unknown as ProductIntelligence;

  it("scores Reddit as a very-high-opportunity channel with actionable strategy", () => {
    const map = buildDistributionMap(intel, { budgetBand: "LEAN", timePerWeek: 8 });
    const reddit = map.find((c) => c.name === "Reddit")!;
    expect(reddit.icpFit).toBeGreaterThanOrEqual(75);
    expect(reddit.opportunity).toBe("VERY_HIGH");
    expect(reddit.strategy).toContain("genuinely");
    expect(map[0]!.rank).toBe(1);
  });

  it("ranks consumer channels below operator channels for this B2B product", () => {
    const map = buildDistributionMap(intel, {});
    const tiktok = map.find((c) => c.name === "TikTok")!;
    const reddit = map.find((c) => c.name === "Reddit")!;
    expect(tiktok.rank).toBeGreaterThan(reddit.rank);
  });
});

describe("Discovery pipeline", () => {
  it("produces sandbox candidates with unique ids and spec example content", () => {
    const candidates = generateSandboxCandidates("fashion-ecommerce", {
      productName: "Atelier",
      icpName: "online fashion retailers",
      keywords: ["try-on"],
    });
    expect(candidates.length).toBeGreaterThanOrEqual(6);
    const ids = new Set(candidates.map((c) => c.externalId));
    expect(ids.size).toBe(candidates.length);
    const flagship = candidates.find((c) => c.title.startsWith("Looking for an affordable virtual try-on"));
    expect(flagship).toBeTruthy();
    expect(classifyIntent(flagship!.title, flagship!.body).intentType).toBe("ACTIVE_BUYING");
  });

  it("runs the scoring pipeline over candidates without a database", () => {
    const candidates = generateSandboxCandidates("accounting-fintech", {
      productName: "InvoicePilot",
      icpName: "accounting firms",
      keywords: ["invoice"],
    });
    const results: PipelineResult[] = candidates.map((c) =>
      classifyIntentAndScore(c, { keywords: ["invoice", "bookkeeping"], problems: ["Manual invoice data entry"], category: "accounting automation" })
    );
    expect(results.length).toBe(candidates.length);
    const active = results.find((r) => r.intentType === "ACTIVE_BUYING");
    expect(active).toBeTruthy();
    expect(active!.score).toBeGreaterThan(55);
    expect(active!.explanation.what).toBeTruthy();
    expect(active!.explanation.whyMatters.length).toBeGreaterThan(0);
  });
});
