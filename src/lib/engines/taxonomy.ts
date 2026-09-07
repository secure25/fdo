/**
 * Domain taxonomy: industry archetypes, acquisition-channel catalog and
 * community catalog. Used by the Product Analyst, Distribution Map,
 * Discovery adapters and the sandbox source.
 * Extend by adding entries — no engine code needs to change.
 */

// ─── Channels ─────────────────────────────────────────────────────────────────

export type ChannelGroupId =
  | "COMMUNITIES"
  | "SOCIAL"
  | "SEARCH"
  | "DIRECT"
  | "PARTNERSHIPS"
  | "DIRECTORIES";

export const CHANNEL_GROUPS: { id: ChannelGroupId; label: string; blurb: string }[] = [
  { id: "COMMUNITIES", label: "Communities", blurb: "Reddit, Discord, Facebook groups, Indie Hackers, forums, Slack" },
  { id: "SOCIAL", label: "Social", blurb: "LinkedIn, X, YouTube, TikTok, Instagram" },
  { id: "SEARCH", label: "Search", blurb: "Google, Bing, long-tail, question searches, AI search visibility" },
  { id: "DIRECT", label: "Direct", blurb: "Email, LinkedIn outreach, founder outreach" },
  { id: "PARTNERSHIPS", label: "Partnerships", blurb: "Agencies, consultants, affiliates, influencers, newsletters, integrators" },
  { id: "DIRECTORIES", label: "Directories & Marketplaces", blurb: "Product Hunt, G2, Capterra, AlternativeTo, ecosystem marketplaces" },
];

export type ChannelDef = {
  name: string;
  group: ChannelGroupId;
  url?: string;
  baseIcpFit: number;
  baseIntent: number;
  baseCompetition: number; // lower is better
  baseConversion: number;
  baseEffort: 1 | 2 | 3; // LOW/MEDIUM/HIGH
  strategy: string;
};

