/**
 * Distribution Map — scores every acquisition channel for a specific product
 * (spec §3). Deterministic base scores + archetype affinity + founder
 * constraints (budget/time) => explainable per-channel recommendations.
 */

import { ARCHETYPES, CHANNEL_CATALOG, type ChannelGroupId } from "./taxonomy";
import type { ProductIntelligence } from "./product-analyst";

export type ScoredChannel = {
  name: string;
  group: ChannelGroupId;
  url?: string;
  icpFit: number;
  intentDensity: number;
  competition: number;
  effort: "LOW" | "MEDIUM" | "HIGH";
  expectedConversion: number;
  opportunity: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
  strategy: string;
  rank: number;
  reason: string;
};

function clamp(n: number, lo = 3, hi = 98) {
  return Math.round(Math.min(hi, Math.max(lo, n)));
}

export function opportunityBand(icpFit: number, intent: number, conv: number, competition: number): ScoredChannel["opportunity"] {
  const composite = 0.35 * icpFit + 0.3 * intent + 0.2 * conv + 0.15 * (100 - competition);
  if (composite >= 80) return "VERY_HIGH";
  if (composite >= 68) return "HIGH";
  if (composite >= 52) return "MEDIUM";
  return "LOW";
}

export function buildDistributionMap(
  intel: ProductIntelligence,
  constraints: { budgetBand?: string | null; timePerWeek?: number | null } = {}
): ScoredChannel[] {
  // Archetype affinity shifts channel scores for this specific product.
  const arch = ARCHETYPES.find((a) => a.id === intel.archetypeId);
  const affinity = arch?.channelAffinity ?? {};

  const lowBudget = constraints.budgetBand === "NONE" || constraints.budgetBand === "LEAN";
  const lowTime = (constraints.timePerWeek ?? 5) <= 5;

  const scored: ScoredChannel[] = CHANNEL_CATALOG.map((c) => {
    const aff = affinity[c.name] ?? 0;
    const icpFit = clamp(c.baseIcpFit + aff * 0.7);
    const intentDensity = clamp(c.baseIntent + aff * 0.4);
    let competition = clamp(c.baseCompetition - aff * 0.3);
    if (c.group === "DIRECTORIES") competition += 0; // marketplace rank difficulty captured in base
    const expectedConversion = clamp(c.baseConversion + aff * 0.3);
    let effortLevel = c.baseEffort;
    if (lowTime && (c.name === "YouTube" || c.name === "Integrators")) effortLevel = 3;
    if (lowBudget && c.group === "PARTNERSHIPS") effortLevel = Math.min(3, effortLevel + 1) as 1 | 2 | 3;

    const reasonBits: string[] = [];
    if (aff >= 10) reasonBits.push(`strong archetype fit for ${intel.category.toLowerCase()}`);
    else if (aff <= -10) reasonBits.push(`weak fit for ${intel.category.toLowerCase()}`);
    if (intentDensity >= 78) reasonBits.push("buying-intent dense");
    if (competition <= 35) reasonBits.push("underexploited");
    if (competition >= 60) reasonBits.push("crowded");
    const reason = reasonBits.length
      ? reasonBits.join("; ").replace(/^./, (m) => m.toUpperCase())
      : `Baseline channel for ${intel.category.toLowerCase()}`;

    return {
      name: c.name,
      group: c.group,
      url: c.url,
      icpFit,
      intentDensity,
      competition,
      effort: effortLevel === 1 ? "LOW" : effortLevel === 2 ? "MEDIUM" : "HIGH",
      expectedConversion,
      opportunity: opportunityBand(icpFit, intentDensity, expectedConversion, competition),
      strategy: c.strategy,
      rank: 0,
      reason,
    };
  });

  // Rank by a weighted opportunity index.
  const idx = (c: ScoredChannel) =>
    0.35 * c.icpFit + 0.3 * c.intentDensity + 0.2 * c.expectedConversion + 0.15 * (100 - c.competition);
  scored.sort((a, b) => idx(b) - idx(a));
  scored.forEach((c, i) => (c.rank = i + 1));
  return scored;
}
