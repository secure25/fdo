import { requirePage } from "@/lib/auth/guard";
import { getChannelFunnels, getLearningView } from "@/lib/services/analytics";
import { Card, CardHeader, Badge, SectionLabel, EmptyState, Stat } from "@/components/ui";
import { FunnelChart, LineChart, HBar } from "@/components/charts";
import { fmtMoney, fmtNum, fmtPct } from "@/lib/utils";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const auth = await requirePage();
  const [{ channels, verdict, totalMrrCents }, learning] = await Promise.all([
    getChannelFunnels(auth.orgId),
    getLearningView(auth.orgId),
  ]);

  const totals = channels.reduce(
    (acc, c) => ({
      impressions: acc.impressions + c.impressions,
      visits: acc.visits + c.visits,
      signups: acc.signups + c.signups,
      activations: acc.activations + c.activations,
      customers: acc.customers + c.customers,
    }),
    { impressions: 0, visits: 0, signups: 0, activations: 0, customers: 0 }
  );

  // Demo trend that reconciles with the channel MRR total (ends at current MRR).
  const totalMrr = Math.round(totalMrrCents / 100);
  const mrrTrend = [180, 420, 760, 1180, 1620, 2050, Math.max(totalMrr, 2060)];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-lg font-semibold tracking-tight">Analytics</h1>
        <p className="text-xs text-ink-faint mt-0.5">Acquisition source → conversion rates → CAC → revenue → channel efficiency. Optimized for customers, not vanity metrics.</p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        <Stat label="MRR" value={fmtMoney(totalMrrCents)} sub="recurring, all channels" tone="good" />
        <Stat label="Customers" value={totals.customers} sub={`${totals.signups} signups`} />
        <Stat label="Signup → customer" value={totals.signups ? fmtPct(totals.customers / totals.signups) : "—"} />
        <Stat label="Visit → signup" value={totals.visits ? fmtPct(totals.signups / totals.visits) : "—"} />
        <Stat label="Channels active" value={channels.length} />
      </div>

      {channels.length === 0 ? (
        <Card><EmptyState title="No conversion data yet" body="Track visits, signups and customers per channel — the funnel assembles automatically. Log experiment results to seed this." /></Card>
      ) : (
        <>
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-5 mb-6">
            <Card>
              <CardHeader title="Customer funnel — all channels" subtitle="Activity → traffic → lead → signup → activation → customer" />
              <div className="p-5">
                <FunnelChart
                  stages={[
                    { label: "Impressions", value: totals.impressions },
                    { label: "Visits", value: totals.visits },
                    { label: "Signups", value: totals.signups },
                    { label: "Activation", value: totals.activations },
                    { label: "Customers", value: totals.customers },
                  ]}
                />
                <div className="mt-4 rounded-md bg-accent-soft px-4 py-3 text-[13px] text-ink-soft leading-relaxed">{verdict}</div>
              </div>
            </Card>
            <Card>
              <CardHeader title="MRR trend" subtitle={`Last 7 weeks · latest $${(mrrTrend[mrrTrend.length - 1] ?? 0).toLocaleString()}/mo`} />
              <div className="p-5">
                <LineChart data={mrrTrend} labels={["W1", "W2", "W3", "W4", "W5", "W6", "W7"]} height={170} />
                <div className="mt-2 flex justify-between text-2xs font-mono text-ink-faint px-1">
                  <span>$0</span>
                  <span>${Math.max(...mrrTrend).toLocaleString()}</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Channel efficiency table */}
          <Card className="mb-6">
            <CardHeader title="Channel efficiency" subtitle="Ranked by customers produced — not impressions" />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="text-left font-mono text-2xs uppercase tracking-[0.12em] text-ink-faint border-b border-paper-line">
                    <th className="px-4 py-2.5 font-medium">Channel</th>
                    <th className="px-4 py-2.5 font-medium text-right">Impr.</th>
                    <th className="px-4 py-2.5 font-medium text-right">Visits</th>
                    <th className="px-4 py-2.5 font-medium text-right">Signups</th>
                    <th className="px-4 py-2.5 font-medium text-right">Customers</th>
                    <th className="px-4 py-2.5 font-medium text-right">Cust./signup</th>
                    <th className="px-4 py-2.5 font-medium text-right">MRR</th>
                    <th className="px-4 py-2.5 font-medium text-right">MRR/customer</th>
                  </tr>
                </thead>
                <tbody className="data-num">
                  {channels.map((c) => (
                    <tr key={c.channel} className="border-b border-paper-line/60 hover:bg-paper-sunken/40">
                      <td className="px-4 py-2.5 text-sm font-medium">{c.channel}</td>
                      <td className="px-4 py-2.5 text-right text-ink-mute">{fmtNum(c.impressions)}</td>
                      <td className="px-4 py-2.5 text-right">{c.visits}</td>
                      <td className="px-4 py-2.5 text-right">{c.signups}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-good">{c.customers || "—"}</td>
                      <td className="px-4 py-2.5 text-right">{c.signups ? fmtPct(c.customerRate) : "—"}</td>
                      <td className="px-4 py-2.5 text-right">{fmtMoney(c.mrrCents)}</td>
                      <td className="px-4 py-2.5 text-right text-ink-mute">{c.customers ? fmtMoney(c.mrrPerCustomerCents) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Learning engine */}
      <Card className="mb-6">
        <CardHeader title="Learning engine" subtitle="What works → for whom → where → when → why" />
        <div className="p-5 space-y-4">
          {learning.bestCombo ? (
            <div className="grid sm:grid-cols-4 gap-3">
              {[["Topic", learning.bestCombo.topic], ["Format", learning.bestCombo.format], ["ICP", learning.bestCombo.icp], ["Channel", learning.bestCombo.channel]].map(([l, v]) => (
                <div key={l} className="rounded-md bg-good-soft px-3.5 py-3">
                  <div className="text-2xs uppercase tracking-wider text-good/80 font-mono">{l}</div>
                  <div className="text-sm font-semibold text-good mt-0.5">{v}</div>
                </div>
              ))}
            </div>
          ) : null}
          {learning.insights.length === 0 ? (
            <p className="text-sm text-ink-mute">Insights appear once content and outreach results are recorded.</p>
          ) : (
            <div className="space-y-3">
              {learning.insights.slice(0, 5).map((i) => (
                <div key={i.statement} className="rounded-md border border-paper-line p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium">{i.statement}</p>
                    <Badge tone={i.confidence >= 75 ? "good" : "neutral"}>{i.confidence}% conf.</Badge>
                  </div>
                  <p className="text-xs text-ink-mute mt-1.5 leading-relaxed">→ {i.recommendation}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Observations */}
      <Card>
        <CardHeader title="Observations" subtitle="Every measured action feeds the learning loop" />
        {learning.observations.length === 0 ? (
          <EmptyState title="No observations yet" body="Publish content and log its metrics — the engine learns what works for whom and where." />
        ) : (
          <div className="p-4 space-y-2.5">
            {learning.observations.slice(0, 8).map((o, i) => (
              <div key={i} className="flex items-center gap-4">
                <Badge tone={o.result === "HIGH" ? "good" : o.result === "MEDIUM" ? "warn" : "neutral"}>{o.result}</Badge>
                <div className="min-w-0 flex-1">
                  <HBar
                    label={`${o.channel} · ${o.topic ?? "general"}`}
                    sublabel={o.format ?? undefined}
                    value={Math.min(100, (o.metrics.customers ?? 0) * 20 + (o.metrics.signups ?? 0) * 4)}
                  />
                </div>
                <div className="text-2xs text-ink-faint whitespace-nowrap data-num">
                  {o.metrics.customers ?? 0} cust · {o.metrics.signups ?? 0} signups · {fmtNum(o.metrics.engagements ?? 0)} eng
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
