/**
 * Sandbox source — deterministic, realistic opportunity templates per
 * archetype. Powers new-workspace bootstrapping and the seeded demo. These
 * are demonstration data (isLive=false); live adapters write isLive=true.
 */

import type { RawCandidate } from "./adapters";

type SandboxCtx = { productName: string; icpName: string; keywords: string[] };

type Template = {
  key: string;
  communityName: string;
  platform: string;
  title: string;
  body: string;
  ageHours: number;
  author: string;
  replyCount: number;
  upvotes: number;
};

const FASHION: Template[] = [
  {
    key: "tryon-affordable", communityName: "r/shopify", platform: "REDDIT", ageHours: 3, author: "meredith_lou", replyCount: 7, upvotes: 21,
    title: "Looking for an affordable virtual try-on solution for Shopify.",
    body: "We run a mid-size Shopify store (about 400 SKUs, mostly womenswear) and I've been looking for an affordable virtual try-on solution. All the enterprise tools want $2k+/mo which is insane for us. Does anyone know a tool that won't break the bank? Our return rate on dresses is brutal and I'm convinced half of it is sizing uncertainty.",
  },
  {
    key: "returns-margins", communityName: "r/ecommerce", platform: "REDDIT", ageHours: 9, author: "wardrobe_founder", replyCount: 14, upvotes: 38,
    title: "Our clothing returns are killing margins — anyone solved this?",
    body: "Title basically. We sell women's workwear DTC. 32% return rate on bottoms, mostly sizing. We've tried better size charts (didn't move the needle) and free return shipping (made it worse — more returns). margins are already thin. Anyone actually reduced apparel returns? What worked?",
  },
  {
    key: "ai-tryon-tool", communityName: "r/fashionbusiness", platform: "REDDIT", ageHours: 26, author: "atelier_searcher", replyCount: 4, upvotes: 11,
    title: "Anyone know an AI fashion try-on tool that works with existing product photos?",
    body: "I need software that can generate on-model images from our flat lays — we can't afford photoshoots for every colorway. Anyone tried the AI tools in this space? Most look obviously fake. Also is there an alternative to booking models every collection drop?",
  },
  {
    key: "conversion-pdp", communityName: "Shopify Community Forums", platform: "FORUM", ageHours: 40, author: "linnea_stores", replyCount: 6, upvotes: 0,
    title: "PDP conversion dropped after traffic mix changed — visualizer recommendations?",
    body: "Our product page conversion fell from 2.9% to 1.8% after we scaled paid social (colder traffic). bounce rate is the same so I suspect the pages just don't convince. Has anyone added product visualization/try-on and seen a measurable lift? Looking for something cheaper than re-shooting the catalog.",
  },
  {
    key: "collection-launch", communityName: "r/ecommerce", platform: "REDDIT", ageHours: 55, author: "springdrop_ops", replyCount: 9, upvotes: 17,
    title: "New collection launch — how do you produce on-model imagery fast without a shoot?",
    body: "Launching 60 new pieces in 6 weeks and the photography timeline doesn't fit. I wish there was a way to generate consistent on-model shots from samples. What are people using in 2026? Budget is small — we're a 4-person team.",
  },
  {
    key: "competitor-unhappy", communityName: "r/shopify", platform: "REDDIT", ageHours: 20, author: "sized_out", replyCount: 12, upvotes: 26,
    title: "Cancelled our 3D try-on subscription — too expensive and clunky setup. Alternatives?",
    body: "We switched away from one of the big 3D try-on apps last week. $1800/mo, needed a developer for every theme change, and the render time was hurting PDP speed. Frustrated with the whole category honestly. Is there something lighter-weight that still reduces size-related returns?",
  },
  {
    key: "linkedin-returns", communityName: "LinkedIn", platform: "LINKEDIN", ageHours: 12, author: "Sarah Mitchell", replyCount: 3, upvotes: 34,
    title: "Returns ate 11 points of margin last quarter. Rethinking everything.",
    body: "Unpopular opinion: most 'returns problem' advice is wrong for small fashion brands. We're a 12-person label — free returns shipping just taught customers to over-order. Our returns rate is 28% and I'm publicly documenting every experiment we run to fix it (sizing, PDP content, packaging inserts). Follow along if you're in the same boat — I'll share the numbers.",
  },
  {
    key: "agency-partner", communityName: "Online Geniuses", platform: "SLACK", ageHours: 30, author: "growth_dana", replyCount: 5, upvotes: 0,
    title: "Looking for a partner: we run CRO for fashion brands and need a visualization tool to recommend",
    body: "My agency does conversion work for about 20 fashion DTC brands. Clients keep asking us to recommend product visualization / try-on tooling and I don't have a great answer. Any founders here want to partner up? We'd want a referral arrangement and a case study.",
  },
];

