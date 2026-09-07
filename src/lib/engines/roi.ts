/**
 * ROI + Customer Funnel (spec §15) — Activity → Traffic → Lead → Signup →
 * Activation → Customer → Revenue per channel. Optimizes for customers, not
 * vanity metrics.
 */

export type ChannelFunnel = {
  channel: string;
  impressions: number;
  visits: number;
  signups: number;
  activations: number;
  customers: number;
  mrrCents: number;
  revenueCents: number;
  spendCents: number;
  visitRate: number;
  signupRate: number;
  customerRate: number;
  cacCents: number | null;
  mrrPerCustomerCents: number;
};

export type RoiInput = {
  channel: string;
  impressions: number;
  visits: number;
  signups: number;
  activations: number;
  customers: number;
  mrrCents: number;
  revenueCents: number;
  spendCents: number;
};

export function buildChannelFunnel(r: RoiInput): ChannelFunnel {
  return {
    ...r,
    visitRate: r.impressions > 0 ? r.visits / r.impressions : 0,
    signupRate: r.visits > 0 ? r.signups / r.visits : 0,
    customerRate: r.signups > 0 ? r.customers / r.signups : 0,
    cacCents: r.customers > 0 ? Math.round(r.spendCents / r.customers) : null,
    mrrPerCustomerCents: r.customers > 0 ? Math.round(r.mrrCents / r.customers) : 0,
  };
}

export function rankChannels(channels: ChannelFunnel[]): ChannelFunnel[] {
  // Rank by customers, tiebreak customer rate, then MRR.
  return [...channels].sort(
    (a, b) => b.customers - a.customers || b.customerRate - a.customerRate || b.mrrCents - a.mrrCents
  );
}

export function channelVerdict(channels: ChannelFunnel[]): string {
  if (channels.length < 2) return "Not enough channel data yet — run at least two channels for two weeks.";
  const ranked = rankChannels(channels);
  const top = ranked[0]!;
  const second = ranked[1]!;
  if (top.customers === 0) return "No channel has produced a customer yet. Focus on replying to high-intent opportunities this week.";
  if (second.customers === 0) {
    return `${top.channel} is currently the stronger acquisition channel — it has produced ${top.customers} customers while others have produced none.`;
  }
  const multiple = (top.customers / top.impressions) / Math.max(1e-9, second.customers / second.impressions);
  return `${top.channel} is currently the stronger acquisition channel: ${top.customers} customers from ${fmtN(top.impressions)} impressions vs ${second.customers} from ${fmtN(second.impressions)} (${multiple.toFixed(1)}× the per-impression efficiency). Reallocate time toward ${top.channel} before adding new channels.`;
}

function fmtN(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function totalMrr(rows: { mrrCents: number }[]): number {
  return rows.reduce((s, r) => s + r.mrrCents, 0);
}
