/**
 * Experiment Engine (spec §13) — A/B channel comparison with funnel math and
 * an efficiency recommendation ("Reddit produces customers 4.8× more efficiently").
 */

export type ExperimentFunnel = {
  channel: string;
  opportunities: number;
  engagements: number;
  clicks: number;
  signups: number;
  activations: number;
  customers: number;
  revenueCents: number;
  hoursInvested: number;
  visitRate: number; // engagements -> visits proxy via clicks/opps
  signupRate: number; // clicks -> signups
  customerRate: number; // signups -> customers
  revenuePerCustomer: number;
  customersPerHour: number;
  customersPerOpportunity: number;
};

export type ExperimentConclusion = {
  winner: string | null;
  efficiencyMultiple: number | null;
  recommendation: string;
};

export function computeFunnel(r: {
  channel: string;
  opportunities: number;
  engagements: number;
  clicks: number;
  signups: number;
  activations: number;
  customers: number;
  revenueCents: number;
  hoursInvested: number;
}): ExperimentFunnel {
  return {
    ...r,
    visitRate: r.opportunities > 0 ? r.clicks / r.opportunities : 0,
    signupRate: r.clicks > 0 ? r.signups / r.clicks : 0,
    customerRate: r.signups > 0 ? r.customers / r.signups : 0,
    revenuePerCustomer: r.customers > 0 ? r.revenueCents / r.customers : 0,
    customersPerHour: r.hoursInvested > 0 ? r.customers / r.hoursInvested : 0,
    customersPerOpportunity: r.opportunities > 0 ? r.customers / r.opportunities : 0,
  };
}

export function conclude(a: ExperimentFunnel, b: ExperimentFunnel): ExperimentConclusion {
  // Primary efficiency metric: customers per hour invested; tiebreak customers per opportunity.
  const effA = a.customersPerHour || a.customersPerOpportunity;
  const effB = b.customersPerHour || b.customersPerOpportunity;

  if (effA === 0 && effB === 0) {
    return {
      winner: null,
      efficiencyMultiple: null,
      recommendation:
        "Not enough signal yet. Keep both arms running until at least one produces a customer, then compare customers-per-hour.",
    };
  }
  if (effB === 0) {
    return {
      winner: a.channel,
      efficiencyMultiple: null,
      recommendation: `${a.channel} produced ${a.customers} customer${a.customers === 1 ? "" : "s"} while ${b.channel} produced none so far. Shift the majority of your time to ${a.channel}, keep ${b.channel} at maintenance level.`,
    };
  }
  if (effA === 0) {
    return {
      winner: b.channel,
      efficiencyMultiple: null,
      recommendation: `${b.channel} produced ${b.customers} customer${b.customers === 1 ? "" : "s"} while ${a.channel} produced none so far. Shift the majority of your time to ${b.channel}.`,
    };
  }
  const ratio = Math.max(effA, effB) / Math.min(effA, effB);
  const winner = effA >= effB ? a : b;
  const loser = effA >= effB ? b : a;
  return {
    winner: winner.channel,
    efficiencyMultiple: Math.round(ratio * 10) / 10,
    recommendation: `${winner.channel} currently produces customers ${ratio.toFixed(1)}× more efficiently than ${loser.channel} (${winner.customers} vs ${loser.customers} customers for similar effort). Increase activity on ${winner.channel}; ${loser.channel} needs either a different format or a smaller share of your week.`,
  };
}
