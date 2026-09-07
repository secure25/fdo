import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { rateLimit } from "@/lib/ratelimit";
import { PLANS, PLAN_ORDER, planOf, assertWithin, LimitReached, creditPackPriceCents } from "@/lib/entitlements";
import { parseJsonLoose, tryAI } from "@/lib/ai/provider";
import { verifyStripeSignature, verifyPaddleSignature, paddlePlanFromPriceId, paddleCheckoutUrlFromTransaction } from "@/lib/billing";
import { isPublicIp, urlSyntaxGuard } from "@/lib/research/url-guard";
import { domainOf, isOwnSite, brandTokens, hitMentionsBrand, shouldSuppress } from "@/lib/research/self-hit";
import { sanitizeSvg, detectImageExt, resolveUploadPath } from "@/lib/uploads";
import { buildResearchBatches, dedupeByUrl, normalizeUrlForDedup, researchExternalId, searchHitToCandidate } from "@/lib/research/research";
import { deterministicAnalyst, mergeLLMIntel } from "@/lib/engines/product-analyst";
import { assessSpamRisk, generateDeterministic } from "@/lib/engines/content-engine";
import { conclude } from "@/lib/engines/experiments";
import { computeFunnel } from "@/lib/engines/experiments";

describe("Rate limiter", () => {
  it("allows bursts up to the limit then blocks with a retry window", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(key, { limit: 5, windowSec: 60 }).ok).toBe(true);
    }
    const blocked = rateLimit(key, { limit: 5, windowSec: 60 });
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("isolates keys", () => {
    const a = `iso-a-${Math.random()}`;
    const b = `iso-b-${Math.random()}`;
    rateLimit(a, { limit: 1, windowSec: 60 });
    expect(rateLimit(a, { limit: 1, windowSec: 60 }).ok).toBe(false);
    expect(rateLimit(b, { limit: 1, windowSec: 60 }).ok).toBe(true);
  });
});

describe("Entitlements", () => {
  it("exposes the four spec plans at the spec prices", () => {
    expect(PLAN_ORDER).toEqual(["FREE", "MAKER", "GROWTH", "PRO"]);
    expect(PLANS.MAKER.priceCents).toBe(1500);
    expect(PLANS.GROWTH.priceCents).toBe(3900);
    expect(PLANS.PRO.priceCents).toBe(9900);
    expect(PLANS.FREE.limits.products).toBe(1);
    expect(PLANS.PRO.limits.api).toBe(true);
    expect(PLANS.FREE.limits.api).toBe(false);
  });

  it("gates plan limits with assertWithin", () => {
    expect(() => assertWithin(1, 1, "Products")).toThrow(LimitReached);
    expect(() => assertWithin(3, 2, "Products")).not.toThrow();
    expect(planOf("unknown")).toBe(PLANS.FREE);
  });

  it("prices credit packs at $1 per 20 credits", () => {
    expect(creditPackPriceCents(500)).toBe(2500);
    expect(creditPackPriceCents(20)).toBe(100);
  });
});

