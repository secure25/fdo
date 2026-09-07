/**
 * Competitor Intelligence (spec §16) — every event must answer:
 * What changed / Why it matters / Potential response.
 */

export type CompetitorEventKind = "PRICING" | "FEATURE" | "LAUNCH" | "REVIEW" | "CONTENT" | "POSITIONING" | "COMPLAINT";

export type EventDraft = {
  kind: CompetitorEventKind;
  title: string;
  detail: string;
  sourceUrl?: string | null;
  whatChanged: string;
  whyItMatters: string;
  potentialResponse: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
};

export function analyzeEvent(kind: CompetitorEventKind, competitorName: string, detail: string): EventDraft {
  const map: Record<CompetitorEventKind, (name: string, d: string) => EventDraft> = {
    PRICING: (name, d) => ({
      kind,
      title: `${name} changed pricing: ${d}`,
      detail: d,
      whatChanged: `${name} adjusted its pricing — ${d}.`,
      whyItMatters: `Price moves re-open active evaluations. Their existing customers will re-check value within weeks, and price-sensitive buyers in your ICP will search for alternatives.`,
      potentialResponse: `Publish/update your "${name} alternative" comparison page this week with an honest pricing breakdown. Do not panic-discount; win on the specific gap instead.`,
      severity: "HIGH",
    }),
    FEATURE: (name, d) => ({
      kind,
      title: `${name} shipped a new feature: ${d}`,
      detail: d,
      whatChanged: `${name} launched ${d}.`,
      whyItMatters: `Feature launches get their users' attention and press. If the feature maps to a core problem you solve, your differentiation narrative needs a refresh.`,
      potentialResponse: `Respond with depth, not parity: publish a teardown showing how your approach handles the underlying problem end-to-end. Only build parity if your ICP actually asked.`,
      severity: "MEDIUM",
    }),
    LAUNCH: (name, d) => ({
      kind,
      title: `${name} launched something new: ${d}`,
      detail: d,
      whatChanged: `${name} publicly launched ${d}.`,
      whyItMatters: `Launches spike their traffic and directory rankings. Some of that attention is your ICP comparing options for the first time.`,
      potentialResponse: `Make sure you are visible wherever they launch (directories, comparison pages). Post your own "how we think about X" content in the same week.`,
      severity: "MEDIUM",
    }),
    REVIEW: (name, d) => ({
      kind,
      title: `New public review of ${name}: ${d}`,
      detail: d,
      whatChanged: `A public review of ${name} says: ${d}.`,
      whyItMatters: `Reviews rank for high-intent searches ("${name} review"). Prospects reading them are actively shopping.`,
      potentialResponse: `If positive, note what they praise — it's your ICP's priority list. If negative, it's a search-optimized opportunity: your comparison page should address that exact weakness.`,
      severity: "LOW",
    }),
    CONTENT: (name, d) => ({
      kind,
      title: `${name} published content: ${d}`,
      detail: d,
      whatChanged: `${name} is investing in content: ${d}.`,
      whyItMatters: `Their content competes for the same search terms and community attention your ICP lives in.`,
      potentialResponse: `Differentiate by format, not topic: they write listicles, you publish teardowns with real numbers. Check which keywords they target and take the adjacent long-tail.`,
      severity: "LOW",
    }),
    POSITIONING: (name, d) => ({
      kind,
      title: `${name} changed positioning: ${d}`,
      detail: d,
      whatChanged: `${name} now positions itself as: ${d}.`,
      whyItMatters: `Positioning shifts signal a target-market change. They may be moving toward — or away from — your exact ICP.`,
      potentialResponse: `If they moved toward your ICP: sharpen your niche-specific proof. If away: inherit the abandoned segment with a targeted page and outreach.`,
      severity: "MEDIUM",
    }),
    COMPLAINT: (name, d) => ({
      kind,
      title: `${name} customers complaining publicly: ${d}`,
      detail: d,
      whatChanged: `Users of ${name} are publicly unhappy about: ${d}.`,
      whyItMatters: `This is the highest-value signal in competitive intel: real users, real frustration, in public. Many are one good answer away from switching.`,
      potentialResponse: `Find those threads (they're likely already in your opportunity feed under competitor dissatisfaction) and respond helpfully. Never trash ${name}; show how you handle that specific case.`,
      severity: "HIGH",
    }),
  };
  return map[kind](competitorName, detail);
}
