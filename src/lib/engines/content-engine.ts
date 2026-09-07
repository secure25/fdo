/**
 * Action + Content Engine (spec §9/§10).
 * Generates platform-native, contextual drafts (Reddit replies, LinkedIn posts,
 * X threads, YouTube ideas, SEO pages, outreach emails) with a deterministic
 * template engine and optional LLM polish. Every draft passes through the
 * same guardrail: spam-risk scoring + community warnings + "don't pitch yet".
 */

import { tryAI } from "../ai/provider";
import { hasAI } from "../env";
import { INTENT_LABELS, type IntentType } from "./taxonomy";

export type ContentChannel = "REDDIT" | "LINKEDIN" | "X" | "YOUTUBE" | "SEO" | "EMAIL" | "BLOG";

export type DraftRequest = {
  channel: ContentChannel;
  format: "REPLY" | "COMMENT" | "POST" | "THREAD" | "SCRIPT" | "ARTICLE" | "COMPARISON" | "LANDING" | "OUTREACH" | "FOLLOWUP";
  opportunity?: {
    title: string;
    body: string;
    platform: string;
    communityName?: string | null;
    author?: string | null;
    intentType: string;
    competitorName?: string | null;
  } | null;
  product: {
    name: string;
    url?: string | null;
    oneLiner: string;
    problems: string[];
    keywords: string[];
    icpName: string;
    category: string;
    objections?: string[];
  };
  pitchAllowed: boolean; // false => educational only, no product mention
  topicHint?: string | null;
};

export type ContentWarning = { level: "INFO" | "WARN" | "BLOCK"; code: string; message: string };

export type GeneratedDraft = {
  title: string;
  body: string;
  spamRisk: number;
  warnings: ContentWarning[];
  model: string;
};

const PITCHY_PHRASES = [
  /check out (my|our)/i, /we (built|launched) (a|an)/i, /sign ?up (here|now|at)/i, /try (our|my) (app|tool|product)/i,
  /dm me/i, /limited (time|offer)/i, /discount/i, /promo/i, /free trial/i, /get started today/i, /revolutionary/i,
  /game.?chang/i, /10x/i, /hustle/i,
];