export const CHANNEL_CATALOG: ChannelDef[] = [
  // Communities
  { name: "Reddit", group: "COMMUNITIES", url: "https://reddit.com", baseIcpFit: 78, baseIntent: 88, baseCompetition: 45, baseConversion: 62, baseEffort: 2,
    strategy: "Answer questions genuinely inside the problem threads. Lead with help, mention your product only where contextually appropriate, disclose affiliation." },
  { name: "Discord", group: "COMMUNITIES", baseIcpFit: 64, baseIntent: 58, baseCompetition: 30, baseConversion: 40, baseEffort: 2,
    strategy: "Become a familiar helper in 2–3 servers where your ICP hangs out. Presence compounds; links drop in naturally after trust." },
  { name: "Facebook Groups", group: "COMMUNITIES", baseIcpFit: 62, baseIntent: 55, baseCompetition: 38, baseConversion: 38, baseEffort: 2,
    strategy: "Operator-heavy groups respond to concrete teardowns and checklists. Avoid link-dumping; reply to posts asking for help." },
  { name: "Indie Hackers", group: "COMMUNITIES", url: "https://indiehackers.com", baseIcpFit: 55, baseIntent: 45, baseCompetition: 55, baseConversion: 35, baseEffort: 1,
    strategy: "Build-in-public posts and founder interviews. Strong for early feedback and backlinks, weaker for near-term buying intent." },
  { name: "Niche forums", group: "COMMUNITIES", baseIcpFit: 70, baseIntent: 74, baseCompetition: 22, baseConversion: 55, baseEffort: 2,
    strategy: "Old but high-intent: operator forums index well on Google and rank for 'how do I' threads. Answer evergreen questions." },
  { name: "Slack communities", group: "COMMUNITIES", baseIcpFit: 66, baseIntent: 60, baseCompetition: 34, baseConversion: 45, baseEffort: 2,
    strategy: "Professional channels where practitioners ask peers for tool recommendations. Contribute to #tools threads when asked." },
  // Social
  { name: "LinkedIn", group: "SOCIAL", baseIcpFit: 72, baseIntent: 48, baseCompetition: 55, baseConversion: 42, baseEffort: 2,
    strategy: "Founder-led educational posts on the exact problem you solve. Comment on ICP posts before posting your own." },
  { name: "X (Twitter)", group: "SOCIAL", baseIcpFit: 58, baseIntent: 42, baseCompetition: 60, baseConversion: 30, baseEffort: 1,
    strategy: "Build in public + reply to pain-point threads. Fast feedback loop, low intent density." },
  { name: "YouTube", group: "SOCIAL", baseIcpFit: 60, baseIntent: 70, baseCompetition: 65, baseConversion: 55, baseEffort: 3,
    strategy: "Tutorial and comparison videos capture 'how to' and 'vs' searches. Slow start, compounding intent capture." },
  { name: "TikTok", group: "SOCIAL", baseIcpFit: 42, baseIntent: 35, baseCompetition: 55, baseConversion: 28, baseEffort: 2,
    strategy: "Only if your ICP is consumer or SMB owners under 40. Show the product solving one visible problem in 30s." },
  { name: "Instagram", group: "SOCIAL", baseIcpFit: 44, baseIntent: 38, baseCompetition: 58, baseConversion: 30, baseEffort: 2,
    strategy: "Visual proof of outcomes works: before/after, teardowns, DM-first conversations." },
  // Search
  { name: "Google long-tail", group: "SEARCH", baseIcpFit: 68, baseIntent: 84, baseCompetition: 62, baseConversion: 66, baseEffort: 2,
    strategy: "Programmatic comparison and alternative pages: '{competitor} alternative', 'best {category} for {niche}'." },
  { name: "Bing", group: "SEARCH", baseIcpFit: 60, baseIntent: 78, baseCompetition: 30, baseConversion: 55, baseEffort: 1,
    strategy: "Cheap incremental traffic; older operator demographics. Mirror your Google long-tail pages with proper sitemap." },
  { name: "Question engines", group: "SEARCH", baseIcpFit: 58, baseIntent: 80, baseCompetition: 40, baseConversion: 50, baseEffort: 1,
    strategy: "Answer the highest-intent questions on Quora/StackExchange-adjacent sites; each answer indexes for years." },
  { name: "AI search visibility", group: "SEARCH", baseIcpFit: 55, baseIntent: 72, baseCompetition: 25, baseConversion: 60, baseEffort: 2,
    strategy: "Get listed in directories and comparison articles that LLM answers cite; keep structured product info consistent." },
  // Direct
  { name: "Email outreach", group: "DIRECT", baseIcpFit: 80, baseIntent: 55, baseCompetition: 50, baseConversion: 60, baseEffort: 2,
    strategy: "Only to prospects who publicly expressed the problem. Reference their exact situation in line one; one short CTA." },
  { name: "LinkedIn outreach", group: "DIRECT", baseIcpFit: 78, baseIntent: 52, baseCompetition: 55, baseConversion: 55, baseEffort: 2,
    strategy: "Connect with a note about their public problem, not your product. Warm them with a comment first." },
  { name: "Founder-to-founder", group: "DIRECT", baseIcpFit: 70, baseIntent: 48, baseCompetition: 35, baseConversion: 50, baseEffort: 1,
    strategy: "Peer credibility converts solo-founder ICPs. Offer help with their current problem, no ask." },
  // Partnerships
  { name: "Agencies", group: "PARTNERSHIPS", baseIcpFit: 74, baseIntent: 40, baseCompetition: 45, baseConversion: 70, baseEffort: 2,
    strategy: "One agency relationship brings many clients. Offer a partner margin and a co-branded case study." },
  { name: "Consultants", group: "PARTNERSHIPS", baseIcpFit: 70, baseIntent: 42, baseCompetition: 38, baseConversion: 65, baseEffort: 2,
    strategy: "Consultants need tools to recommend. Give them a demo sandbox and a referral cut." },
  { name: "Affiliates", group: "PARTNERSHIPS", baseIcpFit: 55, baseIntent: 35, baseCompetition: 55, baseConversion: 55, baseEffort: 2,
    strategy: "Publish a competitive affiliate program on your site; recruit creators who already review your category." },
  { name: "Newsletter operators", group: "PARTNERSHIPS", baseIcpFit: 62, baseIntent: 45, baseCompetition: 48, baseConversion: 60, baseEffort: 1,
    strategy: "Sponsor or swap with niche newsletters your ICP reads. Negotiate a dedicated send, not a classified ad." },
  { name: "Influencers", group: "PARTNERSHIPS", baseIcpFit: 50, baseIntent: 38, baseCompetition: 60, baseConversion: 45, baseEffort: 2,
    strategy: "Micro-influencers with operator audiences outconvert big names. Ask for a workflow video, not an ad." },
  { name: "Integrators", group: "PARTNERSHIPS", baseIcpFit: 66, baseIntent: 40, baseCompetition: 40, baseConversion: 68, baseEffort: 3,
    strategy: "If your product sits next to a platform, build the integration and get listed in their ecosystem marketplace." },
  // Directories
  { name: "Product Hunt", group: "DIRECTORIES", url: "https://producthunt.com", baseIcpFit: 50, baseIntent: 40, baseCompetition: 70, baseConversion: 35, baseEffort: 1,
    strategy: "One well-prepared launch: assets, first-comment story, hunter network. Expect spike + long-tail directory traffic." },
  { name: "G2", group: "DIRECTORIES", url: "https://g2.com", baseIcpFit: 60, baseIntent: 85, baseCompetition: 60, baseConversion: 62, baseEffort: 2,
    strategy: "High commercial intent. Seed early reviews from design partners; category pages convert." },
  { name: "Capterra", group: "DIRECTORIES", baseIcpFit: 58, baseIntent: 82, baseCompetition: 55, baseConversion: 58, baseEffort: 2,
    strategy: "SMB buyers with budgets. Reviews matter more than listing polish." },
  { name: "AlternativeTo", group: "DIRECTORIES", url: "https://alternativeto.net", baseIcpFit: 55, baseIntent: 88, baseCompetition: 35, baseConversion: 60, baseEffort: 1,
    strategy: "List against every competitor; captures 'alternative to X' search traffic with clear intent." },
  { name: "Ecosystem marketplaces", group: "DIRECTORIES", baseIcpFit: 72, baseIntent: 76, baseCompetition: 48, baseConversion: 72, baseEffort: 2,
    strategy: "If your ICP lives on a platform (Shopify, WordPress, HubSpot), the marketplace is the highest-fit channel you have." },
];

// ─── Communities ──────────────────────────────────────────────────────────────

export type CommunitySeed = {
  key: string;
  platform: "REDDIT" | "DISCORD" | "FACEBOOK" | "SLACK" | "FORUM" | "HACKERNEWS" | "OTHER";
  name: string;
  url: string;
  focus: string;
  memberEstimate: string;
  rules: string[];
  archetypeTags: string[]; // archetype ids this community fits
};