const AIDEV: Template[] = [
  {
    key: "repro-bugs", communityName: "Hacker News", platform: "HACKERNEWS", ageHours: 5, author: "eng_director_throw", replyCount: 18, upvotes: 42,
    title: "How do we reproduce AI-generated code bugs before they hit prod?",
    body: "Our team merged an agent-generated PR that passed evals and broke auth for 4 hours. The eval suite was too narrow. How are other teams reproducing AI-generated code bugs? We're looking for something that replays agent runs against real repos, not toy benchmarks.",
  },
  {
    key: "agent-evals", communityName: "r/MachineLearning", platform: "REDDIT", ageHours: 8, author: "eval_pragmatist", replyCount: 22, upvotes: 57,
    title: "Looking for AI agent evaluation tools that aren't notebooks and spreadsheets",
    body: "We have 6 agents in production and our 'eval infra' is a spreadsheet and hope. Anyone tried the eval platforms in this space? I need software that tracks regressions across prompt changes, not just single-run scores. Budget exists but not $10k/mo.",
  },
  {
    key: "benchmark-agents", communityName: "Hacker News", platform: "HACKERNEWS", ageHours: 27, author: "pl_bench", replyCount: 31, upvotes: 88,
    title: "How do we benchmark coding agents on our actual codebase?",
    body: "Public benchmarks (SWE-bench etc.) don't reflect our monorepo. Anyone built internal benchmarks for coding agents? Curious about harness design, eval set curation, and whether it's worth the eng time. Urgent-ish: leadership wants an agent adoption decision by next week.",
  },
  {
    key: "competitor-dissat", communityName: "r/LocalLLaMA", platform: "REDDIT", ageHours: 34, author: "selfhost_sam", replyCount: 15, upvotes: 40,
    title: "Frustrated with our LLM observability vendor — pricing doubled. Alternatives?",
    body: "Our trace bill just doubled with no warning. We're a 12-eng team. Moving away from our current vendor before renewal. Anyone self-hosting eval/tracing? What do you use for regression detection when prompts change?",
  },
];

const FINTECH: Template[] = [
  {
    key: "invoice-automation", communityName: "r/Bookkeeping", platform: "REDDIT", ageHours: 4, author: "firm_ops_amy", replyCount: 9, upvotes: 19,
    title: "Does anyone know a tool for automating invoice capture for a small accounting firm?",
    body: "We're a 6-person firm doing 60+ client books. Every month my team re-types the same invoices into QuickBooks. I'm looking for a tool that captures and codes invoices automatically without a 6-week onboarding. Does it exist for firms our size?",
  },
  {
    key: "client-docs", communityName: "r/Accounting", platform: "REDDIT", ageHours: 16, author: "cpa_chasing_docs", replyCount: 13, upvotes: 31,
    title: "Chasing clients for documents is eating my week — need software that stops this",
    body: "I spend ~8 hours a week emailing clients for missing receipts and statements. I need something that automates the chasing (reminders, a portal, statuses). Anyone used anything that clients actually comply with? Tax season is coming and I can't do this again.",
  },
  {
    key: "quickbooks-alt", communityName: "r/smallbusiness", platform: "REDDIT", ageHours: 44, author: "shop_owner_gary", replyCount: 20, upvotes: 28,
    title: "Is there an alternative to hiring a bookkeeper just for invoice entry?",
    body: "I get quoted $600/mo for bookkeeping and 80% of it is data entry from my invoices and receipts. Looking for something cheaper — does anyone know a tool or service that automates this without me learning accounting software?",
  },
];

