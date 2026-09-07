/**
 * AI Strategist (spec §17) — conversational strategist grounded in the user's
 * actual product + platform data. Deterministic router produces specific,
 * data-backed answers; when an LLM is configured it streams a richer answer
 * over the same context. Always returns concrete actions, never generic advice.
 */

export type StrategistContext = {
  productName: string;
  icpName: string;
  category: string;
  healthScore: number | null;
  weakestArea: string | null;
  stats: { newOpportunities: number; highIntent: number; urgent: number; partnerships: number };
  topOpportunities: { id: string; title: string; platform: string; score: number; intentType: string; community: string | null }[];
  channelFunnels: { channel: string; impressions: number; visits: number; signups: number; customers: number; mrrCents: number }[];
  channelRecommendations: { name: string; opportunity: string; strategy: string; rank: number }[];
  prospects: { id: string; name: string; company: string | null; icpFit: number; intentScore: number; stage: string }[];
  insights: { statement: string; recommendation: string; dimension: string }[];
  partners: { name: string; type: string; potential: number; recommendedModel: string }[];
  competitors: { name: string; events: number; latestEvent: string | null }[];
  experiments: { name: string; status: string; winner: string | null; multiple: number | null }[];
};

export type StrategistAnswer = {
  text: string;
  actions: { label: string; href: string }[];
};

type QuestionKind =
  | "TODAY" | "FIND_CUSTOMERS" | "CHANNEL_UNDERPERFORMING" | "COMPETITOR_UNHAPPY"
  | "STOP_CHANNEL" | "WHAT_TO_POST" | "FIRST_CUSTOMERS" | "PARTNERSHIPS"
  | "HEALTH" | "PRICING" | "GENERIC";