export const COMMUNITIES: CommunitySeed[] = [
  { key: "r/ecommerce", platform: "REDDIT", name: "r/ecommerce", url: "https://reddit.com/r/ecommerce", focus: "Store owners discussing operations, conversion and tools", memberEstimate: "980k", rules: ["No direct advertising", "Disclose affiliation", "Be specific"], archetypeTags: ["fashion-ecommerce", "ecommerce-general"] },
  { key: "r/shopify", platform: "REDDIT", name: "r/shopify", url: "https://reddit.com/r/shopify", focus: "Shopify merchants: apps, themes, growth problems", memberEstimate: "480k", rules: ["No app self-promo outside weekly thread", "Flair required", "No DMs solicitation"], archetypeTags: ["fashion-ecommerce", "ecommerce-general"] },
  { key: "r/fashionbusiness", platform: "REDDIT", name: "r/fashionbusiness", url: "https://reddit.com/r/fashionbusiness", focus: "Fashion brand founders and operators", memberEstimate: "120k", rules: ["No spam", "Constructive feedback only"], archetypeTags: ["fashion-ecommerce"] },
  { key: "r/smallbusiness", platform: "REDDIT", name: "r/smallbusiness", url: "https://reddit.com/r/smallbusiness", focus: "General SMB operators", memberEstimate: "3.4M", rules: ["No promos", "Text-only sundays"], archetypeTags: ["accounting-fintech", "productivity", "hr-recruiting", "generic"] },
  { key: "r/SaaS", platform: "REDDIT", name: "r/SaaS", url: "https://reddit.com/r/SaaS", focus: "SaaS founders and operators", memberEstimate: "140k", rules: ["No self-promo except showcase thread", "Value-first posts"], archetypeTags: ["devtools", "ai-devtools", "marketing-saas", "analytics", "crm-sales", "productivity", "generic"] },
  { key: "r/startups", platform: "REDDIT", name: "r/startups", url: "https://reddit.com/r/startups", focus: "Early-stage founders", memberEstimate: "1.3M", rules: ["No promos", "Share learnings"], archetypeTags: ["generic", "ai-agents", "devtools"] },
  { key: "r/Entrepreneur", platform: "REDDIT", name: "r/Entrepreneur", url: "https://reddit.com/r/Entrepreneur", focus: "Entrepreneurship broadly", memberEstimate: "4.2M", rules: ["No affiliate spam", "No 'hustle' crossposting"], archetypeTags: ["generic", "ecommerce-general", "marketing-saas"] },
  { key: "r/webdev", platform: "REDDIT", name: "r/webdev", url: "https://reddit.com/r/webdev", focus: "Web developers", memberEstimate: "2.1M", rules: ["No low-effort tool spam", "Readers: contextual"], archetypeTags: ["devtools", "no-code-automation", "security"] },
  { key: "r/ExperiencedDevs", platform: "REDDIT", name: "r/ExperiencedDevs", url: "https://reddit.com/r/ExperiencedDevs", focus: "Senior engineering discussion", memberEstimate: "640k", rules: ["No junior questions", "No recruiting spam"], archetypeTags: ["devtools", "ai-devtools", "security"] },
  { key: "r/Accounting", platform: "REDDIT", name: "r/Accounting", url: "https://reddit.com/r/Accounting", focus: "Accountants and firm staff", memberEstimate: "380k", rules: ["No client solicitation", "Career advice welcome"], archetypeTags: ["accounting-fintech"] },
  { key: "r/Bookkeeping", platform: "REDDIT", name: "r/Bookkeeping", url: "https://reddit.com/r/Bookkeeping", focus: "Bookkeepers and firm owners", memberEstimate: "60k", rules: ["No software spam without disclosure"], archetypeTags: ["accounting-fintech"] },
  { key: "r/marketing", platform: "REDDIT", name: "r/marketing", url: "https://reddit.com/r/marketing", focus: "Marketing practitioners", memberEstimate: "1.6M", rules: ["No promos", "Specific questions only"], archetypeTags: ["marketing-saas", "generic"] },
  { key: "r/PPC", platform: "REDDIT", name: "r/PPC", url: "https://reddit.com/r/PPC", focus: "Paid acquisition practitioners", memberEstimate: "160k", rules: ["No agency solicitations"], archetypeTags: ["marketing-saas", "ecommerce-general"] },
  { key: "r/MachineLearning", platform: "REDDIT", name: "r/MachineLearning", url: "https://reddit.com/r/MachineLearning", focus: "ML research and engineering", memberEstimate: "2.7M", rules: ["No hype posts", "Papers and tooling welcome"], archetypeTags: ["ai-devtools", "ai-agents", "analytics"] },
  { key: "r/LocalLLaMA", platform: "REDDIT", name: "r/LocalLLaMA", url: "https://reddit.com/r/LocalLLaMA", focus: "Local/self-hosted AI tooling", memberEstimate: "520k", rules: ["Discussion-first", "No affiliate links"], archetypeTags: ["ai-devtools", "ai-agents"] },
  { key: "r/HR", platform: "REDDIT", name: "r/humanresources", url: "https://reddit.com/r/humanresources", focus: "HR practitioners", memberEstimate: "90k", rules: ["No vendor pitches"], archetypeTags: ["hr-recruiting"] },
  { key: "r/sales", platform: "REDDIT", name: "r/sales", url: "https://reddit.com/r/sales", focus: "Sales professionals", memberEstimate: "340k", rules: ["No CRM affiliate spam"], archetypeTags: ["crm-sales"] },
  { key: "r/edtech", platform: "REDDIT", name: "r/edtech", url: "https://reddit.com/r/edtech", focus: "Education technology", memberEstimate: "45k", rules: ["Educator-first discussion"], archetypeTags: ["education"] },
  { key: "r/devops", platform: "REDDIT", name: "r/devops", url: "https://reddit.com/r/devops", focus: "DevOps and platform engineering", memberEstimate: "540k", rules: ["No tool spam", "War stories welcome"], archetypeTags: ["devtools", "security", "ai-devtools"] },
  { key: "hn", platform: "HACKERNEWS", name: "Hacker News", url: "https://news.ycombinator.com", focus: "Technical founders and engineers", memberEstimate: "n/a", rules: ["No naked pitches", "Answer the question asked", "Disclose affiliation"], archetypeTags: ["devtools", "ai-devtools", "ai-agents", "analytics", "no-code-automation", "productivity", "generic"] },
  { key: "ih", platform: "OTHER", name: "Indie Hackers", url: "https://indiehackers.com", focus: "Indie founders sharing revenue and growth", memberEstimate: "150k", rules: ["Community-first", "No drive-by promos"], archetypeTags: ["generic", "marketing-saas", "productivity", "ai-agents"] },
  { key: "shopify-forums", platform: "FORUM", name: "Shopify Community Forums", url: "https://community.shopify.com", focus: "Merchant Q&A on apps and operations", memberEstimate: "1.1M", rules: ["Partner flag required for app mentions"], archetypeTags: ["fashion-ecommerce", "ecommerce-general"] },
  { key: "og-slack", platform: "SLACK", name: "Online Geniuses", url: "https://onlinegeniuses.com", focus: "Marketing Slack community", memberEstimate: "35k", rules: ["No DM spam", "Share in channels"], archetypeTags: ["marketing-saas", "ecommerce-general"] },
  { key: "shopify-discord", platform: "DISCORD", name: "Shopify Entrepreneurs Discord", url: "https://discord.com", focus: "Merchant help and app chatter", memberEstimate: "18k", rules: ["No unsolicited DMs", "Use help channels"], archetypeTags: ["fashion-ecommerce", "ecommerce-general"] },
  { key: "fb-ecom", platform: "FACEBOOK", name: "Ecommerce Entrepreneurs Group", url: "https://facebook.com/groups", focus: "Store owner support group", memberEstimate: "240k", rules: ["No link dumping", "Value-first answers"], archetypeTags: ["ecommerce-general", "fashion-ecommerce"] },
];

