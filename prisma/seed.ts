/**
 * Seed — demo workspace for "Atelier" (spec §18) with the spec's example
 * numbers: the 96/100 Shopify try-on opportunity, Sarah Mitchell prospect,
 * Distribution Score ~78, the Reddit vs LinkedIn experiment, the ROI funnel
 * ($396 MRR Reddit / $99 MRR LinkedIn) and the learning observations.
 *
 * Demo login: demo@founderos.app / demo1234
 */

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { analyzeProduct } from "../src/lib/engines/product-analyst";
import { persistIntelligence } from "../src/lib/services/products";
import { scoreOpportunity, buildExplanation, effortMinutes } from "../src/lib/engines/scoring";
import { classifyIntent } from "../src/lib/engines/intent";
import { generateSandboxCandidates } from "../src/lib/discovery/sandbox-templates";
import { runPipeline, communityMapFor } from "../src/lib/discovery/orchestrator";
import { jstr } from "../src/lib/jsonfield";
import { COMMUNITIES } from "../src/lib/engines/taxonomy";
import { candidatesForArchetype } from "../src/lib/engines/prospect";

const prisma = new PrismaClient();

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000);

async function ensureCommunities() {
  for (const c of COMMUNITIES) {
    await prisma.community.upsert({
      where: { id: c.key },
      update: {},
      create: {
        id: c.key,
        platform: c.platform,
        name: c.name,
        url: c.url,
        focus: c.focus,
        memberEstimate: c.memberEstimate,
        rules: jstr(c.rules),
        archetypeTags: jstr(c.archetypeTags),
      },
    });
  }
}

type OppInput = {
  key: string;
  platform: string;
  communityName: string;
  url?: string;
  title: string;
  body: string;
  author: string;
  ageHours: number;
  replyCount?: number;
  upvotes?: number;
  subs: { icpMatch: number; problemMatch: number; buyingIntent: number; recency: number; competition: number; engagementPotential: number };
  intentType: string;
  status?: string;
  partner?: boolean;
  competitorName?: string | null;
  isLive?: boolean;
};

async function insertCurated(orgId: string, productId: string, input: OppInput) {
  const { score, band, subs } = scoreOpportunity(input.subs);
  const intent = classifyIntent(input.title, input.body);
  const explanation = buildExplanation({
    title: input.title,
    platform: input.platform,
    community: input.communityName,
    ageHours: input.ageHours,
    intentType: input.intentType,
    subs,
    score,
    band,
    matchedPhrases: intent.matchedPhrases,
    evidence: ["virtual try-on", "return rate", "Shopify"],
    authorName: input.author,
  });
  const row = await prisma.opportunity.upsert({
    where: { orgId_adapter_externalId: { orgId, adapter: input.isLive ? "reddit" : "sandbox", externalId: `curated-${input.key}` } },
    update: { score, band, status: input.status ?? "NEW", postedAt: hoursAgo(input.ageHours), ageHours: input.ageHours },
    create: {
      orgId,
      productId,
      adapter: input.isLive ? "reddit" : "sandbox",
      externalId: `curated-${input.key}`,
      platform: input.platform,
      communityName: input.communityName,
      url: input.url ?? null,
      title: input.title,
      body: input.body,
      author: input.author,
      postedAt: hoursAgo(input.ageHours),
      ageHours: input.ageHours,
      isPartnerSignal: input.partner ?? false,
      competitorName: input.competitorName ?? null,
      intentType: input.intentType,
      subIcp: subs.icpMatch,
      subProblem: subs.problemMatch,
      subIntent: subs.buyingIntent,
      subRecency: subs.recency,
      subCompetition: subs.competition,
      subEngagement: subs.engagementPotential,
      score,
      band,
      effortMinutes: effortMinutes(input.intentType, input.body.length),
      potential: band,
      explanation: jstr(explanation),
      matchedPhrases: jstr(intent.matchedPhrases),
      status: input.status ?? "NEW",
      isLive: input.isLive ?? false,
      signals: {
        create: intent.signals.slice(0, 5).map((s) => ({ kind: s.kind, phrase: s.phrase.slice(0, 180), weight: s.weight })),
      },
    },
  });
  return row;
}