/** Hard guardrails — deterministic, always applied, LLM or not. */
export function assessSpamRisk(body: string, opts: { pitchAllowed: boolean; mentionsProduct: boolean; channel: string }): { spamRisk: number; warnings: ContentWarning[] } {
  const warnings: ContentWarning[] = [];
  let risk = 0;

  const links = (body.match(/https?:\/\//g) ?? []).length;
  if (links === 0) risk += 0;
  else if (links === 1) risk += 8;
  else if (links === 2) risk += 22;
  else risk += 38;

  const pitchHits = PITCHY_PHRASES.filter((re) => re.test(body)).length;
  risk += pitchHits * 14;

  const productMentions = (body.match(/our tool|our product|my product|we built|check out/gi) ?? []).length;
  risk += productMentions * 8;

  if (!opts.pitchAllowed) {
    warnings.push({
      level: "BLOCK",
      code: "DONT_PITCH_YET",
      message:
        "Don't pitch yet. This thread is awareness-stage — the author hasn't asked for solutions. Selling now reads as spam and burns the conversation. Help first; the platform will surface them again when intent appears.",
    });
  }
  if (!opts.pitchAllowed && opts.mentionsProduct) {
    risk += 35;
  }
  if (links >= 2) warnings.push({ level: "WARN", code: "LINK_COUNT", message: "Multiple links materially increase spam-filter and moderator risk. Keep one link maximum, and only if rules allow." });
  if (pitchHits > 0) warnings.push({ level: "WARN", code: "MARKETING_SPEAK", message: "Marketing language detected (“we built”, “game-changer”, “10x”). Rewrite in plain, specific operator language." });
  if (body.length < 120) warnings.push({ level: "INFO", code: "TOO_SHORT", message: "Draft is thin. Add one concrete detail (number, step, or trade-off) before sending." });
  if (body.length > 1800) warnings.push({ level: "INFO", code: "TOO_LONG", message: "Long replies get skimmed. Cut to the single most useful insight + one next step." });

  // Community rules reminder
  if (opts.channel === "REDDIT") {
    warnings.push({ level: "INFO", code: "COMMUNITY_RULES", message: "Check the subreddit's self-promo rules before posting. Disclose affiliation when mentioning your own product." });
  }

  return { spamRisk: Math.min(100, risk), warnings };
}

// ─── Deterministic templates ──────────────────────────────────────────────────

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Deterministic variation so drafts differ across opportunities. */
function pick<T>(arr: T[], seed: string): T {
  return arr[hashSeed(seed || "x") % arr.length];
}

/** Strips leading intent scaffolding ("Looking for…", "Does anyone know…") to get the subject. */
function subjectFromTitle(title: string): string {
  const stripped = title
    .replace(
      /^(hey (everyone|folks|all)[,:\s-]*|looking for|does anyone know (of )?|anyone know (of )?|is there|any(one)? (have )?(good )?recommendations? (for|on)|i (really )?need|need)\s+(a|an|the|some)?\s*/i,
      ""
    )
    .replace(/[?.!\s]+$/, "")
    .trim();
  return stripped || title.replace(/[?.!\s]+$/, "").trim();
}

/** The product problem this thread is actually about (keyword overlap), for grounded advice. */
function relevantProblem(haystack: string, problems: string[]): string {
  const lower = haystack.toLowerCase();
  let best = problems[0] ?? "the core problem";
  let bestHits = 0;
  for (const p of problems) {
    const hits = p
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 4 && lower.includes(w)).length;
    if (hits > bestHits) {
      best = p;
      bestHits = hits;
    }
  }
  return best;
}

function disclosureLine(name: string, oneLiner: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const clean = oneLiner
    .replace(new RegExp(`^${escaped}\\s+(is|are)\\s+`, "i"), "")
    .replace(/[.\s]+$/, "");
  return `Full disclosure: I work on ${name}${clean ? ` (${clean})` : ""}.`;
}

function redditReply(req: DraftRequest): string {
  const opp = req.opportunity;
  if (!opp) {
    const topic = req.topicHint ?? req.product.problems[0];
    return [
      `Been through this exact loop (${String(topic).toLowerCase()}). The thing that actually moved the needle for me:`,
      ``,
      `1. Instrument where the drop-off happens before changing anything — most of the time the problem is narrower than it looks.`,
      `2. Pick the single highest-traffic step and write down what a "good" outcome looks like numerically.`,
      `3. Change one variable per week and keep a running log. Patterns show up faster than you'd expect.`,
      ``,
      `Happy to go deeper on any of these — which part is closest to where you're stuck?`,
    ].join("\n");
  }

  const seed = `${opp.title}|${opp.author ?? ""}`;
  const hay = `${opp.title} ${opp.body}`;
  const budgetConstrained = /\$|afford|cheap(er)?|budget|expensive|pricey|break the bank|insane|price/i.test(hay);
  const urgent = /urgent|asap|deadline|this week|by (monday|friday|tomorrow)/i.test(hay);
  const prob = relevantProblem(hay, req.product.problems).toLowerCase();

  if (!req.pitchAllowed) {
    const opener = pick(
      [
        `Depends heavily on the setup — this one presents identically across teams but rarely shares a root cause.`,
        `Before changing anything, worth separating the causes: the same symptom usually has three or four different roots in this space.`,
        `Seen this go two very different ways depending on where the problem actually sits.`,
      ],
      seed
    );
    return [
      opener,
      ``,
      `What's worked for teams dealing with ${prob}:`,
      ``,
      `1. Baseline it for two weeks — which SKUs, channels or steps produce most of it. The problem is usually narrower than it looks.`,
      `2. Change one variable and log it. Feelings lie; logs don't.`,
      `3. Only then decide whether you need software or a workflow change. Plenty of these are process problems wearing a software costume.`,
      ``,
      `What does your setup look like? Happy to get specific if it's a stack we've seen before.`,
    ].join("\n");
  }

  // Buying-intent thread: genuinely useful answer + exactly one disclosed mention.
  const opener = budgetConstrained
    ? pick(
        [
          `The pricing on the big names in this space is calibrated for enterprise catalogs — threads like this exist because of that gap.`,
          `You're hitting the classic squeeze in this category: enterprise pricing, mid-market reality.`,
        ],
        seed
      )
    : urgent
      ? `Tight timelines change the calculus — whatever you pick, pick something you can run this week, not something "in rollout."`
      : pick(
          [
            `This category has quietly gotten better over the last year. The question is less "is there a tool" and more "which one fits your setup."`,
            `There are solid options now — the differentiator is fit with your workflow, not feature count.`,
          ],
          seed
        );

  const advice = `One thing before you commit to anything: check your own data first and confirm ${prob} is actually the driver. Tools only move the number when the diagnosis is right, and "we assumed it was X" is where budgets usually get wasted.`;

  const paras: string[] = [opener, ``, advice];
  if (opp.competitorName) {
    paras.push(
      `On ${opp.competitorName}: worth pinning down whether what's frustrating you is the workflow or the output — they're different problems with different fixes.`
    );
  }
  paras.push(
    ``,
    disclosureLine(req.product.name, req.product.oneLiner),
    budgetConstrained
      ? `It's priced for teams your size rather than enterprise budgets, which is why I'm mentioning it here.`
      : `It does exactly this, which is why I'm mentioning it here.`,
    ``,
    `Happy to walk through what we'd check first in your situation even if you end up with something else.`
  );
  return paras.filter((l, i, arr) => !(l === "" && arr[i - 1] === "")).join("\n");
}

function linkedinPost(req: DraftRequest): string {
  const topic = req.topicHint ?? req.product.problems[0];
  return [
    `${topic} doesn't get fixed by working harder. It gets fixed by measuring the right thing.`,
    ``,
    `Most ${req.product.icpName.toLowerCase()} I talk to share the same pattern:`,
    ``,
    `— They feel the problem daily (so it's real)`,
    `— They can't put a number on it (so prioritization is emotional)`,
    `— They've bought a tool before it was scoped (so nothing sticks)`,
    ``,
    `The fix is boring: pick one metric that represents the problem, baseline it for two weeks, then change one thing.`,
    ``,
    `If you're dealing with this right now, what does your version of that metric look like? Genuinely curious — collecting patterns.`,
  ].join("\n");
}

function xThread(req: DraftRequest): string {
  const topic = req.topicHint ?? req.product.problems[0];
  return [
    `${topic}: the 3-step version that actually works.`,
    ``,
    `1/ Baseline the problem numerically before touching anything.`,
    ``,
    `2/ Change one variable per week. Log everything. Feelings lie; logs don't.`,
    ``,
    `3/ Keep what moved the number. Kill what didn't. Repeat.`,
    ``,
    `That's it. Most teams do step 3 without steps 1–2, which is just expensive guessing.`,
  ].join("\n");
}

function youtubeIdeas(req: DraftRequest): string[] {
  const icp = req.product.icpName;
  return [
    `Title: "How we cut ${req.product.problems[0].toLowerCase()} — full walkthrough" — Hook: show the before metric on screen in 5 seconds. Script: problem → baseline → the 3 fixes → honest results. Length 8–12 min.`,
    `Title: "${req.product.category} for ${icp}: what actually matters" — Hook: "You don't need more features, you need these 3 things." Script: teardown of a real (anonymized) setup. Length 6–10 min.`,
    `Title: "The fastest way to test if ${req.product.keywords[0] ?? "this workflow"} is your bottleneck" — Hook: 30-second DIY test. Script: test → interpretation → next step. Length 5–7 min.`,
  ];
}

function seoBrief(req: DraftRequest): { title: string; body: string } {
  const kw = req.topicHint ?? req.product.keywords[0] ?? req.product.category;
  const competitor = req.opportunity?.competitorName ?? "the incumbent tools";
  return {
    title: `Best ${kw} options for ${req.product.icpName.toLowerCase()} (2026)`,
    body: [
      `Target keyword: "${kw}". Secondary: "${kw} for ${req.product.icpName.toLowerCase()}", "${competitor} alternative".`,
      ``,
      `Page type: comparison/alternatives page.`,
      ``,
      `Outline:`,
      `1. Who this is for (name the ICP exactly) and the job to be done.`,
      `2. What to evaluate in ${req.product.category.toLowerCase()} — 4 concrete criteria tied to ${req.product.problems[0].toLowerCase()}.`,
      `3. Honest comparison table: ${req.product.name} vs 3 alternatives, with trade-offs stated plainly.`,
      `4. "Choose ${competitor} if…" section — real scenarios where the competitor wins. This section is what makes the page rank and convert.`,
      `5. FAQ from actual intent phrases: ${(req.product.objections ?? ["is it worth it?", "how long does setup take?"]).map((o) => `“${o}”`).join(", ")}.`,
      ``,
      `Internal linking: from your main comparison hub; CTA to a self-serve trial.`,
    ].join("\n"),
  };
}

function outreachEmail(req: DraftRequest): string {
  const opp = req.opportunity;
  const firstName = opp?.author ? opp.author.split(/[\s_.]/)[0] : "there";
  const prob = opp
    ? relevantProblem(`${opp.title} ${opp.body}`, req.product.problems).toLowerCase()
    : req.product.problems[0].toLowerCase();
  const subjectSource = opp ? subjectFromTitle(opp.title) : `${req.product.icpName} workflows`;
  const subject = subjectSource.charAt(0).toUpperCase() + subjectSource.slice(1);
  const oneLiner = req.product.oneLiner.replace(/[.\s]+$/, "").toLowerCase();

  return [
    `Subject: ${subject}`,
    ``,
    `Hi ${firstName},`,
    ``,
    opp?.communityName
      ? `Saw your ${opp.communityName} post about ${prob} — it's the exact problem we built ${req.product.name} for (${oneLiner}).`
      : `We built ${req.product.name} for exactly this: ${prob} (${oneLiner}).`,
    ``,
    `If useful, I can show you how we handle it in 15 minutes — no deck, just the product on your actual case. Either way, happy to point you at what we'd check first in your situation.`,
    ``,
    `— Founder, ${req.product.name}`,
  ].join("\n");
}

export function generateDeterministic(req: DraftRequest): GeneratedDraft {
  let title = "";
  let body = "";
  switch (req.channel) {
    case "REDDIT":
      title = `Reply: ${req.opportunity?.title ?? "Community thread"}`;
      body = redditReply(req);
      break;
    case "LINKEDIN":
      title = req.topicHint ?? `${req.product.problems[0]} — a better way to think about it`;
      body = linkedinPost(req);
      break;
    case "X":
      title = req.topicHint ?? `${req.product.problems[0]} in 3 steps`;
      body = xThread(req);
      break;
    case "YOUTUBE":
      title = "YouTube ideas & scripts";
      body = youtubeIdeas(req).join("\n\n");
      break;
    case "SEO":
    case "BLOG": {
      const brief = seoBrief(req);
      title = brief.title;
      body = brief.body;
      break;
    }
    case "EMAIL":
      title = `Outreach: ${req.opportunity?.title ?? "Warm prospect"}`;
      body = outreachEmail(req);
      break;
  }
  const mentionsProduct = /(our tool|our product|my product|we built|i work on|check out)/i.test(body);
  const { spamRisk, warnings } = assessSpamRisk(body, { pitchAllowed: req.pitchAllowed, mentionsProduct, channel: req.channel });
  return { title, body, spamRisk, warnings, model: "template-v1" };
}

// ─── LLM path (optional polish layer) ─────────────────────────────────────────

const GUARDRAILS = `You write distribution content for founders. Hard rules:
- Specific and human. Plain operator language. Zero marketing buzzwords (no "game-changing", "10x", "revolutionary", "unlock", "elevate").
- Contextual: reference the actual situation described in the thread/notes.
- If pitchAllowed is false, do NOT mention the product at all. Be purely helpful.
- If pitchAllowed is true, mention the product at most once, with full disclosure ("full disclosure: I work on X"), and only where it genuinely helps.
- Platform-native: Reddit = conversational paragraphs, no headers; LinkedIn = short lines, line breaks, one question at the end; X = numbered thread, each post under 280 chars; Email = under 150 words, one CTA.
Return JSON: { "title": string, "body": string }`;

export async function generateDraft(req: DraftRequest): Promise<GeneratedDraft> {
  const base = generateDeterministic(req);

  if (!hasAI()) return base;

  const aiDraft = await tryAI(async (ai) => {
    const user = [
      `Product: ${req.product.name} (${req.product.url ?? "no url"})`,
      `What it does: ${req.product.oneLiner}`,
      `ICP: ${req.product.icpName} — category: ${req.product.category}`,
      `Problems solved: ${req.product.problems.join("; ")}`,
      req.opportunity
        ? `Thread to respond to (${req.opportunity.platform}${req.opportunity.communityName ? ` · ${req.opportunity.communityName}` : ""}):\nTitle: ${req.opportunity.title}\nBody: ${req.opportunity.body.slice(0, 1200)}\nIntent: ${req.opportunity.intentType}`
        : `No specific thread. Topic hint: ${req.topicHint ?? "founder's choice from product problems"}`,
      `Channel/format: ${req.channel} ${req.format}`,
      `Pitch allowed: ${req.pitchAllowed ? "yes (disclose, max one mention)" : "NO — educational only"}`,
      `Return ONLY JSON {"title": "...", "body": "..."}.`,
    ].join("\n\n");
    const text = await ai.complete({
      system: GUARDRAILS,
      messages: [{ role: "user", content: user }],
      temperature: 0.6,
      json: true,
      maxTokens: 900,
    });
    // parseJsonLoose imported lazily to avoid cycle
    const { parseJsonLoose } = await import("../ai/provider");
    const parsed = parseJsonLoose<{ title: string; body: string }>(text);
    if (!parsed?.body || parsed.body.length < 60) return null;
    return parsed;
  }, { label: "content-engine" });

  if (!aiDraft) return base;
  const mentionsProduct = /(our tool|our product|my product|we built|i work on|check out)/i.test(aiDraft.body);
  const { spamRisk, warnings } = assessSpamRisk(aiDraft.body, { pitchAllowed: req.pitchAllowed, mentionsProduct, channel: req.channel });
  return { title: aiDraft.title.slice(0, 200), body: aiDraft.body, spamRisk, warnings, model: "llm+guardrails" };
}

// ─── Action recommendation (spec §9) ──────────────────────────────────────────

export function recommendActionForIntent(intentType: IntentType | string): { action: string; label: string; pitchAllowed: boolean } {
  switch (intentType) {
    case "ACTIVE_BUYING":
    case "VENDOR_COMPARISON":
    case "RECOMMENDATION_REQUEST":
    case "URGENT_NEED":
      return { action: "REPLY", label: "Reply now", pitchAllowed: true };
    case "COMPETITOR_DISSATISFACTION":
      return { action: "REPLY", label: "Reply with alternative", pitchAllowed: true };
    case "PROBLEM_AWARENESS":
    case "SOLUTION_RESEARCH":
      return { action: "COMMENT", label: "Educational comment", pitchAllowed: false };
    case "PARTNERSHIP_OPPORTUNITY":
      return { action: "CONNECT", label: "Reach out to partner", pitchAllowed: true };
    default:
      return { action: "COMMENT", label: "Engage lightly", pitchAllowed: false };
  }
}

export function intentLabel(intentType: string): string {
  return INTENT_LABELS[intentType as IntentType] ?? intentType;
}