// ─── Industry archetypes ──────────────────────────────────────────────────────

export type PersonaSeed = { name: string; role: string; quote: string; goals: string[]; pains: string[]; wateringHoles: string[] };

export type Archetype = {
  id: string;
  label: string;
  category: string;
  keywords: string[]; // detection tokens
  problems: string[];
  useCases: string[];
  seoKeywords: string[];
  buyingTriggers: string[];
  objections: string[];
  icp: { name: string; description: string; buyerRole: string; seniority: string; companySize: string; geography: string };
  personas: PersonaSeed[];
  competitors: { name: string; url: string; positioning: string }[];
  channelAffinity: Partial<Record<string, number>>; // per-channel modifier -25..+25
  communityKeys: string[];
};

const genericPersonas: PersonaSeed[] = [
  { name: "The Solo Founder", role: "Founder / CEO", quote: "I can build it. I can't reach everyone who needs it.", goals: ["First paying customers", "Repeatable acquisition"], pains: ["No distribution playbook", "No time for marketing"], wateringHoles: ["Indie Hackers", "X (Twitter)", "Reddit"] },
  { name: "The Operator", role: "Head of Operations", quote: "If it saves my team an hour a day, I'll sign today.", goals: ["Team throughput", "Fewer manual errors"], pains: ["Tool sprawl", "Manual processes"], wateringHoles: ["LinkedIn", "Slack communities", "G2"] },
];

const genericCompetitors = (cat: string) => [
  { name: "Legacy Suite", url: "#", positioning: `Incumbent ${cat} platform, broad but bloated` },
  { name: "PointTool Pro", url: "#", positioning: "Single-feature tool with strong SEO presence" },
  { name: "Spreadsheet + Manual", url: "#", positioning: "The default 'competitor': people doing it by hand" },
];