async function main() {
  console.log("· seeding communities");
  await ensureCommunities();

  console.log("· seeding demo user + workspace");
  const passwordHash = await hashPassword("demo1234");
  const user = await prisma.user.upsert({
    where: { email: "demo@founderos.app" },
    update: { passwordHash },
    create: { email: "demo@founderos.app", name: "Ava Chen", passwordHash },
  });

  const org = await prisma.organization.upsert({
    where: { slug: "atelier-demo" },
    update: {},
    create: { name: "Atelier Demo Workspace", slug: "atelier-demo", members: { create: { userId: user.id, role: "OWNER" } } },
  });
  const membership = await prisma.membership.findUnique({ where: { userId_orgId: { userId: user.id, orgId: org.id } } });
  if (!membership) await prisma.membership.create({ data: { userId: user.id, orgId: org.id, role: "OWNER" } });

  await prisma.subscription.upsert({
    where: { orgId: org.id },
    update: { plan: "GROWTH", status: "ACTIVE", creditsBalance: 1480, currentPeriodEnd: daysAgo(-21) },
    create: { orgId: org.id, plan: "GROWTH", status: "ACTIVE", seats: 2, creditsBalance: 1480, currentPeriodEnd: daysAgo(-21) },
  });

  for (const [adapter, name, status] of [
    ["hackernews", "Hacker News", "ACTIVE"],
    ["reddit", "Reddit", "ACTIVE"],
    ["sandbox", "Sandbox (demo source)", "PAUSED"],
  ] as const) {
    await prisma.source.upsert({
      where: { orgId_adapter: { orgId: org.id, adapter } },
      update: { lastRunAt: new Date() },
      create: { orgId: org.id, adapter, name, status },
    });
  }

  console.log("· analyzing product: Atelier");
  const existingProduct = await prisma.product.findFirst({ where: { orgId: org.id, name: "Atelier" } });
  const product =
    existingProduct ??
    (await prisma.product.create({
      data: {
        orgId: org.id,
        name: "Atelier",
        url: "https://atelier.example.com",
        description:
          "Atelier is AI fashion technology for online fashion retailers. It generates photorealistic virtual try-on experiences and on-model product imagery from existing flat-lay photos, cutting photoshoot costs and reducing returns caused by sizing uncertainty. Built for Shopify and custom storefronts; integrates with product catalogs in minutes.",
        targetCustomer: "Online fashion retailers",
        industry: "AI fashion technology",
        geography: "US, EU, UK",
        budgetBand: "MODERATE",
        timePerWeek: 8,
        isDefault: true,
      },
    }));

  const intel = await analyzeProduct({
    name: "Atelier",
    url: "https://atelier.example.com",
    description:
      "Atelier is AI fashion technology for online fashion retailers. It generates photorealistic virtual try-on experiences and on-model product imagery from existing flat-lay photos, cutting photoshoot costs and reducing returns caused by sizing uncertainty. Built for Shopify and custom storefronts; integrates with product catalogs in minutes.",
    targetCustomer: "Online fashion retailers",
    industry: "AI fashion technology",
    geography: "US, EU, UK",
    budgetBand: "MODERATE",
    timePerWeek: 8,
  });

  await persistIntelligence(product.id, org.id, intel, {
    name: "Atelier",
    description: intel.oneLiner,
    targetCustomer: "Online fashion retailers",
    geography: "US, EU, UK",
    budgetBand: "MODERATE",
    timePerWeek: 8,
  });

  console.log("· pipeline: sandbox discovery");
  const communityIds = await communityMapFor(org.id, product.id);
  const sandbox = generateSandboxCandidates("fashion-ecommerce", {
    productName: "Atelier",
    icpName: "online fashion retailers",
    keywords: JSON.parse((await prisma.productAnalysis.findUnique({ where: { productId: product.id } }))!.keywords),
  });
  await runPipeline(sandbox, {
    orgId: org.id,
    productId: product.id,
    productName: "Atelier",
    category: intel.category,
    icpName: "online fashion retailers",
    keywords: JSON.parse((await prisma.productAnalysis.findUnique({ where: { productId: product.id } }))!.keywords),
    problems: JSON.parse((await prisma.productAnalysis.findUnique({ where: { productId: product.id } }))!.problems),
    communityIds,
  });

  console.log("· inserting curated flagship opportunities");
  const flagship = await insertCurated(org.id, product.id, {
    key: "tryon-shopify",
    platform: "REDDIT",
    communityName: "r/shopify",
    url: "https://reddit.com/r/shopify/comments/looking_for_affordable_virtual_tryon",
    title: "Looking for an affordable virtual try-on solution for Shopify.",
    body: "We run a mid-size Shopify store (about 400 SKUs, mostly womenswear) and I've been looking for an affordable virtual try-on solution. All the enterprise tools want $2k+/mo which is insane for us. Does anyone know a tool that won't break the bank? Our return rate on dresses is brutal and I'm convinced half of it is sizing uncertainty.",
    author: "meredith_lou",
    ageHours: 3,
    replyCount: 5,
    upvotes: 21,
    // Spec §6: Match 96 — ICP 98, Problem 97, Intent 94, Recency 99, Competition 31, Engagement 89
    subs: { icpMatch: 98, problemMatch: 97, buyingIntent: 94, recency: 99, competition: 31, engagementPotential: 89 },
    intentType: "ACTIVE_BUYING",
    isLive: true,
  });

  const linkedinOpp = await insertCurated(org.id, product.id, {
    key: "linkedin-returns",
    platform: "LINKEDIN",
    communityName: "LinkedIn",
    title: "Returns ate 11 points of margin last quarter. Rethinking everything.",
    body: "Unpopular opinion: most 'returns problem' advice is wrong for small fashion brands. We're a 12-person label — free returns shipping just taught customers to over-order. Our returns rate is 28% and I'm publicly documenting every experiment we run to fix it (sizing, PDP content, packaging inserts). Follow along if you're in the same boat — I'll share the numbers.",
    author: "Sarah Mitchell",
    ageHours: 12,
    replyCount: 3,
    upvotes: 34,
    subs: { icpMatch: 98, problemMatch: 96, buyingIntent: 92, recency: 96, competition: 33, engagementPotential: 84 },
    intentType: "PROBLEM_AWARENESS",
    isLive: true,
  });

  await insertCurated(org.id, product.id, {
    key: "urgent-launch",
    platform: "REDDIT",
    communityName: "r/fashionbusiness",
    title: "URGENT: need on-model images for 40 pieces by Friday — shoot fell through",
    body: "Our photographer cancelled 48h before the shoot and our new collection launch is Friday. Deadline is real — I need software that can generate on-model product images from flat lays TODAY. Anyone tried anything that actually looks human? Will pay for the right tool, need it this week.",
    author: "collection_crunch",
    ageHours: 6,
    replyCount: 4,
    upvotes: 9,
    subs: { icpMatch: 93, problemMatch: 94, buyingIntent: 95, recency: 97, competition: 25, engagementPotential: 82 },
    intentType: "URGENT_NEED",
  });

  await insertCurated(org.id, product.id, {
    key: "partner-agency",
    platform: "SLACK",
    communityName: "Online Geniuses",
    title: "Agency owner: looking for a try-on/visualization tool partner for our fashion clients",
    body: "We run growth for 20+ Shopify fashion brands and clients keep asking for try-on tooling recommendations. Want to partner up with a founder in this space — referral arrangement, co-marketing, the works. Only tools you'd stake your reputation on.",
    author: "growth_dana",
    ageHours: 30,
    replyCount: 6,
    upvotes: 3,
    subs: { icpMatch: 90, problemMatch: 84, buyingIntent: 72, recency: 78, competition: 30, engagementPotential: 74 },
    intentType: "PARTNERSHIP_OPPORTUNITY",
    partner: true,
  });

  await insertCurated(org.id, product.id, {
    key: "partner-newsletter",
    platform: "OTHER",
    communityName: "The Ecomm Roundup",
    title: "Newsletter operator: sponsorship + product-swap for ecommerce tools",
    body: "I run The Ecomm Roundup (12k ecommerce operators, 41% open rate). Looking for tool partners for our 'tools we actually use' section — referral/affiliate or co-marketing. Fashion/conversion tools especially relevant right now.",
    author: "roundup_editor",
    ageHours: 50,
    replyCount: 2,
    upvotes: 4,
    subs: { icpMatch: 82, problemMatch: 74, buyingIntent: 66, recency: 62, competition: 35, engagementPotential: 68 },
    intentType: "PARTNERSHIP_OPPORTUNITY",
    partner: true,
  });

  // A spread of additional statuses so the workspace shows real lifecycle data.
  await insertCurated(org.id, product.id, {
    key: "acted-vendor-compare", platform: "REDDIT", communityName: "r/ecommerce", title: "Is there an alternative to Botika for AI fashion models?", body: "Botika's output is decent but pricing per image is adding up and support is slow. Is there an alternative to Botika that works with flat lays? Also cheaper.", author: "stylehaul_ops", ageHours: 70, replyCount: 9, upvotes: 15,
    subs: { icpMatch: 94, problemMatch: 90, buyingIntent: 86, recency: 42, competition: 44, engagementPotential: 76 }, intentType: "VENDOR_COMPARISON", competitorName: "Botika", status: "ACTED",
  });
  await insertCurated(org.id, product.id, {
    key: "acted-dissat", platform: "HACKERNEWS", communityName: "Hacker News", title: "We switched away from 3DLOOK — ask me anything", body: "We moved from 3DLOOK after 8 months. Integration was heavy and the fit data didn't justify the cost for our catalog size. Unhappy with how they handled cancellation too.", author: "ex_3dlook_user", ageHours: 96, replyCount: 18, upvotes: 40,
    subs: { icpMatch: 88, problemMatch: 84, buyingIntent: 82, recency: 30, competition: 52, engagementPotential: 80 }, intentType: "COMPETITOR_DISSATISFACTION", competitorName: "3DLOOK", status: "ACTED",
  });
  await insertCurated(org.id, product.id, {
    key: "acted-recommend", platform: "REDDIT", communityName: "r/shopify", title: "Does anyone know a tool for reducing clothing returns?", body: "Does anyone know a tool for reducing clothing returns? We're at 30% on dresses and it's killing us. Any recommendations for a small brand?", author: "dressshop_dana", ageHours: 120, replyCount: 12, upvotes: 22,
    subs: { icpMatch: 95, problemMatch: 92, buyingIntent: 84, recency: 24, competition: 48, engagementPotential: 78 }, intentType: "RECOMMENDATION_REQUEST", status: "CONVERTED",
  });
  await insertCurated(org.id, product.id, {
    key: "acted-urgent2", platform: "REDDIT", communityName: "r/ecommerce", title: "Need a try-on tool integrated before Black Friday — 2 weeks left", body: "Merch team set a hard deadline: try-on or visualization live before Black Friday. Urgent. What can integrate with Shopify fast?", author: "bf_squad", ageHours: 140, replyCount: 7, upvotes: 11,
    subs: { icpMatch: 90, problemMatch: 88, buyingIntent: 90, recency: 18, competition: 38, engagementPotential: 72 }, intentType: "URGENT_NEED", status: "ACTED",
  });
  await insertCurated(org.id, product.id, {
    key: "acted-compare2", platform: "REDDIT", communityName: "r/fashionbusiness", title: "Anyone tried VMake for product photos? Considering it", body: "Anyone tried VMake for AI product photography? Our returns problem is mostly sizing so I'm also looking at fit tools. Comparing options this month.", author: "photo_budgeter", ageHours: 110, replyCount: 5, upvotes: 8,
    subs: { icpMatch: 91, problemMatch: 86, buyingIntent: 78, recency: 26, competition: 55, engagementPotential: 70 }, intentType: "SOLUTION_RESEARCH", competitorName: "VMake", status: "ACTED",
  });
  await insertCurated(org.id, product.id, {
    key: "acted-high5", platform: "REDDIT", communityName: "r/ecommerce", title: "Looking for something cheaper than our photoshoot retainer", body: "Paying $4k/mo for product photography retainer. Looking for something cheaper with consistent quality — anyone made this switch? I need software that outputs on-model shots.", author: "retainer_refugee", ageHours: 150, replyCount: 10, upvotes: 17,
    subs: { icpMatch: 92, problemMatch: 89, buyingIntent: 87, recency: 20, competition: 41, engagementPotential: 74 }, intentType: "ACTIVE_BUYING", status: "ACTED",
  });
  await insertCurated(org.id, product.id, {
    key: "acted-high6", platform: "HACKERNEWS", communityName: "Hacker News", title: "Ask HN: tools for clothing size prediction?", body: "Working on returns reduction for a fashion marketplace. Ask HN: what tools exist for clothing size prediction from purchase history? Anyone tried them?", author: "marketplace_ml", ageHours: 160, replyCount: 14, upvotes: 33,
    subs: { icpMatch: 85, problemMatch: 88, buyingIntent: 76, recency: 16, competition: 45, engagementPotential: 82 }, intentType: "RECOMMENDATION_REQUEST", status: "ACTED",
  });
  await insertCurated(org.id, product.id, {
    key: "saved-mid", platform: "REDDIT", communityName: "r/shopify", title: "How do I improve PDP conversion without re-platforming?", body: "How do I improve product page conversion without a full re-platform? Theme is fine, traffic is fine, but people aren't buying. Wondering if content/imagery is the issue.", author: "pdp_puzzled", ageHours: 60, replyCount: 8, upvotes: 12,
    subs: { icpMatch: 84, problemMatch: 80, buyingIntent: 58, recency: 50, competition: 42, engagementPotential: 70 }, intentType: "PROBLEM_AWARENESS", status: "SAVED",
  });
  await insertCurated(org.id, product.id, {
    key: "saved-mid2", platform: "LINKEDIN", communityName: "LinkedIn", title: "Ecommerce teams: what's your return rate benchmark?", body: "Poll for ecommerce teams: what's your apparel return rate benchmark this year? Ours crept from 19% to 24% and I'm trying to figure out if that's the new normal.", author: "benchmarker_li", ageHours: 75, replyCount: 21, upvotes: 45,
    subs: { icpMatch: 80, problemMatch: 74, buyingIntent: 50, recency: 44, competition: 40, engagementPotential: 84 }, intentType: "PROBLEM_AWARENESS", status: "SAVED",
  });
  await insertCurated(org.id, product.id, {
    key: "dismissed-low1", platform: "X", communityName: "X (Twitter)", title: "hot take: most product photos are boring", body: "hot take: most product photos are boring and nobody cares. show the clothes on humans.", author: "x_hot take", ageHours: 90, replyCount: 2, upvotes: 5,
    subs: { icpMatch: 55, problemMatch: 40, buyingIntent: 30, recency: 34, competition: 60, engagementPotential: 50 }, intentType: "PROBLEM_AWARENESS", status: "DISMISSED",
  });

  console.log("· prospects");
  async function upsertProspect(where: { orgId: string; name: string }, data: Record<string, unknown>) {
    const existing = await prisma.prospect.findFirst({ where: { orgId: where.orgId, name: where.name } });
    if (existing) return prisma.prospect.update({ where: { id: existing.id }, data });
    return prisma.prospect.create({ data: { orgId: where.orgId, name: where.name, ...data } as never });
  }

  const sarah = await upsertProspect({ orgId: org.id, name: "Sarah Mitchell" }, {
      orgId: org.id,
      productId: product.id,
      name: "Sarah Mitchell",
      handle: "Sarah Mitchell",
      company: "Example Fashion",
      role: "Founder",
      website: "https://examplefashion.com",
      industry: "Fashion ecommerce",
      sourceOpportunityId: linkedinOpp.id,
      icpFit: 94,
      intentScore: 88,
      signalsVerified: jstr([
        "Shopify store (public storefront tech check)",
        "~400 products in catalog",
        "Recently launched a new collection",
        "Publicly discussing conversion problems on LinkedIn",
      ]),
      signalsInferred: jstr([
        "Return-rate pressure likely (mentions margin impact) — inference",
        "Decision-making authority probable as founder — inference",
      ]),
      approach: "Start with a personalized response to the problem rather than a generic sales pitch.",
      stage: "NEW",
    });

  const extraProspects: [string, string | null, string | null, number, number, string, string][] = [
    ["meredith_lou", "Lou & Maine", "Head of Ecommerce", 96, 90, "NEW", "Asked directly for an affordable try-on tool on r/shopify. Reply in-thread first; connect after."],
    ["collection_crunch", null, "Founder", 90, 92, "CONTACTED", "Urgent launch need — responded with sample render; awaiting reply."],
    ["stylehaul_ops", "StyleHaul", "Founder", 92, 84, "ENGAGED", "Comparing Botika alternatives; sent comparison notes, asked for catalog size."],
    ["dressshop_dana", "Dana Dresses", "Owner", 94, 80, "ENGAGED", "30% returns on dresses; trial scheduled."],
    ["growth_dana", "Bright Growth Agency", "Agency Owner", 88, 70, "QUALIFIED", "Agency with 20 fashion clients — partnership conversation, referral model."],
    ["roundup_editor", "The Ecomm Roundup", "Newsletter Operator", 80, 64, "CONTACTED", "Newsletter partnership pitch sent."],
    ["cpa_chasing_docs", null, "Operations", 60, 55, "LOST", "Wrong ICP (accounting) — came in via broad search."],
  ];
  for (const [name, company, role, icpFit, intentScore, stage, notes] of extraProspects) {
    await upsertProspect({ orgId: org.id, name }, { company, role, icpFit, intentScore, signalsVerified: jstr(["Posted publicly about the problem"]), signalsInferred: jstr(["ICP fit estimated from post content"]), approach: notes, stage, notes });
  }

  console.log("· campaigns + actions");
  async function upsertCampaign(name: string, data: Record<string, unknown>) {
    const existing = await prisma.campaign.findFirst({ where: { orgId: org.id, name } });
    if (existing) return existing;
    return prisma.campaign.create({ data: { orgId: org.id, productId: product.id, name, ...data } as never });
  }
  const redditCampaign = await upsertCampaign("Reddit intent capture", { channel: "Reddit", objective: "Reply to high-intent threads within 24h; build subreddit credibility", status: "ACTIVE", goalMetric: "Replies → conversations", startedAt: daysAgo(21) });
  const liCampaign = await upsertCampaign("LinkedIn founder brand", { channel: "LinkedIn", objective: "2 educational posts/week + comment on 5 ICP posts daily", status: "ACTIVE", goalMetric: "Profile visits → trials", startedAt: daysAgo(30) });
  const partnerCampaign = await upsertCampaign("Partnership outreach", { channel: "Partnerships", objective: "Sign 1 agency + 1 newsletter partnership this quarter", status: "ACTIVE", goalMetric: "Partners signed", startedAt: daysAgo(14) });
  await upsertCampaign("SEO comparison pages", { channel: "Search", objective: "Publish 'Botika alternative' + 'virtual try-on Shopify' pages", status: "ACTIVE", goalMetric: "Ranked keywords", startedAt: daysAgo(10) });

  const actionSeed: [string, string, string, string, string | null, string | null][] = [
    [redditCampaign.id, "REPLY", "Reply: affordable try-on for Shopify (meredith_lou)", "DONE", flagship.id, null],
    [redditCampaign.id, "REPLY", "Reply: alternative to Botika (stylehaul_ops)", "DONE", null, null],
    [redditCampaign.id, "REPLY", "Reply: returns reduction recommendations (dressshop_dana)", "DONE", null, null],
    [liCampaign.id, "POST", "Educational post: return-rate experiments", "DONE", null, null],
    [liCampaign.id, "COMMENT", "Comment on Sarah Mitchell's returns thread", "DONE", null, sarah.id],
    [liCampaign.id, "POST", "Educational post: sizing uncertainty teardown", "TODO", null, null],
    [partnerCampaign.id, "PARTNER", "Proposal: Bright Growth Agency referral model", "DONE", null, null],
    [partnerCampaign.id, "PARTNER", "Proposal: The Ecomm Roundup sponsorship swap", "TODO", null, null],
    [partnerCampaign.id, "CONNECT", "Outreach: FitTech Collective integration", "TODO", null, null],
  ];
  for (const [campaignId, type, title, status, opportunityId, prospectId] of actionSeed) {
    const exists = await prisma.campaignAction.findFirst({ where: { campaignId, title } });
    if (!exists) {
      await prisma.campaignAction.create({
        data: { campaignId, type, title, status, opportunityId, prospectId, doneAt: status === "DONE" ? daysAgo(3) : null },
      });
    }
  }

  console.log("· content");
  const publishedPost = await prisma.content.findFirst({ where: { orgId: org.id, title: { contains: "returns" } } });
  if (!publishedPost) {
    await prisma.content.create({
      data: {
        orgId: org.id, productId: product.id, channel: "LINKEDIN", format: "POST", status: "PUBLISHED", publishedAt: daysAgo(9),
        title: "We cut our return rate 6 points in 60 days. Here's the boring version of how.",
        body: "Returns don't get fixed by working harder. They get fixed by measuring the right thing.\n\nMost fashion brands I talk to share the same pattern: they feel the problem daily, can't put a number on it, and have bought a tool before it was scoped.\n\nThe fix is boring: baseline the return rate by size, change one variable per week, keep a log.\n\nIf you're dealing with this right now, what does your return breakdown by size look like?",
        spamRisk: 4, warnings: jstr([]), url: "https://linkedin.com/example-post",
        metrics: jstr({ impressions: 2400, engagements: 94, clicks: 31, signups: 8, customers: 3, revenueCents: 29700 }),
      },
    });
  }
  const approvedDraft = await prisma.content.findFirst({ where: { orgId: org.id, status: "APPROVED" } });
  if (!approvedDraft) {
    await prisma.content.create({
      data: {
        orgId: org.id, productId: product.id, channel: "LINKEDIN", format: "POST", status: "APPROVED",
        title: "Sizing uncertainty is a conversion problem, not a logistics problem",
        body: "Your PDP conversion doesn't have a traffic problem. It has a confidence problem.\n\nShoppers hesitate when they can't picture the garment on them — and hesitation is where carts die.\n\nThree things that moved the needle for brands we work with:\n— On-model imagery for every colorway\n— Fit guidance framed in body terms, not size charts\n— A returns policy that reads as confidence, not risk\n\nWhich of the three is weakest in your store today?",
        spamRisk: 2, warnings: jstr([]),
      },
    });
  }
  const seoDraft = await prisma.content.findFirst({ where: { orgId: org.id, channel: "SEO" } });
  if (!seoDraft) {
    await prisma.content.create({
      data: {
        orgId: org.id, productId: product.id, channel: "SEO", format: "COMPARISON", status: "APPROVED",
        title: "Botika alternatives: AI fashion photography tools compared (2026)",
        body: "Target keyword: \"botika alternative\". Secondary: \"ai fashion photography pricing\", \"virtual try-on shopify\".\n\nOutline:\n1. Who this is for: fashion retailers evaluating AI on-model imagery.\n2. The 4 criteria that actually matter: output realism, setup time, per-image cost, PDP speed impact.\n3. Honest comparison: Atelier vs Botika vs VMake, with trade-offs stated plainly.\n4. \"Choose Botika if…\" — real scenarios where it wins (enterprise budgets, 3D pipelines).\n5. FAQ from actual intent phrases: \"will AI images look fake?\", \"integration effort?\", \"per-image cost at catalog scale?\".",
        spamRisk: 0, warnings: jstr([]),
      },
    });
  }
  const blockedDraft = await prisma.content.findFirst({ where: { orgId: org.id, opportunityId: linkedinOpp.id } });
  if (!blockedDraft) {
    await prisma.content.create({
      data: {
        orgId: org.id, productId: product.id, channel: "LINKEDIN", format: "COMMENT", status: "DRAFT",
        opportunityId: linkedinOpp.id,
        title: "Comment: Sarah Mitchell's returns thread",
        body: "Been through this exact loop. The thing that actually moved the needle for me:\n\n1. Break the return rate down by size and style before changing anything — most of the time the problem is narrower than it looks.\n2. Pick the single worst size/fit combination and fix that first.\n3. Keep a running log; patterns show up faster than you'd expect.\n\nHappy to go deeper on any of these — which part is closest to where you're stuck?",
        spamRisk: 0,
        warnings: jstr([{ level: "INFO", code: "DONT_PITCH", message: "Don't pitch yet. This is awareness-stage — help first, sell later." }]),
      },
    });
  }
  const xDraft = await prisma.content.findFirst({ where: { orgId: org.id, channel: "X" } });
  if (!xDraft) {
    await prisma.content.create({
      data: {
        orgId: org.id, productId: product.id, channel: "X", format: "THREAD", status: "DRAFT",
        title: "Return rates in fashion ecommerce: the 3-step version that actually works",
        body: "Clothing returns killing your margins: the 3-step version that actually works.\n\n1/ Baseline the return rate by size and reason code before touching anything.\n\n2/ Change one variable per week (imagery, fit guidance, size chart). Log everything.\n\n3/ Keep what moved the number. Kill what didn't. Repeat.\n\nMost brands do step 3 without steps 1–2. That's just expensive guessing.",
        spamRisk: 0, warnings: jstr([]),
      },
    });
  }
  const ytDraft = await prisma.content.findFirst({ where: { orgId: org.id, channel: "YOUTUBE" } });
  if (!ytDraft) {
    await prisma.content.create({
      data: {
        orgId: org.id, productId: product.id, channel: "YOUTUBE", format: "SCRIPT", status: "DRAFT",
        title: "YouTube ideas & scripts",
        body: "Title: \"How we cut clothing returns — full walkthrough\" — Hook: show the before return-rate metric on screen in 5 seconds. Script: problem → baseline by size → the 3 fixes → honest results (including what didn't work). Length 8–12 min.\n\nTitle: \"Virtual try-on for Shopify stores: what actually matters\" — Hook: \"You don't need more features, you need these 3 things.\" Script: teardown of a real (anonymized) PDP. Length 6–10 min.\n\nTitle: \"The fastest way to test if sizing uncertainty is your bottleneck\" — Hook: 30-second DIY test with your existing return data. Script: test → interpretation → next step. Length 5–7 min.",
        spamRisk: 0, warnings: jstr([]),
      },
    });
  }
  const emailDraft = await prisma.content.findFirst({ where: { orgId: org.id, channel: "EMAIL" } });
  if (!emailDraft) {
    await prisma.content.create({
      data: {
        orgId: org.id, productId: product.id, channel: "EMAIL", format: "OUTREACH", status: "DRAFT",
        title: "Outreach: meredith_lou (r/shopify try-on thread)",
        body: "Subject: Affordable virtual try-on for Shopify\n\nHi Lou,\n\nSaw your r/shopify post about return rates from sizing uncertainty — it's the exact problem we built Atelier for (AI fashion technology for online fashion retailers).\n\nIf useful, I can show you how we handle it in 15 minutes — no deck, just the product on your actual catalog. Either way, happy to point you at what we'd check first in your situation.\n\n— Founder, Atelier",
        spamRisk: 5, warnings: jstr([]),
      },
    });
  }

  console.log("· experiments (Reddit vs LinkedIn)");
  let experiment = await prisma.experiment.findFirst({ where: { orgId: org.id, name: "Reddit vs LinkedIn" } });
  if (!experiment) {
    experiment = await prisma.experiment.create({
      data: {
        orgId: org.id, productId: product.id, name: "Reddit vs LinkedIn",
        hypothesis: "Reddit produces fewer visitors but higher-intent customers.",
        channelA: "Reddit", channelB: "LinkedIn", status: "RUNNING", startedAt: daysAgo(28),
      },
    });
  }
  const existingResults = await prisma.experimentResult.count({ where: { experimentId: experiment.id } });
  if (existingResults === 0) {
    await prisma.experimentResult.createMany({
      data: [
        { experimentId: experiment.id, channel: "Reddit", opportunities: 14, engagements: 40, clicks: 27, signups: 11, activations: 6, customers: 4, revenueCents: 39600, hoursInvested: 6.5, recordedAt: daysAgo(2), note: "Spec §13 funnel" },
        { experimentId: experiment.id, channel: "LinkedIn", opportunities: 31, engagements: 130, clicks: 92, signups: 14, activations: 7, customers: 1, revenueCents: 9900, hoursInvested: 8, recordedAt: daysAgo(2), note: "Spec §13 funnel" },
      ],
    });
  }

  console.log("· competitors + events");
  const botika = await prisma.competitor.upsert({
    where: { orgId_name: { orgId: org.id, name: "Botika" } },
    update: {},
    create: { orgId: org.id, productId: product.id, name: "Botika", url: "https://botika.io", positioning: "AI fashion models for apparel photography", monitor: true },
  });
  const vmake = await prisma.competitor.upsert({
    where: { orgId_name: { orgId: org.id, name: "VMake" } },
    update: {},
    create: { orgId: org.id, productId: product.id, name: "VMake", url: "https://vmake.ai", positioning: "AI product visuals for ecommerce", monitor: true },
  });
  await prisma.competitor.upsert({
    where: { orgId_name: { orgId: org.id, name: "3DLOOK" } },
    update: {},
    create: { orgId: org.id, productId: product.id, name: "3DLOOK", url: "https://3dlook.com", positioning: "Mobile body-measurement and fit tech", monitor: true },
  });
  const eventCount = await prisma.competitorEvent.count({ where: { orgId: org.id } });
  if (eventCount === 0) {
    await prisma.competitorEvent.createMany({
      data: [
        {
          competitorId: botika.id, orgId: org.id, kind: "PRICING", severity: "HIGH", detectedAt: daysAgo(1),
          title: "Botika launched a cheaper self-serve plan ($290/mo)",
          detail: "Botika introduced a self-serve tier at $290/mo (previously entry was ~$900/mo via sales). Landing page now shows pricing publicly.",
          whatChanged: "Botika launched a cheaper plan: self-serve $290/mo, publicly listed pricing.",
          whyItMatters: "Their new entry price is now visible to every prospect comparing options — including the price-sensitive ICP slice that was previously unreachable for them. Expect more bottom-funnel comparisons against this number.",
          potentialResponse: "Do not panic-discount. Publish/update the Botika comparison page with an honest cost-at-scale breakdown (per-image economics), and arm the 'affordable' intent threads already in the feed with concrete pricing.",
        },
        {
          competitorId: botika.id, orgId: org.id, kind: "COMPLAINT", severity: "HIGH", detectedAt: daysAgo(3),
          title: "Botika users complaining about per-image costs in r/ecommerce",
          detail: "Multiple r/ecommerce comments report per-image pricing getting expensive at catalog scale; one user cancelled.",
          whatChanged: "Public user complaints about Botika's per-image cost at scale.",
          whyItMatters: "This is the highest-value competitive signal: real users, real frustration, in public. Many are one good answer away from switching.",
          potentialResponse: "Respond helpfully in those threads (already surfaced as competitor-dissatisfaction opportunities). Show per-catalog cost math. Never trash Botika by name.",
        },
        {
          competitorId: vmake.id, orgId: org.id, kind: "FEATURE", severity: "MEDIUM", detectedAt: daysAgo(6),
          title: "VMake shipped a video try-on beta",
          detail: "VMake announced a video try-on beta on their changelog and social accounts.",
          whatChanged: "VMake launched a video try-on feature (beta).",
          whyItMatters: "Video is the next format their users will ask for. If your ICP starts expecting video, the differentiation narrative needs an answer — even if the answer is 'we focus on stills that convert'.",
          potentialResponse: "Respond with depth, not parity: publish a teardown of what actually moves PDP conversion (stills beat video for SKU breadth today). Only build if the ICP asks.",
        },
      ],
    });
  }

  console.log("· customers, conversions, revenue");
  const funnelSeed: [string, number, number, number, number, number, number][] = [
    // channel, impressions, visits, signups, activations, customers, mrrCents
    ["Reddit", 1420, 27, 11, 6, 4, 39600],
    ["LinkedIn", 12400, 92, 14, 7, 1, 9900],
    ["Google long-tail", 5200, 96, 9, 4, 2, 19800],
    ["Product Hunt", 3800, 140, 18, 4, 1, 4900],
    ["Hacker News", 900, 18, 3, 1, 0, 0],
  ];
  for (const [channel, impressions, visits, signups, activations, customers] of funnelSeed) {
    for (const [stage, count] of [["VISIT", visits], ["SIGNUP", signups], ["ACTIVATION", activations], ["CUSTOMER", customers]] as const) {
      await prisma.conversion.create({
        data: { orgId: org.id, productId: product.id, channel, stage, count, occurredAt: daysAgo(7), meta: channel === "Reddit" ? jstr({ impressions }) : null },
      });
    }
  }
  const mrr: [string, number, number][] = [["Reddit", 4, 9900], ["LinkedIn", 1, 9900], ["Google long-tail", 2, 9900], ["Product Hunt", 1, 4900]];
  const customerNames = ["Lou & Maine", "StyleHaul", "Dana Dresses", "Verra Label", "Nova Knitwear", "Atlas Denim", "Mode Collective", "Loom & Co"];
  let customerIdx = 0;
  for (const [channel, n, perCustomer] of mrr) {
    for (let i = 0; i < n; i++) {
      const name = customerNames[customerIdx % customerNames.length]!;
      customerIdx += 1;
      const customer = await prisma.customer.create({
        data: { orgId: org.id, productId: product.id, name, email: null, company: name, channel, mrrCents: perCustomer, status: "CUSTOMER", activatedAt: daysAgo(10 + customerIdx) },
      });
      await prisma.revenueEvent.create({
        data: { orgId: org.id, productId: product.id, channel, customerId: customer.id, amountCents: perCustomer, kind: "NEW", isRecurring: true, occurredAt: daysAgo(10 + customerIdx) },
      });
    }
  }
  // One Product Hunt customer at a lower plan
  const phCustomer = await prisma.customer.create({
    data: { orgId: org.id, productId: product.id, name: "Petit Atelier", company: "Petit Atelier", channel: "Product Hunt", mrrCents: 4900, status: "CUSTOMER", activatedAt: daysAgo(5) },
  });
  await prisma.revenueEvent.create({
    data: { orgId: org.id, productId: product.id, channel: "Product Hunt", customerId: phCustomer.id, amountCents: 4900, kind: "NEW", isRecurring: true, occurredAt: daysAgo(5) },
  });
  // Leads/signups not yet customers (for funnel realism)
  for (let i = 0; i < 22; i++) {
    await prisma.customer.create({
      data: { orgId: org.id, productId: product.id, name: `Signup ${i + 1}`, channel: i % 3 === 0 ? "Reddit" : i % 3 === 1 ? "LinkedIn" : "Google long-tail", mrrCents: 0, status: i % 4 === 0 ? "ACTIVATED" : "SIGNUP", firstSeenAt: daysAgo(i % 14) },
    });
  }

  console.log("· learning observations");
  const obsCount = await prisma.learningObservation.count({ where: { orgId: org.id } });
  if (obsCount === 0) {
    await prisma.learningObservation.createMany({
      data: [
        { orgId: org.id, productId: product.id, subjectType: "CONTENT", channel: "LinkedIn", topic: "Return reduction", format: "Educational", icpTag: "Fashion ecommerce", metrics: jstr({ impressions: 2400, engagements: 94, clicks: 31, signups: 8, customers: 3, revenueCents: 29700 }), result: "HIGH", observedAt: daysAgo(8), notes: "Spec §14 example — the system learns what works" },
        { orgId: org.id, productId: product.id, subjectType: "CONTENT", channel: "LinkedIn", topic: "Product launch promo", format: "Promotional", icpTag: "Fashion ecommerce", metrics: jstr({ impressions: 1100, engagements: 12, clicks: 4, signups: 0, customers: 0 }), result: "LOW", observedAt: daysAgo(12) },
        { orgId: org.id, productId: product.id, subjectType: "OUTREACH", channel: "Reddit", topic: "Returns reduction", format: "REPLY", icpTag: "Fashion ecommerce", metrics: jstr({ impressions: 1420, engagements: 40, clicks: 27, signups: 6, customers: 2, revenueCents: 19800 }), result: "HIGH", observedAt: daysAgo(5) },
        { orgId: org.id, productId: product.id, subjectType: "CONTENT", channel: "SEO", topic: "Botika alternative", format: "COMPARISON", icpTag: "Fashion ecommerce", metrics: jstr({ impressions: 5200, engagements: 96, clicks: 96, signups: 9, customers: 1, revenueCents: 9900 }), result: "MEDIUM", observedAt: daysAgo(6) },
        { orgId: org.id, productId: product.id, subjectType: "CONTENT", channel: "TikTok", topic: "Behind the scenes", format: "Video", icpTag: "Broad", metrics: jstr({ impressions: 8000, engagements: 120, clicks: 9, signups: 0, customers: 0 }), result: "LOW", observedAt: daysAgo(15) },
      ],
    });
    const insightCount = await prisma.learningInsight.count({ where: { orgId: org.id } });
    if (insightCount === 0) {
      await prisma.learningInsight.createMany({
        data: [
          { orgId: org.id, productId: product.id, statement: "Topic \"Return reduction\" is your strongest performer.", dimension: "TOPIC", confidence: 86, evidence: jstr(["LinkedIn educational: 94 engagements, 3 customers", "Reddit replies: 27 clicks, 2 customers"]), recommendation: "Double down on return-reduction content this week on LinkedIn and Reddit." },
          { orgId: org.id, productId: product.id, statement: "Educational/REPLY format outperforms promotional formats for your audience.", dimension: "FORMAT", confidence: 78, evidence: jstr(["LinkedIn: 94 vs 12 engagements"]), recommendation: "Keep formats educational with a numeric payoff. Avoid product-first posts entirely." },
          { orgId: org.id, productId: product.id, statement: "Reddit produces customers; TikTok currently does not.", dimension: "CHANNEL", confidence: 82, evidence: jstr(["Reddit: 4 customers, 11 signups", "TikTok: 0 customers, 0 signups"]), recommendation: "Put the next two weeks of effort into Reddit and LinkedIn. Pause TikTok." },
          { orgId: org.id, productId: product.id, statement: "Your converting audience self-identifies as: Fashion ecommerce.", dimension: "ICP", confidence: 74, evidence: jstr(["Fashion ecommerce via LinkedIn", "Fashion ecommerce via Reddit"]), recommendation: "Keep ICP language verbatim in content titles and outreach subject lines — it is converting." },
        ],
      });
    }
  }

  console.log("· recommendations (command-center priorities)");
  const recCount = await prisma.recommendation.count({ where: { orgId: org.id, status: "OPEN" } });
  if (recCount === 0) {
    await prisma.recommendation.createMany({
      data: [
        { orgId: org.id, productId: product.id, kind: "REPLY", title: "Reply to 3 high-intent conversations", body: "Reply to 3 high-intent conversations", what: "18 min · High impact", why: "Answers posted in the first 24h convert multiples better.", impact: "HIGH", effortMinutes: 18, nextAction: "Open the Very High opportunities and reply genuinely.", refType: "opportunity", refId: flagship.id, priority: 100 },
        { orgId: org.id, productId: product.id, kind: "CONTACT", title: "Contact 5 qualified prospects", body: "Contact 5 qualified prospects", what: "20 min · High impact", why: "They publicly stated the problem; personalized outreach converts 5–10× better than cold.", impact: "HIGH", effortMinutes: 20, nextAction: "Open prospects and send first messages.", priority: 90 },
        { orgId: org.id, productId: product.id, kind: "PUBLISH", title: "Publish prepared LinkedIn post", body: "Publish prepared LinkedIn post", what: "5 min · Medium impact", why: "The approved draft targets return-reduction — your strongest topic.", impact: "MEDIUM", effortMinutes: 5, nextAction: "Open Content and publish.", priority: 70 },
        { orgId: org.id, productId: product.id, kind: "FOLLOWUP", title: "Follow up with 4 warm leads", body: "Follow up with 4 warm leads", what: "10 min", why: "Warm conversations die in silence; a light nudge revives them.", impact: "MEDIUM", effortMinutes: 10, nextAction: "Open prospects in ENGAGED stage.", priority: 60 },
        { orgId: org.id, productId: product.id, kind: "PARTNER", title: "Send partnership proposal to Studio Mera", body: "Send partnership proposal to Studio Mera", what: "15 min · Medium impact", why: "One agency relationship brings many customers; Studio Mera ranks 88/100.", impact: "MEDIUM", effortMinutes: 15, nextAction: "Open Partnerships and send the referral proposal.", priority: 55 },
      ],
    });
  }

  console.log("· integrations + usage");
  await prisma.integration.upsert({
    where: { orgId_provider: { orgId: org.id, provider: "webhook" } },
    update: {},
    create: { orgId: org.id, provider: "webhook", status: "CONNECTED", config: jstr({ url: "https://example.com/hooks/dos" }), lastSyncAt: new Date() },
  });
  await prisma.usageEvent.createMany({
    data: [
      { orgId: org.id, kind: "DISCOVERY_SCAN", amount: 1, meta: jstr({ inserted: 23 }), createdAt: daysAgo(1) },
      { orgId: org.id, kind: "AI_CREDIT", amount: 24, meta: jstr({ kind: "drafts" }), createdAt: daysAgo(2) },
      { orgId: org.id, kind: "AI_CREDIT", amount: 36, meta: jstr({ kind: "strategist" }), createdAt: daysAgo(3) },
    ],
  });

  const finalCounts = {
    opportunities: await prisma.opportunity.count({ where: { orgId: org.id } }),
    prospects: await prisma.prospect.count({ where: { orgId: org.id } }),
    customers: await prisma.customer.count({ where: { orgId: org.id, status: "CUSTOMER" } }),
  };
  console.log("✓ seed complete", finalCounts);
  console.log("  login: demo@founderos.app / demo1234");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