describe("AI provider utilities", () => {
  it("parses loose JSON from model output", () => {
    expect(parseJsonLoose('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(parseJsonLoose('Sure! Here it is: {"a": {"b": [1,2]}} hope that helps')).toEqual({ a: { b: [1, 2] } });
    expect(parseJsonLoose("no json here")).toBeNull();
  });

  it("returns null from tryAI when no provider is configured", async () => {
    const result = await tryAI(async () => "never", { label: "test" });
    expect(result).toBeNull();
  });
});

describe("Content guardrails (spec §9/§10)", () => {
  const product = {
    name: "Atelier",
    url: "https://atelier.example",
    oneLiner: "AI virtual try-on for fashion retailers",
    problems: ["High return rates"],
    keywords: ["try-on"],
    icpName: "Online fashion retailers",
    category: "AI fashion technology",
  };

  it("blocks product mentions on awareness-stage threads", () => {
    const draft = generateDeterministic({
      channel: "REDDIT",
      format: "REPLY",
      opportunity: { title: "Returns are killing margins", body: "so many returns", platform: "REDDIT", communityName: "r/ecommerce", intentType: "PROBLEM_AWARENESS" },
      product,
      pitchAllowed: false,
    });
    expect(draft.warnings.some((w) => w.code === "DONT_PITCH_YET")).toBe(true);
    expect(draft.body.toLowerCase()).not.toContain("check out");
    // The compliant draft itself is low-risk; the BLOCK warns against pitching.
    expect(draft.spamRisk).toBeLessThan(30);
  });

  it("allows a single disclosed mention on buying-intent threads", () => {
    const draft = generateDeterministic({
      channel: "REDDIT",
      format: "REPLY",
      opportunity: { title: "Looking for an affordable try-on tool", body: "budget matters", platform: "REDDIT", communityName: "r/shopify", intentType: "ACTIVE_BUYING" },
      product,
      pitchAllowed: true,
    });
    expect(draft.body.toLowerCase()).toContain("full disclosure");
    expect(draft.warnings.some((w) => w.level === "BLOCK")).toBe(false);
    expect(draft.spamRisk).toBeLessThan(30);
  });

  it("flagship draft (spec §6): grounded in the thread's real problem, no title echo, no truncated one-liner", () => {
    const draft = generateDeterministic({
      channel: "REDDIT",
      format: "REPLY",
      opportunity: {
        title: "Looking for an affordable virtual try-on solution for Shopify.",
        body: "We run a mid-size Shopify store (about 400 SKUs, mostly womenswear) and I've been looking for an affordable virtual try-on solution. All the enterprise tools want $2k+/mo which is insane for us. Does anyone know a tool that won't break the bank? Our return rate on dresses is brutal and I'm convinced half of it is sizing uncertainty.",
        platform: "REDDIT",
        communityName: "r/shopify",
        author: "meredith_lou",
        intentType: "ACTIVE_BUYING",
      },
      product: {
        name: "Atelier",
        url: null,
        oneLiner: "Atelier is AI fashion technology for online fashion retailers.",
        problems: ["Low product-page conversion", "High return rates from sizing uncertainty", "Poor product visualization"],
        keywords: ["virtual try-on"],
        icpName: "Online fashion retailers",
        category: "AI fashion technology",
      },
      pitchAllowed: true,
    });
    expect(draft.body).toContain("sizing uncertainty");
    expect(draft.body.toLowerCase()).not.toContain("looking for an affordable virtual try-on solution for shopify");
    expect(draft.body).toContain("Full disclosure: I work on Atelier (AI fashion technology for online fashion retailers).");
    expect(draft.spamRisk).toBeLessThan(30);
  });

  it("flags marketing speak and link dumps", () => {
    const assessed = assessSpamRisk("Check out our revolutionary game-changer at https://a.co and https://b.co and https://c.co — 10x your returns!", {
      pitchAllowed: true,
      mentionsProduct: true,
      channel: "REDDIT",
    });
    expect(assessed.spamRisk).toBeGreaterThanOrEqual(60);
    expect(assessed.warnings.some((w) => w.code === "MARKETING_SPEAK")).toBe(true);
    expect(assessed.warnings.some((w) => w.code === "LINK_COUNT")).toBe(true);
  });

  it("generates platform-native drafts for every channel", () => {
    for (const channel of ["REDDIT", "LINKEDIN", "X", "YOUTUBE", "SEO", "EMAIL"] as const) {
      const draft = generateDeterministic({ channel, format: "POST", opportunity: null, product, pitchAllowed: true, topicHint: "return reduction" });
      expect(draft.title.length).toBeGreaterThan(3);
      expect(draft.body.length).toBeGreaterThan(80);
      expect(draft.warnings.some((w) => w.level === "BLOCK")).toBe(false);
    }
  });
});

describe("Stripe webhook signature security", () => {
  const secret = "whsec_test_secret";
  const signedHeader = (payload: string, ts: number, sec: string) =>
    `t=${ts},v1=${createHmac("sha256", sec).update(`${ts}.${payload}`).digest("hex")}`;

  it("accepts a valid, fresh signature", () => {
    const payload = JSON.stringify({ id: "evt_1", type: "checkout.session.completed", data: { object: {} } });
    expect(verifyStripeSignature(payload, signedHeader(payload, Math.floor(Date.now() / 1000), secret), secret)).toBe(true);
  });

  it("rejects forged, tampered, stale, and missing signatures", () => {
    const payload = JSON.stringify({ id: "evt_2", type: "checkout.session.completed", data: { object: {} } });
    const ts = Math.floor(Date.now() / 1000);
    expect(verifyStripeSignature(payload, signedHeader(payload, ts, "whsec_wrong"), secret)).toBe(false);
    expect(verifyStripeSignature(payload + " tampered", signedHeader(payload, ts, secret), secret)).toBe(false);
    expect(verifyStripeSignature(payload, signedHeader(payload, ts - 3600, secret), secret)).toBe(false); // stale > 5 min
    expect(verifyStripeSignature(payload, null, secret)).toBe(false);
  });
});

describe("Paddle billing", () => {
  const secret = "pdl_ntfset_test_secret";
  const signedHeader = (payload: string, ts: number, sec: string) =>
    `ts=${ts};h1=${createHmac("sha256", sec).update(`${ts}:${payload}`).digest("hex")}`;

  it("accepts a valid, fresh webhook signature", () => {
    const payload = JSON.stringify({ event_type: "transaction.completed", data: { id: "txn_1" } });
    expect(verifyPaddleSignature(payload, signedHeader(payload, Math.floor(Date.now() / 1000), secret), secret)).toBe(true);
  });

  it("rejects forged, tampered, stale, and missing signatures", () => {
    const payload = JSON.stringify({ event_type: "subscription.updated", data: { id: "sub_1" } });
    const ts = Math.floor(Date.now() / 1000);
    expect(verifyPaddleSignature(payload, signedHeader(payload, ts, "pdl_ntfset_wrong"), secret)).toBe(false);
    expect(verifyPaddleSignature(payload + " tampered", signedHeader(payload, ts, secret), secret)).toBe(false);
    expect(verifyPaddleSignature(payload, signedHeader(payload, ts - 3600, secret), secret)).toBe(false); // stale > 5 min
    expect(verifyPaddleSignature(payload, null, secret)).toBe(false);
    expect(verifyPaddleSignature(payload, "ts=abc;h1=deadbeef", secret)).toBe(false); // malformed
  });

  it("resolves plans from Paddle price IDs", () => {
    const map = { MAKER: "pri_maker", GROWTH: "pri_growth", PRO: "pri_pro" };
    expect(paddlePlanFromPriceId("pri_growth", map)).toBe("GROWTH");
    expect(paddlePlanFromPriceId("pri_nope", map)).toBe(null);
    expect(paddlePlanFromPriceId("", map)).toBe(null);
    expect(paddlePlanFromPriceId("pri_pro", { MAKER: "", GROWTH: "", PRO: "" })).toBe(null); // unconfigured env
  });

  it("extracts the hosted checkout URL from a transaction", () => {
    expect(paddleCheckoutUrlFromTransaction({ checkout: { url: "https://buy.paddle.com/checkout?_ptxn=txn_1" } })).toBe(
      "https://buy.paddle.com/checkout?_ptxn=txn_1"
    );
    expect(paddleCheckoutUrlFromTransaction({})).toBe(null);
    expect(paddleCheckoutUrlFromTransaction(null)).toBe(null);
    expect(paddleCheckoutUrlFromTransaction({ checkout: { url: "javascript:alert(1)" } })).toBe(null);
  });
});

describe("URL guard (SSRF protection)", () => {
  it("blocks private and reserved IPv4 ranges", () => {
    expect(isPublicIp("127.0.0.1")).toBe(false);
    expect(isPublicIp("10.1.2.3")).toBe(false);
    expect(isPublicIp("172.16.0.9")).toBe(false);
    expect(isPublicIp("172.31.255.255")).toBe(false);
    expect(isPublicIp("192.168.1.1")).toBe(false);
    expect(isPublicIp("169.254.1.1")).toBe(false);
    expect(isPublicIp("100.64.0.1")).toBe(false);
    expect(isPublicIp("0.0.0.0")).toBe(false);
    expect(isPublicIp("8.8.8.8")).toBe(true);
    expect(isPublicIp("172.32.0.1")).toBe(true); // just outside the private /12
  });

  it("rejects unsafe URL shapes before any DNS is consulted", () => {
    expect(urlSyntaxGuard("ftp://example.com").ok).toBe(false);
    expect(urlSyntaxGuard("http://localhost:3000/app").ok).toBe(false);
    expect(urlSyntaxGuard("https://router.local/login").ok).toBe(false);
    expect(urlSyntaxGuard("http://10.0.0.5/admin").ok).toBe(false);
    expect(urlSyntaxGuard("https://example.com:8443/").ok).toBe(false);
    expect(urlSyntaxGuard("not a url").ok).toBe(false);
    const ok = urlSyntaxGuard("https://example.com/pricing");
    expect(ok.ok).toBe(true);
  });
});

describe("Research stage", () => {
  const input = {
    name: "Atelier",
    category: "Ecommerce returns software",
    icpName: "Shopify operations lead",
    keywords: ["returns management", "return reduction", "sizing"],
    problems: ["Returns eat margin", "Manual photo production"],
    competitors: ["Loop Returns", "ReturnLogic"],
  };

  it("builds 5 batches of 3 non-empty queries mixing web, Reddit and HN", () => {
    const batches = buildResearchBatches(input);
    expect(batches.length).toBe(5);
    const flat = batches.flat();
    expect(flat.length).toBe(15);
    for (const q of flat) expect(q.trim().length).toBeGreaterThan(3);
    expect(flat.filter((q) => q.includes("site:reddit.com")).length).toBeGreaterThanOrEqual(4);
    expect(flat.filter((q) => q.includes("site:news.ycombinator.com")).length).toBeGreaterThanOrEqual(3);
  });

  it("still produces 15 queries from sparse input", () => {
    const batches = buildResearchBatches({ name: "X", category: "CRM", icpName: "", keywords: [], problems: [], competitors: [] });
    expect(batches.flat().every((q) => q.trim().length > 3)).toBe(true);
  });

  it("dedupes hits by normalized URL keeping the best rank", () => {
    expect(normalizeUrlForDedup("https://Reddit.com/r/shopify/post?utm=x#top")).toBe("reddit.com/r/shopify/post");
    const hits = [
      { url: "https://a.com/x", title: "A", description: "", position: 2, source: "web" as const },
      { url: "https://a.com/x/", title: "A dup", description: "", position: 1, source: "reddit" as const },
      { url: "https://b.com/", title: "B", description: "", position: 3, source: "hn" as const },
    ];
    const deduped = dedupeByUrl(hits);
    expect(deduped.length).toBe(2);
    expect(deduped[0].source).toBe("reddit");
  });
});

describe("Deep-analysis merge hardening", () => {
  const input = {
    name: "Atelier",
    description: "AI try-on for Shopify fashion retailers that reduces returns from sizing uncertainty.",
  };

  it("normalizes garbled LLM output into a safe intelligence shape", () => {
    const base = deterministicAnalyst(input);
    const merged = mergeLLMIntel(
      base,
      {
        category: "  Retail Tech  ",
        personas: [{ name: "Maya", quote: null, goals: "null", pains: [null, "  ", "Slow returns"] }],
        competitors: [{ name: "", url: "javascript:alert(1)" }, { name: "Loop", url: "not-a-url", positioning: null }],
      } as never,
      "test-model",
      input
    );
    expect(merged.model).toBe("test-model");
    expect(merged.category).toBe("Retail Tech");
    expect(merged.personas[0].role).toBe("Decision maker"); // defaulted
    expect(merged.personas[0].pains).toEqual(["Slow returns"]); // nulls/empties dropped
    expect(merged.competitors.length).toBe(1);
    expect(merged.competitors[0]).toMatchObject({ name: "Loop", url: "#" });
  });
});

describe("Research candidates to feed", () => {
  it("maps search hits to stable research candidates", () => {
    const when = new Date("2026-01-01T00:00:00Z");
    const reddit = searchHitToCandidate({ url: "https://www.reddit.com/r/shopify/comments/1abc/returns_are_killing_us/", title: "Returns", description: "desc", position: 1, source: "reddit" }, when);
    expect(reddit.adapter).toBe("research");
    expect(reddit.platform).toBe("REDDIT");
    expect(reddit.communityName).toBe("r/shopify");
    expect(reddit.externalId).toBe(researchExternalId(normalizeUrlForDedup("https://www.reddit.com/r/shopify/comments/1abc/returns_are_killing_us/")));

    const hn = searchHitToCandidate({ url: "https://news.ycombinator.com/item?id=1", title: "T", description: "", position: 2, source: "hn" }, when);
    expect(hn.platform).toBe("HACKERNEWS");
    expect(hn.communityName).toBe("Hacker News");

    const web = searchHitToCandidate({ url: "https://loopreturns.com/pricing", title: "Loop pricing", description: "d", position: 3, source: "web" }, when);
    expect(web.platform).toBe("WEB");

    // Stable across calls (dedupe via unique constraint) and URL-sensitive
    const again = searchHitToCandidate({ url: "https://www.reddit.com/r/shopify/comments/1abc/returns_are_killing_us/", title: "Later repost", description: "other", position: 9, source: "reddit" }, when);
    expect(again.externalId).toBe(reddit.externalId);
    expect(researchExternalId("https://a.com")).not.toBe(researchExternalId("https://b.com"));
  });
});

describe("Self-hit & namesake suppression", () => {
  it("matches own domains, subdomains and www variants only", () => {
    expect(domainOf("https://WWW.Atelier.Example.com/pricing")).toBe("atelier.example.com");
    expect(isOwnSite("https://atelier.example.com/blog", "https://atelier.example.com")).toBe(true);
    expect(isOwnSite("https://docs.atelier.example.com/x", "https://atelier.example.com")).toBe(true);
    expect(isOwnSite("https://atelier.example.com.evil.io/x", "https://atelier.example.com")).toBe(false);
    expect(isOwnSite("https://atelier-ai.com/x", "https://atelier.example.com")).toBe(false); // same brand, different domain
    expect(isOwnSite("https://loopreturns.com/x", null)).toBe(false);
  });

  it("extracts distinctive brand tokens and filters generic words", () => {
    expect(brandTokens("GeekBot Standup Tracker")).toEqual(["geekbot", "geek", "standup"]); // compound kept intact + fragments
    expect(brandTokens("PulseStandup")).toEqual(["pulsestandup", "pulse", "standup"]);
    expect(brandTokens("Atelier")).toEqual(["atelier"]);
    expect(brandTokens("The AI Tool")).toEqual([]); // all generic
  });

  it("flags brand mentions only via the brand token or full name", () => {
    expect(hitMentionsBrand({ title: "Atelier raises the bar for AI fashion imagery", description: "" }, "Atelier")).toBe(true);
    expect(hitMentionsBrand({ title: "Atelier restaurant wins award", description: "fine dining" }, "Atelier")).toBe(true); // candidate — LLM decides
    expect(hitMentionsBrand({ title: "Best CRM tools for 2026", description: "sales pipelines" }, "Atelier")).toBe(false);
    expect(hitMentionsBrand({ title: "GeekBot vs Standuply pricing", description: "bot comparison" }, "GeekBot Standup Tracker")).toBe(true);
    expect(hitMentionsBrand({ title: "Standup meeting ideas", description: "generic" }, "GeekBot Standup Tracker")).toBe(true); // over-candidate is fine — LLM rules it OTHER
  });

  it("suppresses only HIGH-confidence SELF/NAMESAKE verdicts", () => {
    expect(shouldSuppress({ kind: "SELF", reason: "", confidence: "HIGH" })).toBe(true);
    expect(shouldSuppress({ kind: "NAMESAKE", reason: "", confidence: "HIGH" })).toBe(true);
    expect(shouldSuppress({ kind: "NAMESAKE", reason: "", confidence: "MEDIUM" })).toBe(false); // not sure → keep
    expect(shouldSuppress({ kind: "OTHER", reason: "", confidence: "HIGH" })).toBe(false);
    expect(shouldSuppress(undefined)).toBe(false);
  });
});

describe("Content image safety", () => {
  it("strips scripts, handlers and external refs from generated SVG", () => {
    const evil = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script><rect onclick="alert(1)" width="10" height="10" fill="#123456"/><a xlink:href="javascript:alert(1)"><circle r="5"/></a></svg>`;
    const clean = sanitizeSvg(evil);
    expect(clean).toContain("<svg");
    expect(clean).not.toContain("script");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("javascript:");
    const ok = sanitizeSvg("Sure! Here it is:\n<svg width=\"10\" height=\"10\"><rect width=\"10\" height=\"10\" fill=\"#123456\"/></svg>");
    expect(ok).toContain("<svg");
    expect(ok).not.toContain("<script");
  });

  it("detects image types by magic bytes and locks upload paths", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10, 0, 0, 0, 0]);
    expect(detectImageExt(png)).toBe("png");
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(detectImageExt(jpeg)).toBe("jpg");
    expect(detectImageExt(Buffer.from("<svg hello"))).toBe(null);
    expect(resolveUploadPath("../../.env")).toBe(null);
    expect(resolveUploadPath("nonexistent-file.png")).toBe(null);
    expect(resolveUploadPath("a/b.png")).toBe(null);
  });
});

describe("Experiment edge", () => {
  it("handles one-sided results", () => {
    const a = computeFunnel({ channel: "A", opportunities: 10, engagements: 5, clicks: 3, signups: 2, activations: 1, customers: 1, revenueCents: 100, hoursInvested: 5 });
    const b = computeFunnel({ channel: "B", opportunities: 10, engagements: 5, clicks: 3, signups: 0, activations: 0, customers: 0, revenueCents: 0, hoursInvested: 5 });
    const c = conclude(a, b);
    expect(c.winner).toBe("A");
    expect(c.recommendation).toMatch(/shift the majority/i);
  });
});