export const ARCHETYPES: Archetype[] = [
  {
    id: "fashion-ecommerce",
    label: "AI fashion / ecommerce technology",
    category: "AI fashion technology",
    keywords: ["fashion", "apparel", "clothing", "try-on", "virtual try-on", "garment", "outfit", "retail", "shopify", "ecommerce", "e-commerce", "returns", "size", "fit", "wardrobe", "merch", "store", "boutique", "dtc"],
    problems: ["Low product-page conversion", "High return rates from sizing uncertainty", "Poor product visualization", "Customer hesitation without a try-on experience", "Manual photo production for every SKU"],
    useCases: ["Virtual try-on on product pages", "AI product photography at catalog scale", "Fit guidance to cut returns", "New-collection launch visuals without shoots"],
    seoKeywords: ["virtual try-on shopify", "ai fashion model photography", "reduce clothing returns app", "ai product photography fashion", "try before you buy ecommerce tool", "shopify model images ai", "fashion conversion optimization", "size recommendation app"],
    buyingTriggers: ["High return rate eating margins", "New collection launch", "Conversion rate below benchmark", "Ad costs rising (need better PDP)", "Marketplace expansion requiring localized visuals"],
    objections: ["Will AI images look fake?", "Integration effort with our theme", "Per-image cost at our catalog size", "Does it work with our existing photos?"],
    icp: { name: "Online fashion retailers", description: "DTC fashion brands and multi-brand retailers selling apparel online", buyerRole: "Founder / Head of Ecommerce", seniority: "Founder to Director", companySize: "2–50 employees, $500k–$20M GMV", geography: "US, EU, UK" },
    personas: [
      { name: "The Founder-Merchant", role: "Founder, DTC brand", quote: "Returns are killing our margins and I don't know why people size wrong.", goals: ["Lower return rate", "Higher PDP conversion", "Launch collections faster"], pains: ["Photo shoots cost $5k+", "Sizing confusion", "Cash tied in returns"], wateringHoles: ["r/shopify", "r/ecommerce", "Shopify Community Forums", "LinkedIn"] },
      { name: "The Ecommerce Lead", role: "Head of Ecommerce", quote: "I need PDP conversion up 10% without another re-platform.", goals: ["Conversion rate", "AOV", "Fewer support tickets"], pains: ["Content backlog", "Theme constraints", "Executive pressure on CAC"], wateringHoles: ["r/ecommerce", "LinkedIn", "G2", "Online Geniuses"] },
    ],
    competitors: [
      { name: "Botika", url: "https://botika.io", positioning: "AI fashion models for apparel photography" },
      { name: "VMake", url: "https://vmake.ai", positioning: "AI product visuals for ecommerce" },
      { name: "3DLOOK", url: "https://3dlook.com", positioning: "Mobile body-measurement and fit tech" },
    ],
    channelAffinity: { Reddit: 16, LinkedIn: 10, "Ecosystem marketplaces": 22, Instagram: 12, TikTok: 12, "Google long-tail": 8, Capterra: 4, G2: 4, Pinterest: 10 },
    communityKeys: ["r/shopify", "r/ecommerce", "r/fashionbusiness", "shopify-forums", "shopify-discord", "fb-ecom", "og-slack"],
  },
  {
    id: "ai-devtools",
    label: "AI developer tooling",
    category: "AI developer tools",
    keywords: ["developer", "code", "coding", "agent", "eval", "evaluation", "benchmark", "sdk", "api", "cli", "test", "testing", "debug", "regression", "llm", "copilot", "prompt", "engineering", "ci", "devtool", "reproduce"],
    problems: ["AI-generated code introduces regressions nobody catches", "Agent behavior is nondeterministic and hard to evaluate", "No benchmarks reflect real codebases", "Debugging agent runs is slow and manual"],
    useCases: ["Regression test generation for AI-written code", "Agent evaluation suites", "Benchmarking coding agents on real repos", "Run replay and diffing"],
    seoKeywords: ["ai agent evaluation tool", "llm testing framework", "coding agent benchmark", "ai code review tool", "llm regression testing", "agent eval platform", "reproduce ai bugs", "ci for llm apps"],
    buyingTriggers: ["Incident caused by AI-generated PR", "Team adopting coding agents at scale", "Compliance/audit requirement", "Evaluation fatigue with spreadsheets"],
    objections: ["Another dashboard to maintain?", "Works with our stack?", "Pricing per seat vs per run?"],
    icp: { name: "AI startups & engineering teams", description: "Technical founders and platform teams shipping LLM/agent features", buyerRole: "CTO / Staff Engineer", seniority: "Staff+ or CTO", companySize: "5–100 engineers", geography: "Global, remote-heavy" },
    personas: [
      { name: "The Staff Engineer", role: "Staff/Principal Engineer", quote: "Our agents pass the demo and fail production weekly.", goals: ["Catch regressions pre-merge", "Trustworthy evals"], pains: ["Flaky evals", "No repro for agent bugs"], wateringHoles: ["Hacker News", "r/MachineLearning", "r/devops", "GitHub"] },
      { name: "The AI-Native CTO", role: "CTO, AI startup", quote: "We ship agent features faster than we can verify them.", goals: ["Velocity with safety", "Audit trail"], pains: ["Incidents", "Benchmarks don't match our domain"], wateringHoles: ["Hacker News", "r/LocalLLaMA", "X (Twitter)", "Discord"] },
    ],
    competitors: [
      { name: "LangSmith", url: "https://smith.langchain.com", positioning: "LLM app observability and evals" },
      { name: "Braintrust", url: "https://braintrust.dev", positioning: "Eval and prompt playground platform" },
      { name: "Hamel-style DIY evals", url: "#", positioning: "Hand-rolled notebooks and spreadsheets" },
    ],
    channelAffinity: { "Hacker News": 25, Reddit: 14, "X (Twitter)": 12, Discord: 12, "Google long-tail": 8, "Product Hunt": 8, YouTube: -6, TikTok: -20, Instagram: -20 },
    communityKeys: ["hn", "r/MachineLearning", "r/LocalLLaMA", "r/webdev", "r/devops", "r/ExperiencedDevs", "ih"],
  },
  {
    id: "accounting-fintech",
    label: "Accounting / finance automation",
    category: "Fintech / accounting automation",
    keywords: ["invoice", "invoicing", "accounting", "bookkeeping", "billing", "expense", "ledger", "reconcil", "tax", "payroll", "quickbooks", "xero", "cpa", "firm", "finance", "payment", "cash flow"],
    problems: ["Manual invoice data entry wastes staff hours", "Late payments hurt firm cash flow", "Client document chasing is constant", "Reconciliation errors from manual work"],
    useCases: ["Automated invoice capture and coding", "Client document collection portals", "Recurring billing and reminders", "Practice-wide reporting"],
    seoKeywords: ["invoice automation for accounting firms", "accounts payable automation small firm", "quickbooks invoice automation", "client document collection tool", "reduce manual bookkeeping", "dunning automation", "practice management accounting"],
    buyingTriggers: ["Tax season overload", "New client onboarding pain", "Staff turnover", "Firm growth outpacing headcount"],
    objections: ["Is it compliant with our workflow?", "Will it work with QuickBooks/Xero?", "Staff learning curve"],
    icp: { name: "Accounting & bookkeeping firms", description: "Small and mid-size firms serving SMB clients", buyerRole: "Firm Partner / Practice Manager", seniority: "Partner to Manager", companySize: "3–50 staff", geography: "US, UK, AU" },
    personas: [
      { name: "The Firm Partner", role: "Partner, accounting firm", quote: "Every month my team re-types the same fifty invoices.", goals: ["Staff leverage", "Fewer errors", "Faster close"], pains: ["Seasonal overload", "Chasing client docs", "Margin pressure"], wateringHoles: ["r/Accounting", "r/Bookkeeping", "LinkedIn", "Capterra"] },
      { name: "The Practice Manager", role: "Practice/Operations Manager", quote: "I need onboarding to stop taking two weeks.", goals: ["Standardized process", "Onboarding speed"], pains: ["Tool sprawl", "Training time"], wateringHoles: ["LinkedIn", "Capterra", "Slack communities"] },
    ],
    competitors: [
      { name: "Dext", url: "https://dext.com", positioning: "Receipt and invoice capture for accountants" },
      { name: "Karbon", url: "https://karbonhq.com", positioning: "Practice management for accounting firms" },
      { name: "QuickBooks (status quo)", url: "https://quickbooks.intuit.com", positioning: "The default ledger everyone already pays for" },
    ],
    channelAffinity: { Reddit: 10, LinkedIn: 14, Capterra: 18, G2: 14, "Email outreach": 12, "Google long-tail": 10, TikTok: -15, Instagram: -15 },
    communityKeys: ["r/Accounting", "r/Bookkeeping", "r/smallbusiness", "hn"],
  },
  {
    id: "devtools",
    label: "Developer tools",
    category: "Developer tools",
    keywords: ["infrastructure", "deploy", "deployment", "kubernetes", "docker", "monitoring", "observability", "database", "ci/cd", "pipeline", "cloud", "server", "backend", "framework", "library", "open source"],
    problems: ["Complex setup blocks adoption", "Debugging production issues takes too long", "Tooling sprawl across the stack"],
    useCases: ["Faster local-to-production loop", "Centralized observability", "Self-serve infrastructure"],
    seoKeywords: ["developer tools comparison", "self-hosted alternative", "infrastructure automation", "developer experience platform"],
    buyingTriggers: ["Incident postmortem", "Team growth", "Cloud bill shock"],
    objections: ["Migration effort", "Vendor lock-in", "Security review"],
    icp: { name: "Engineering teams", description: "Teams shipping software with real infrastructure needs", buyerRole: "Engineering Manager / Platform Lead", seniority: "EM or Senior+", companySize: "10–200 engineers", geography: "Global" },
    personas: genericPersonas,
    competitors: genericCompetitors("devtools"),
    channelAffinity: { "Hacker News": 22, Reddit: 14, "X (Twitter)": 8, "Product Hunt": 8, YouTube: -4, TikTok: -20, Instagram: -20 },
    communityKeys: ["hn", "r/webdev", "r/devops", "r/ExperiencedDevs", "ih"],
  },
  {
    id: "marketing-saas",
    label: "Marketing SaaS",
    category: "Marketing technology",
    keywords: ["marketing", "campaign", "seo", "content", "ads", "landing page", "email marketing", "newsletter", "social media", "copywriting", "brand", "lead generation", "conversion"],
    problems: ["Content production can't keep up with demand", "Campaign attribution is muddy", "Lead quality is low"],
    useCases: ["Content ideation and briefs", "Campaign analytics", "Lead enrichment and routing"],
    seoKeywords: ["marketing automation for agencies", "content brief tool", "campaign attribution software"],
    buyingTriggers: ["New campaign launch", "Agency client onboarded", "Revenue target miss"],
    objections: ["Another subscription", "Data accuracy", "Team adoption"],
    icp: { name: "Marketing teams & agencies", description: "In-house marketers and small agencies running client campaigns", buyerRole: "Head of Marketing / Agency Owner", seniority: "Manager to Director", companySize: "2–50 marketers", geography: "Global" },
    personas: genericPersonas,
    competitors: genericCompetitors("marketing"),
    channelAffinity: { LinkedIn: 14, "X (Twitter)": 8, Reddit: 8, "og-slack": 10, "Product Hunt": 6 },
    communityKeys: ["r/marketing", "r/PPC", "r/Entrepreneur", "og-slack", "ih"],
  },
  {
    id: "productivity",
    label: "Productivity software",
    category: "Productivity / work management",
    keywords: ["productivity", "notes", "tasks", "todo", "workflow", "automation", "calendar", "project management", "team", "docs", "knowledge", "meeting"],
    problems: ["Work scattered across too many tools", "Manual status updates", "Meetings without outcomes"],
    useCases: ["Unified task capture", "Automated status reporting", "Meeting-to-action workflows"],
    seoKeywords: ["team productivity tool", "notion alternative", "workflow automation for small teams"],
    buyingTriggers: ["Team reorg", "Remote work friction", "Tool consolidation push"],
    objections: ["Switching cost", "Team habits", "Data migration"],
    icp: { name: "Small knowledge-work teams", description: "Teams of 2–50 drowning in tools and status meetings", buyerRole: "Team Lead / Ops", seniority: "Lead", companySize: "2–50 people", geography: "Global" },
    personas: genericPersonas,
    competitors: genericCompetitors("productivity"),
    channelAffinity: { "Product Hunt": 10, "X (Twitter)": 8, Reddit: 6, LinkedIn: 4 },
    communityKeys: ["r/SaaS", "r/startups", "ih", "hn"],
  },
  {
    id: "analytics",
    label: "Analytics & data",
    category: "Analytics platform",
    keywords: ["analytics", "dashboard", "metrics", "data", "reporting", "bi", "warehouse", "track", "events", "funnel", "kpi", "insight"],
    problems: ["Data spread across sources with no single truth", "Dashboards nobody trusts", "Analysts are a bottleneck"],
    useCases: ["Self-serve dashboards", "Product analytics", "Revenue reporting"],
    seoKeywords: ["product analytics tool", "mixpanel alternative", "self-serve analytics for saas"],
    buyingTriggers: ["Board reporting pain", "Data team backlog", "Tool cost creep"],
    objections: ["Data accuracy", "Setup effort", "Query costs"],
    icp: { name: "Product & data teams", description: "SaaS product teams needing trustworthy self-serve metrics", buyerRole: "Head of Product / Data Lead", seniority: "Lead+", companySize: "10–200", geography: "Global" },
    personas: genericPersonas,
    competitors: genericCompetitors("analytics"),
    channelAffinity: { "Hacker News": 14, LinkedIn: 8, Reddit: 8, G2: 8 },
    communityKeys: ["hn", "r/SaaS", "ih"],
  },
  {
    id: "crm-sales",
    label: "CRM & sales tools",
    category: "Sales technology",
    keywords: ["crm", "sales", "pipeline", "deals", "outreach", "prospecting", "leads", "hubspot", "salesforce", "pipeline", "follow-up", "quotes"],
    problems: ["CRM hygiene never sticks", "Reps lose deals in follow-up", "Manual prospect research"],
    useCases: ["Automated pipeline updates", "Signal-based prospecting", "Follow-up sequencing"],
    seoKeywords: ["crm for small teams", "hubspot alternative", "sales signal tooling"],
    buyingTriggers: ["Pipeline review pain", "New rep ramp", "Missed quarter"],
    objections: ["Reps hate new tools", "Data migration", "Per-seat pricing"],
    icp: { name: "B2B sales teams", description: "Founder-led or small sales teams at B2B companies", buyerRole: "VP Sales / Founder", seniority: "VP+", companySize: "2–50 sellers", geography: "Global" },
    personas: genericPersonas,
    competitors: genericCompetitors("sales"),
    channelAffinity: { LinkedIn: 16, "LinkedIn outreach": 12, G2: 10, Capterra: 8, "Hacker News": -6 },
    communityKeys: ["r/sales", "r/SaaS", "ih"],
  },
  {
    id: "ai-agents",
    label: "AI applications",
    category: "Applied AI",
    keywords: ["ai", "gpt", "llm", "chatbot", "assistant", "copilot", "agent", "automation ai", "generative", "genai", "rag"],
    problems: ["AI demos that don't survive real workflows", "Cost per task too high", "Trust and review of AI output"],
    useCases: ["Workflow-specific AI assistants", "Human-in-the-loop review", "Domain-tuned automation"],
    seoKeywords: ["ai workflow automation", "ai assistant for {niche}", "human in the loop ai tool"],
    buyingTriggers: ["Cost pressure on manual work", "Competitor shipped AI feature", "Executive AI mandate"],
    objections: ["Accuracy", "Data privacy", "Is it just a wrapper?"],
    icp: { name: "Teams adopting AI workflows", description: "Teams under mandate to apply AI to real processes", buyerRole: "Ops / Team Lead", seniority: "Lead+", companySize: "2–100", geography: "Global" },
    personas: genericPersonas,
    competitors: genericCompetitors("AI"),
    channelAffinity: { "Hacker News": 10, "X (Twitter)": 10, "Product Hunt": 10, LinkedIn: 6, Reddit: 6 },
    communityKeys: ["hn", "r/SaaS", "r/LocalLLaMA", "ih"],
  },
  {
    id: "hr-recruiting",
    label: "HR & recruiting",
    category: "HR technology",
    keywords: ["hr", "recruiting", "hiring", "onboarding", "employee", "payroll", "benefits", "performance review", "applicant", "ats"],
    problems: ["Hiring pipelines are manual", "Onboarding is inconsistent", "Engagement data is invisible"],
    useCases: ["Applicant tracking", "Structured onboarding", "Performance reviews"],
    seoKeywords: ["recruiting software small company", "ats alternative", "onboarding checklist tool"],
    buyingTriggers: ["Hiring push", "HR compliance change", "Rapid growth"],
    objections: ["Candidate experience", "Compliance", "Cost per employee"],
    icp: { name: "HR teams at growing companies", description: "People ops at companies scaling from 10 to 200", buyerRole: "Head of People / HR Manager", seniority: "Manager+", companySize: "20–500 employees", geography: "Global" },
    personas: genericPersonas,
    competitors: genericCompetitors("HR"),
    channelAffinity: { LinkedIn: 16, Capterra: 10, G2: 10, "Hacker News": -10, TikTok: -12 },
    communityKeys: ["r/HR", "r/smallbusiness", "ih"],
  },
  {
    id: "education",
    label: "Education technology",
    category: "EdTech",
    keywords: ["education", "course", "learning", "student", "teacher", "school", "training", "lms", "curriculum", "tutor", "cohort"],
    problems: ["Engagement drops in self-paced courses", "Instructors spend hours on admin", "Assessment is manual"],
    useCases: ["Course authoring", "Student progress analytics", "Automated assessment"],
    seoKeywords: ["lms alternative", "course platform for creators", "student engagement tool"],
    buyingTriggers: ["Semester start", "Content backlog", "Grant/funding cycles"],
    objections: ["Student privacy", "LMS integration", "Pricing per seat"],
    icp: { name: "Educators & course creators", description: "Independent educators, bootcamps and training teams", buyerRole: "Program Director / Creator", seniority: "Director or independent", companySize: "1–50 staff", geography: "Global" },
    personas: genericPersonas,
    competitors: genericCompetitors("edtech"),
    channelAffinity: { YouTube: 12, Reddit: 6, "Google long-tail": 10, "Hacker News": -8 },
    communityKeys: ["r/edtech", "ih"],
  },
  {
    id: "generic",
    label: "Vertical SaaS (generic)",
    category: "B2B SaaS",
    keywords: [],
    problems: ["Manual processes that software should absorb", "Fragmented tooling", "No visibility into what works"],
    useCases: ["Core workflow automation", "Team collaboration on the core process", "Reporting and accountability"],
    seoKeywords: ["best {category} software", "{category} tool for small business", "{competitor} alternative"],
    buyingTriggers: ["Team growth", "Manual process breaking", "Customer complaints"],
    objections: ["Switching cost", "Price", "Will the team adopt it?"],
    icp: { name: "SMB operators", description: "Small teams doing the process manually today", buyerRole: "Founder / Ops Lead", seniority: "Founder to Manager", companySize: "1–50 people", geography: "Global" },
    personas: genericPersonas,
    competitors: genericCompetitors("B2B SaaS"),
    channelAffinity: { Reddit: 6, LinkedIn: 6, "Google long-tail": 8, Capterra: 6, G2: 6 },
    communityKeys: ["r/SaaS", "r/smallbusiness", "r/Entrepreneur", "ih", "hn"],
  },
];