function route(question: string): QuestionKind {
  const q = question.toLowerCase();
  if (/today|next|priorit|focus|should i (do|work)/.test(q)) return "TODAY";
  if (/find.*(customer|prospect|people)|get.*(customer|leads)|20 customers|10 customers|first (10 )?customers/.test(q)) return "FIND_CUSTOMERS";
  if (/linkedin|reddit|x\b|twitter|channel.*(work|working)|why.*(isn|not).*working/.test(q)) {
    if (/(isn't|not) working|underperform|why.*slow/.test(q)) return "CHANNEL_UNDERPERFORMING";
    if (/stop|kill|cut/.test(q)) return "STOP_CHANNEL";
    return "CHANNEL_UNDERPERFORMING";
  }
  if (/unhappy|angry|frustrat|switch|dissatisf/.test(q)) return "COMPETITOR_UNHAPPY";
  if (/stop|cut|quit|drop/.test(q)) return "STOP_CHANNEL";
  if (/post|content|write|publish|thread/.test(q)) return "WHAT_TO_POST";
  if (/partner|agency|affiliate|newsletter|collab/.test(q)) return "PARTNERSHIPS";
  if (/health|score|how am i|progress/.test(q)) return "HEALTH";
  if (/price|pricing|plan/.test(q)) return "PRICING";
  return "GENERIC";
}

export function answerStrategist(question: string, ctx: StrategistContext): StrategistAnswer {
  const kind = route(question);
  switch (kind) {
    case "TODAY": {
      const acts: StrategistAnswer["actions"] = [{ label: "Open today's priorities", href: "/app" }];
      const parts: string[] = [];
      parts.push(`Here's today, grounded in your live data:`);
      parts.push(`• ${ctx.stats.newOpportunities} new opportunities · ${ctx.stats.highIntent} high-intent · ${ctx.stats.urgent} urgent · ${ctx.stats.partnerships} partnership signals`);
      if (ctx.topOpportunities.length) {
        const top = ctx.topOpportunities[0]!;
        parts.push(`\nStart here: “${top.title}” (${top.community ?? top.platform}, ${top.score}/100, ${top.intentType.toLowerCase().replace(/_/g, " ")}). Answers posted in the first 24h convert multiples better.`);
        acts.push({ label: "Reply to it", href: "/app/opportunities" });
      }
      if (ctx.prospects.length) {
        const p = ctx.prospects[0]!;
        parts.push(`Then contact ${p.name}${p.company ? ` (${p.company})` : ""} — ICP fit ${p.icpFit}, buying intent ${p.intentScore}.`);
        acts.push({ label: "Open prospects", href: "/app/customers" });
      }
      if (ctx.weakestArea) parts.push(`Your weakest area is ${ctx.weakestArea.toLowerCase()} — one focused hour there moves your Distribution Score more than another content post.`);
      return { text: parts.join("\n"), actions: acts };
    }

    case "FIND_CUSTOMERS": {
      const acts: StrategistAnswer["actions"] = [{ label: "Open opportunity feed", href: "/app/opportunities" }];
      const parts: string[] = [];
      parts.push(`I can't conjure buyers, but I can line up the closest thing: people publicly describing your problem right now.`);
      if (ctx.topOpportunities.length) {
        parts.push(`\nThe highest-intent matches for ${ctx.productName} today:`);
        ctx.topOpportunities.slice(0, 5).forEach((o) => {
          parts.push(`• ${o.score}/100 — “${o.title}” (${o.community ?? o.platform}, ${o.intentType.toLowerCase().replace(/_/g, " ")})`);
        });
        acts.push({ label: "Run a fresh discovery scan", href: "/app/opportunities" });
      }
      if (ctx.prospects.length) {
        parts.push(`\nAnd ${ctx.prospects.length} qualified prospect${ctx.prospects.length === 1 ? "" : "s"} already profiled: ${ctx.prospects.slice(0, 3).map((p) => `${p.name} (${p.icpFit}/100)`).join(", ")}.`);
        acts.push({ label: "Contact them", href: "/app/customers" });
      }
      parts.push(`\nRealistic math for ${ctx.icpName}: roughly 1 in 3 genuine high-intent replies gets a response, and 1 in 4 of those conversations reaches a trial. Ten good replies today ≈ 1–2 real conversations this week.`);
      return { text: parts.join("\n"), actions: acts };
    }

    case "CHANNEL_UNDERPERFORMING": {
      const parts: string[] = [];
      const named = /linkedin/.test(question.toLowerCase()) ? "LinkedIn" : /reddit/.test(question.toLowerCase()) ? "Reddit" : /x\b|twitter/.test(question.toLowerCase()) ? "X" : null;
      const funnel = named ? ctx.channelFunnels.find((c) => c.channel.toLowerCase().includes(named.toLowerCase() === "x" ? "x" : named.toLowerCase())) : undefined;
      if (funnel) {
        parts.push(`${funnel.channel} right now: ${fmt(funnel.impressions)} impressions → ${funnel.visits} visits → ${funnel.signups} signups → ${funnel.customers} customers.`);
        if (funnel.impressions > 2000 && funnel.visits / Math.max(1, funnel.impressions) < 0.02) {
          parts.push(`\nThe problem isn't reach — it's resonance: your click-through is below 2%, which means the content reads as generic to your ICP. Fix the first line: name the exact problem in the exact words your buyers use (they say “${ctx.topOpportunities[0]?.title ?? ctx.icpName}”, not "${ctx.category}").`);
        } else if (funnel.visits > 50 && funnel.signups / Math.max(1, funnel.visits) < 0.1) {
          parts.push(`\nClicks happen but signups don't — your landing page is losing them. The promise on the page must match the promise in the post, word for word.`);
        } else if (funnel.customers === 0) {
          parts.push(`\nSignups happen but nobody activates. Before investing more here, check activation: do new users reach value within one session?`);
        } else {
          parts.push(`\nIt's actually working — ${funnel.customers} customers from this channel. The question is whether it's the best use of your next hour (compare in Analytics).`);
        }
      } else {
        parts.push(`Channel data so far:`);
        ctx.channelFunnels.forEach((c) => parts.push(`• ${c.channel}: ${fmt(c.impressions)} impressions → ${c.visits} visits → ${c.signups} signups → ${c.customers} customers`));
        parts.push(`\nDiagnose in order: impressions→visits (message), visits→signups (landing page), signups→customers (activation). The biggest % drop-off is where the problem is.`);
      }
      const rec = ctx.channelRecommendations[0];
      if (rec) parts.push(`\nWhere to put the freed-up time: ${rec.name} (opportunity ${rec.opportunity.replace("_", " ").toLowerCase()}). ${rec.strategy}`);
      return { text: parts.join("\n"), actions: [{ label: "Open analytics", href: "/app/analytics" }, { label: "Distribution map", href: "/app/distribution" }] };
    }

    case "COMPETITOR_UNHAPPY": {
      const parts: string[] = [];
      const comp = ctx.competitors[0];
      if (comp) {
        parts.push(`Watching ${ctx.competitors.length} competitor${ctx.competitors.length === 1 ? "" : "s"}. Latest signal: ${comp.latestEvent ?? "no events captured yet — run Competitor Watch"}.`);
        parts.push(`\nCompetitor complaints are the warmest signal you have: those users already believe the problem is worth solving and are mid-frustration. Search the opportunity feed for competitor-dissatisfaction posts — reply with how you handle that specific case. Never trash the competitor by name.`);
      } else {
        parts.push(`No competitors are being monitored yet. Add them on the Competitors page — monitoring watches public threads for dissatisfaction and review signals.`);
      }
      const opps = ctx.topOpportunities.filter((o) => o.intentType === "COMPETITOR_DISSATISFACTION");
      if (opps.length) {
        parts.push(`\nLive now: ${opps.map((o) => `“${o.title}” (${o.community ?? o.platform}, ${o.score}/100)`).join("; ")}.`);
      }
      return { text: parts.join("\n"), actions: [{ label: "Open competitors", href: "/app/competitors" }, { label: "Filter feed by competitor dissatisfaction", href: "/app/opportunities?intent=COMPETITOR_DISSATISFACTION" }] };
    }

    case "STOP_CHANNEL": {
      const parts: string[] = [];
      const sorted = [...ctx.channelFunnels].sort((a, b) => a.customers - b.customers);
      const worst = sorted[0];
      const best = sorted[sorted.length - 1];
      if (worst && best && worst.channel !== best.channel) {
        parts.push(`${worst.channel}: ${fmt(worst.impressions)} impressions → ${worst.customers} customers. That's your weakest return on time.`);
        if (best.customers > 0) {
          parts.push(`${best.channel} is producing ${best.customers} customer${best.customers === 1 ? "" : "s"} — the data says reinvest there.`);
        }
        parts.push(`\nRecommendation: don't delete ${worst.channel} — cut it to maintenance (one post a week) for 2 weeks and log it as an experiment. If nothing changes, pause it and move the hours to ${best.channel}.`);
      } else {
        parts.push(`You don't have enough per-channel data to cut anything yet. Give each active channel 2–3 weeks of consistent effort, then compare customers-per-hour in Experiments.`);
      }
      return { text: parts.join("\n"), actions: [{ label: "Open experiments", href: "/app/experiments" }] };
    }

    case "WHAT_TO_POST": {
      const insight = ctx.insights[0];
      const rec = ctx.channelRecommendations[0];
      const parts: string[] = [];
      if (insight) {
        parts.push(`Your learning engine says: ${insight.statement}`);
        parts.push(`\nSo this week: 2 educational posts on "${ctx.topOpportunities[0]?.title?.slice(0, 60) ?? insight.statement.split("is")[0]}" for ${ctx.icpName}, 1 comparison/SEO page, and comments on 5 ICP threads before posting anything of your own.`);
      } else {
        parts.push(`No learning data yet, so default to what compounds for ${ctx.icpName}:`);
        parts.push(`• 2 educational posts on the exact problem (${ctx.topOpportunities[0]?.title ?? ctx.category})`);
        parts.push(`• 1 "X vs Y" comparison page targeting people already shopping`);
        parts.push(`• 5 genuine comments on ICP threads before any self-promotion`);
      }
      if (rec) parts.push(`\nPost where the intent is: ${rec.name}. ${rec.strategy}`);
      return { text: parts.join("\n"), actions: [{ label: "Generate a draft", href: "/app/content" }] };
    }

    case "FIRST_CUSTOMERS": {
      const parts: string[] = [];
      parts.push(`First 10 customers for ${ctx.productName}, shortest path:`);
      parts.push(`1. Reply to every high-intent thread in your feed (${ctx.stats.highIntent} waiting now). Personal, specific, disclose affiliation.`);
      parts.push(`2. Contact the ${ctx.prospects.length || "5"} profiled prospects — they publicly stated the problem. Reference their exact words.`);
      parts.push(`3. List on AlternativeTo + 2 directories where your ICP searches ("alternative to …" traffic converts).`);
      parts.push(`4. One agency/newsletter partnership: ${ctx.partners[0]?.name ?? "a niche newsletter"} — one relationship, many customers.`);
      parts.push(`5. Every reply → track as a touch in Campaigns. Measure replies→conversations→trials, not likes.`);
      return { text: parts.join("\n"), actions: [{ label: "Open opportunities", href: "/app/opportunities" }, { label: "Open prospects", href: "/app/customers" }, { label: "Partnerships", href: "/app/distribution#partnerships" }] };
    }

    case "PARTNERSHIPS": {
      const parts: string[] = [];
      if (ctx.partners.length) {
        parts.push(`Top partnership candidates ranked by potential:`);
        ctx.partners.slice(0, 4).forEach((p) => parts.push(`• ${p.name} (${p.type}) — ${p.potential}/100, recommended model: ${p.recommendedModel}`));
        const top = ctx.partners[0]!;
        parts.push(`\nStart with ${top.name}: offer the ${top.recommendedModel.toLowerCase()} structure — it's the one where their incentive matches your unit economics. First message should reference something they published, not your product.`);
      } else {
        parts.push(`No partnership candidates yet — the engine ranks agencies, consultants, newsletter operators and integrators once product intelligence is complete.`);
      }
      return { text: parts.join("\n"), actions: [{ label: "Open partnerships", href: "/app/distribution#partnerships" }] };
    }

    case "HEALTH": {
      const parts: string[] = [];
      if (ctx.healthScore !== null) {
        parts.push(`Distribution Score: ${ctx.healthScore}/100.`);
        if (ctx.weakestArea) parts.push(`Weakest: ${ctx.weakestArea}. Strongest lever this week is fixing that, not adding new channels.`);
      } else {
        parts.push(`Not enough data for a health score yet — finish product intelligence and connect one source, and I'll compute it.`);
      }
      if (ctx.experiments.length) {
        const e = ctx.experiments[0]!;
        parts.push(`Experiment "${e.name}": ${e.winner ? `${e.winner} wins${e.multiple ? ` (${e.multiple}× more efficient)` : ""}` : e.status.toLowerCase()}.`);
      }
      return { text: parts.join("\n"), actions: [{ label: "Open overview", href: "/app" }] };
    }

    case "PRICING": {
      return {
        text: `Pricing questions from your ICP are buying signals in disguise — objections like “is it worth it” usually mean the value wasn't anchored to their problem. Anchor pricing pages to the metric your buyers already track (e.g. return rate, hours saved), not feature lists.`,
        actions: [{ label: "See plans", href: "/pricing" }],
      };
    }

    default: {
      const parts: string[] = [];
      parts.push(`Working from your ${ctx.productName} data: ${ctx.stats.highIntent} high-intent opportunities, ${ctx.prospects.length} profiled prospects, top channel ${ctx.channelRecommendations[0]?.name ?? "not yet scored"}.`);
      parts.push(`\nAsk me things like: “What should I work on today?”, “Find me 20 customers”, “Why isn't LinkedIn working?”, “Find people unhappy with my competitor”, “What should I post this week?”, or “How do I get my first 10 customers?”`);
      return { text: parts.join("\n"), actions: [{ label: "Today's plan", href: "/app" }] };
    }
  }
}

/** System prompt for the LLM path — includes full platform context. */
export function strategistSystemPrompt(ctx: StrategistContext): string {
  return `You are the AI Strategist inside Founder Distribution OS, talking to the founder of ${ctx.productName} (${ctx.category}; ICP: ${ctx.icpName}).

LIVE PLATFORM DATA (use it; do not invent numbers):
- New opportunities: ${ctx.stats.newOpportunities}; high-intent: ${ctx.stats.highIntent}; urgent: ${ctx.stats.urgent}; partnership signals: ${ctx.stats.partnerships}
- Top opportunities: ${ctx.topOpportunities.slice(0, 6).map((o) => `“${o.title}” (${o.community ?? o.platform}, ${o.score}/100, ${o.intentType})`).join("; ") || "none yet"}
- Channel funnels: ${ctx.channelFunnels.map((c) => `${c.channel}: ${c.impressions} impr → ${c.visits} visits → ${c.signups} signups → ${c.customers} customers, $${Math.round(c.mrrCents / 100)} MRR`).join("; ") || "no data"}
- Channel recommendations: ${ctx.channelRecommendations.slice(0, 3).map((c) => `${c.rank}. ${c.name} (${c.opportunity})`).join("; ") || "none"}
- Prospects: ${ctx.prospects.slice(0, 5).map((p) => `${p.name}${p.company ? ` @ ${p.company}` : ""} (ICP ${p.icpFit}/100, intent ${p.intentScore}/100, ${p.stage})`).join("; ") || "none"}
- Insights: ${ctx.insights.map((i) => i.statement).join("; ") || "none yet"}
- Partners: ${ctx.partners.slice(0, 4).map((p) => `${p.name} (${p.type}, ${p.potential}/100, ${p.recommendedModel})`).join("; ") || "none"}
- Competitors: ${ctx.competitors.map((c) => `${c.name} (${c.events} events)`).join("; ") || "none"}
- Experiments: ${ctx.experiments.map((e) => `${e.name}: ${e.winner ? `winner ${e.winner}${e.multiple ? ` ${e.multiple}×` : ""}` : e.status}`).join("; ") || "none"}

RULES:
- Answer with specific, data-grounded guidance. Reference real numbers and real threads from the data above.
- Every answer ends with 1–3 concrete next actions.
- No marketing fluff. No generic advice. Short paragraphs. You may use markdown lists.
- If the user asks for something you lack data for, say what's missing and where in the app to get it.`;
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}