const GENERIC: Template[] = [
  {
    key: "gen-tool-hunt", communityName: "r/SaaS", platform: "REDDIT", ageHours: 6, author: "ops_marta", replyCount: 11, upvotes: 24,
    title: "Looking for a tool to replace our spreadsheet workflow — recommendations?",
    body: "We've outgrown our spreadsheet process (12 people, constant version conflicts). Looking for a tool that handles this without a 3-month implementation. Any recommendations from people who switched recently? What did it cost?",
  },
  {
    key: "gen-expensive", communityName: "Hacker News", platform: "HACKERNEWS", ageHours: 22, author: "bootstrapper_ben", replyCount: 26, upvotes: 51,
    title: "Our vendor raised prices 40%. Anyone found a cheaper alternative?",
    body: "Renewal came in 40% higher. We're a bootstrapped team and this category has one dominant vendor. Is there an alternative people are happy with, or are we stuck? Urgent: renewal is in 3 weeks.",
  },
  {
    key: "gen-how-do-i", communityName: "r/smallbusiness", platform: "REDDIT", ageHours: 48, author: "first_time_founder", replyCount: 7, upvotes: 13,
    title: "How do I stop doing everything manually without hiring?",
    body: "Solo operator, drowning in manual process work. I wish there was software that just handled the repetitive parts. How do you all automate without hiring or buying enterprise suites?",
  },
  {
    key: "gen-partner", communityName: "Indie Hackers", platform: "OTHER", ageHours: 36, author: "agency_omar", replyCount: 4, upvotes: 8,
    title: "Consultant looking for tool partners to recommend to clients",
    body: "I consult for small teams on operations. Clients constantly ask for tool recommendations in this space. Anyone want to partner up on a referral arrangement? I only recommend things I've actually used.",
  },
];

const POOLS: Record<string, Template[]> = {
  "fashion-ecommerce": FASHION,
  "ai-devtools": AIDEV,
  "accounting-fintech": FINTECH,
  generic: GENERIC,
};

const SUBREDDIT_KEYS: Record<string, string> = {
  "r/shopify": "r/shopify", "r/ecommerce": "r/ecommerce", "r/fashionbusiness": "r/fashionbusiness",
  "r/Bookkeeping": "r/Bookkeeping", "r/Accounting": "r/Accounting", "r/smallbusiness": "r/smallbusiness",
  "r/SaaS": "r/SaaS", "r/MachineLearning": "r/MachineLearning", "r/LocalLLaMA": "r/LocalLLaMA",
};

/** Generate sandbox candidates for an archetype. Deterministic ids per product+template. */
export function generateSandboxCandidates(archetypeId: string, ctx: SandboxCtx): RawCandidate[] {
  const pool = POOLS[archetypeId] ?? GENERIC;
  const salt = ctx.productName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) || "prod";
  return pool.map((t, i) => ({
    adapter: "sandbox",
    externalId: `sb-${salt}-${t.key}-${i}`,
    platform: t.platform === "LinkedIn" ? "LINKEDIN" : t.platform,
    communityName: SUBREDDIT_KEYS[t.communityName] ?? t.communityName,
    url: t.platform === "LINKEDIN" ? null : `https://example.com/${t.communityName.replace(/^r\//, "")}/${t.key}`,
    title: t.title,
    body: t.body,
    author: t.author,
    authorUrl: null,
    postedAt: new Date(Date.now() - t.ageHours * 3_600_000),
    replyCount: t.replyCount,
    vendorMentions: /cancel|switched|frustrated|moved away/i.test(t.title + t.body) ? 1 : 0,
    upvotes: t.upvotes,
    isPartnerSignal: /partner|agency|consultant|referral/i.test(t.title + t.body),
  }));
}