export function detectArchetype(text: string): { archetype: Archetype; confidence: number; matched: string[] } {
  const lower = text.toLowerCase();
  let best: Archetype = ARCHETYPES[ARCHETYPES.length - 1]; // generic
  let bestScore = 0;
  let bestMatched: string[] = [];
  for (const a of ARCHETYPES) {
    if (a.id === "generic") continue;
    const matched = a.keywords.filter((k) => {
      const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`\\b${escaped}\\b`, "i").test(lower);
    });
    const score = matched.reduce((s, k) => s + (k.length > 6 ? 2 : 1), 0);
    if (score > bestScore) {
      best = a;
      bestScore = score;
      bestMatched = matched;
    }
  }
  const confidence = bestScore === 0 ? 30 : Math.min(95, 45 + bestScore * 7);
  return { archetype: best, confidence, matched: bestMatched };
}

// ─── Intent patterns ──────────────────────────────────────────────────────────

export type IntentType =
  | "PROBLEM_AWARENESS"
  | "SOLUTION_RESEARCH"
  | "VENDOR_COMPARISON"
  | "ACTIVE_BUYING"
  | "COMPETITOR_DISSATISFACTION"
  | "RECOMMENDATION_REQUEST"
  | "URGENT_NEED"
  | "PARTNERSHIP_OPPORTUNITY";

