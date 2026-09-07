/**
 * Distribution Health (spec §12) — 8 component scores, one composite, and a
 * plain-language diagnosis of the weakest area.
 */

export type HealthComponents = {
  customerClarity: number;
  channelFit: number;
  intentCapture: number;
  content: number;
  outreach: number;
  partnerships: number;
  seo: number;
  conversion: number;
};

export type HealthInput = {
  hasIcp: boolean;
  hasPersonas: boolean;
  keywordCount: number;
  topChannelOpportunity: number; // best channel composite 0-100
  highIntentNew: number; // high-intent opportunities still NEW
  actedOnHighIntent: number;
  contentDrafts: number;
  contentPublished: number;
  contentEngagements: number;
  prospectsContacted: number;
  prospectsTotal: number;
  followUpsDue: number;
  partnershipOpportunities: number;
  partnershipsActed: number;
  seoAssets: number;
  signupCount: number;
  customerCount: number;
  experimentsRunning: number;
};

export type HealthResult = {
  score: number;
  components: HealthComponents;
  weakest: { key: keyof HealthComponents; label: string; score: number; diagnosis: string };
  strongest: { key: keyof HealthComponents; label: string };
};

const LABELS: Record<keyof HealthComponents, string> = {
  customerClarity: "Customer clarity",
  channelFit: "Channel fit",
  intentCapture: "Intent capture",
  content: "Content",
  outreach: "Outreach",
  partnerships: "Partnerships",
  seo: "SEO",
  conversion: "Conversion",
};

const WEIGHTS: Record<keyof HealthComponents, number> = {
  customerClarity: 0.18,
  channelFit: 0.14,
  intentCapture: 0.16,
  content: 0.12,
  outreach: 0.12,
  partnerships: 0.08,
  seo: 0.1,
  conversion: 0.1,
};

export function computeHealth(input: HealthInput): HealthResult {
  const components: HealthComponents = {
    // Clarity: ICP + personas + keyword depth
    customerClarity: Math.round((input.hasIcp ? 45 : 0) + (input.hasPersonas ? 25 : 0) + Math.min(30, input.keywordCount * 2)),
    // Channel fit: quality of the best available channel
    channelFit: clamp(input.topChannelOpportunity),
    // Intent capture: share of high-intent opportunities acted on
    intentCapture: clamp(input.actedOnHighIntent + input.highIntentNew === 0 ? 55 : (input.actedOnHighIntent / Math.max(1, input.actedOnHighIntent + input.highIntentNew)) * 100),
    // Content: pipeline volume + published proof
    content: clamp(input.contentPublished * 14 + Math.min(20, input.contentDrafts * 5) + Math.min(20, input.contentEngagements / 25)),
    // Outreach: contacted share of qualified prospects, minus stale follow-ups
    outreach: clamp(input.prospectsTotal === 0 ? 30 : (input.prospectsContacted / input.prospectsTotal) * 100 - Math.min(15, input.followUpsDue * 2)),
    // Partnerships: share of partnership signals acted on
    partnerships: clamp(input.partnershipOpportunities === 0 ? 55 : 40 + (input.partnershipsActed / input.partnershipOpportunities) * 60),
    // SEO: comparison/landing assets live
    seo: clamp(Math.min(85, input.seoAssets * 22)),
    // Conversion: signup → customer efficiency
    conversion: clamp(input.signupCount === 0 ? 40 : 30 + (input.customerCount / input.signupCount) * 140),
  };

  const entries = Object.entries(components) as [keyof HealthComponents, number][];
  const score = Math.round(entries.reduce((s, [k, v]) => s + WEIGHTS[k] * v, 0));

  const sorted = [...entries].sort((a, b) => a[1] - b[1]);
  const weakest = sorted[0]!;
  const strongest = sorted[sorted.length - 1]!;

  return {
    score,
    components,
    weakest: {
      key: weakest[0],
      label: LABELS[weakest[0]],
      score: weakest[1],
      diagnosis: diagnose(weakest[0], input),
    },
    strongest: { key: strongest[0], label: LABELS[strongest[0]] },
  };
}

function diagnose(key: keyof HealthComponents, input: HealthInput): string {
  switch (key) {
    case "intentCapture":
      return "Your biggest weakness is intent capture. You are creating content but missing people already looking for your solution. Reply to high-intent threads within 24h — start with the Very High opportunities in your feed.";
    case "outreach":
      return `Outreach is your weakest area. ${input.followUpsDue > 0 ? `${input.followUpsDue} warm follow-ups are overdue` : "You have qualified prospects you haven't contacted yet"}. Personalized outreach to people who publicly stated the problem converts 5–10× better than cold lists.`;
    case "content":
      return "Content is underpowered. Publish two educational pieces this week tied to the exact phrases your ICP uses when describing the problem.";
    case "partnerships":
      return "Partnerships are untouched. One agency or newsletter relationship can deliver more customers than a month of solo posting. Start with your top-ranked candidate.";
    case "seo":
      return "You have almost no comparison/alternative pages. These capture people already shopping for a solution — the highest-intent search traffic that exists.";
    case "conversion":
      return "Traffic isn't becoming customers efficiently. Check what visitors see in the first 30 seconds and make the ICP-specific promise impossible to miss.";
    case "channelFit":
      return "Your channel mix doesn't match where your ICP actually talks. Revisit the distribution map and go deep on the top two channels instead of spreading thin.";
    case "customerClarity":
      return "Your ICP definition is too fuzzy to aim discovery. Tighten the buyer role and the exact problem wording on the Product page.";
  }
}

function clamp(n: number, lo = 2, hi = 98) {
  return Math.round(Math.min(hi, Math.max(lo, n)));
}