export type PatternMatch = {
  re: RegExp;
  intent: IntentType;
  base: number; // base buying-intent score
  signal?: "INTENT_PHRASE" | "COMPETITOR_MENTION" | "PRICE_SIGNAL" | "URGENCY" | "PARTNER_SIGNAL";
  /** When true, the match adds its signal/boost but never overrides the primary intent type. */
  signalOnly?: boolean;
};

export const INTENT_PATTERNS: PatternMatch[] = [
  { re: /looking for (a|an|some|the)?\s*[\w\s\-]{0,40}?(tool|software|solution|app|service|platform|alternative)/i, intent: "ACTIVE_BUYING", base: 90, signal: "INTENT_PHRASE" },
  { re: /i need (software|a tool|something|an app|a service)/i, intent: "ACTIVE_BUYING", base: 88, signal: "INTENT_PHRASE" },
  { re: /is there (an?|any)\s*(alternative|replacement) to/i, intent: "VENDOR_COMPARISON", base: 85, signal: "INTENT_PHRASE" },
  { re: /alternative to ([a-z0-9\.\- ]{2,30})/i, intent: "VENDOR_COMPARISON", base: 84, signal: "COMPETITOR_MENTION" },
  { re: /(does|does anyone|anyone) know (a|an|any|of)\s*(tool|app|service|software|solution)/i, intent: "RECOMMENDATION_REQUEST", base: 82, signal: "INTENT_PHRASE" },
  { re: /any (recommendations|suggestions|tools|apps) (for|on|to)/i, intent: "RECOMMENDATION_REQUEST", base: 78, signal: "INTENT_PHRASE" },
  { re: /anyone (tried|used|knows? of|familiar with)/i, intent: "SOLUTION_RESEARCH", base: 68, signal: "INTENT_PHRASE" },
  { re: /i wish (there was|someone would|this existed)/i, intent: "PROBLEM_AWARENESS", base: 66, signal: "INTENT_PHRASE" },
  { re: /why is there no (tool|app|product|good way)/i, intent: "PROBLEM_AWARENESS", base: 64, signal: "INTENT_PHRASE" },
  { re: /how do (i|we)|how can (i|we)|struggling with|stuck with|pain point/i, intent: "PROBLEM_AWARENESS", base: 55 },
  { re: /(cheaper|too expensive|pricey|costs? too much|budget)/i, intent: "VENDOR_COMPARISON", base: 76, signal: "PRICE_SIGNAL", signalOnly: true },
  { re: /(switched|moved|moving) (away )?from|unhappy with|frustrated with|hate (using )?|cancelled|canceled|left ([a-z0-9\.\- ]{2,30})/i, intent: "COMPETITOR_DISSATISFACTION", base: 82, signal: "COMPETITOR_MENTION" },
  { re: /(urgent|asap|deadline|by (tomorrow|friday|monday|next week)|this week|crunching)/i, intent: "URGENT_NEED", base: 86, signal: "URGENCY" },
  { re: /(agency|consultant|partnership|partner up|reseller|affiliate program|white.?label|integration partner|collab)/i, intent: "PARTNERSHIP_OPPORTUNITY", base: 60, signal: "PARTNER_SIGNAL" },
  { re: /what (do you|'s the best)|which (tool|app|software) (do you|would you)/i, intent: "RECOMMENDATION_REQUEST", base: 74, signal: "INTENT_PHRASE" },
  { re: /(recommend|recommended)/i, intent: "RECOMMENDATION_REQUEST", base: 66 },
];

export const INTENT_LABELS: Record<IntentType, string> = {
  PROBLEM_AWARENESS: "Problem awareness",
  SOLUTION_RESEARCH: "Solution research",
  VENDOR_COMPARISON: "Vendor comparison",
  ACTIVE_BUYING: "Active buying",
  COMPETITOR_DISSATISFACTION: "Competitor dissatisfaction",
  RECOMMENDATION_REQUEST: "Recommendation request",
  URGENT_NEED: "Urgent need",
  PARTNERSHIP_OPPORTUNITY: "Partnership opportunity",
};

// Known competitor names help lift vendor-competition signals
export const KNOWN_TOOL_NAMES = [
  "shopify", "woocommerce", "magento", "bigcommerce", "squarespace", "wix",
  "quickbooks", "xero", "freshbooks", "wave", "sap", "netsuite",
  "hubspot", "salesforce", "pipedrive", "notion", "asana", "trello", "monday",
  "langchain", "langsmith", "braintrust", "openai", "cursor", "copilot",
  "canva", "figma", "klaviyo", "mailchimp", "capterra", "g2",
];
