import Link from "next/link";
import { requirePage } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { getOverview, recentActivity } from "@/lib/services/dashboard";
import { deepResearchStatuses } from "@/lib/research/pipeline";
import { BetaBadge } from "@/components/betaBadge";
import { Card, CardHeader, SectionLabel, Badge, ScoreRing, Button, EmptyState } from "@/components/ui";
import { ScoreBars } from "@/components/charts";
import { DeepResearchStatus } from "@/components/deep-research-status";
import { timeAgo, cn } from "@/lib/utils";
import { ArrowRight, Clock, Flame, Handshake, AlertTriangle } from "lucide-react";

export const metadata = { title: "Overview" };

export default async function OverviewPage() {
  const auth = await requirePage();
  const [{ briefing, health, productName }, activity, defaultProduct, statuses] = await Promise.all([
    getOverview(auth.orgId),
    recentActivity(auth.orgId, 6),
    prisma.product.findFirst({ where: { orgId: auth.orgId, isDefault: true }, select: { id: true } }),
    deepResearchStatuses(auth.orgId),
  ]);
  const deepStatus = (defaultProduct && statuses[defaultProduct.id]?.status) || "idle";

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="display text-3xl font-semibold tracking-tight">{briefing.greeting}.</h1>
          <p className="text-sm text-ink-mute mt-1.5" data-testid="briefing-headline">
            {productName ? <><span className="font-medium text-ink">{productName}</span> </> : null}
            {productName ? <BetaBadge orgId={auth.orgId} /> : null}
            {briefing.stats.newOpportunities} new opportunities · {briefing.stats.highIntent} high intent ·{" "}
            {briefing.stats.urgent} urgent · {briefing.stats.partnerships} partnership{briefing.stats.partnerships === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ScoreRing score={health.score} size={56} label="dist. score" />
          <div className="text-xs text-ink-mute max-w-[220px] hidden sm:block">{health.weakest.diagnosis.split(".")[0]}.</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
        {/* Priorities */}
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Your priorities"
              subtitle={briefing.totalMinutes > 0 ? `A focused block of ${briefing.totalMinutes} minutes covers today's plan` : "Nothing queued — good time to run an experiment"}
              action={<Badge tone="neutral"><Clock size={10} /> {briefing.totalMinutes} min</Badge>}
            />
            <div className="divide-y divide-paper-line/70">
              {briefing.priorities.length === 0 ? (
                <EmptyState
                  title="No open priorities"
                  body="Your pipeline is clear. Run a discovery scan or ask the AI Strategist what to focus on."
                  action={<Link href="/app/strategist"><Button size="sm">Ask the strategist</Button></Link>}
                />
              ) : (
                briefing.priorities.map((p) => (
                  <div key={p.rank} className="px-5 py-4 flex items-start gap-4 hover:bg-paper-sunken/40 transition group">
                    <div className="data-num text-ink-faint font-mono text-sm pt-0.5 w-4">{p.rank}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-ink flex items-center gap-2">
                        {p.title}
                        {p.impact === "HIGH" ? <Badge tone="good">High impact</Badge> : p.impact === "MEDIUM" ? <Badge tone="warn">Medium impact</Badge> : null}
                      </div>
                      <div className="mt-1 text-xs text-ink-mute whitespace-pre-line leading-relaxed line-clamp-3">{p.detail}</div>
                      <div className="mt-2 flex items-center gap-2 text-2xs text-ink-faint">
                        {p.impact === "HIGH" ? <Badge tone="good">High impact</Badge> : p.impact === "MEDIUM" ? <Badge tone="warn">Medium impact</Badge> : null}
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* Analytics */}
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Analytics"
              subtitle={briefing.totalSeconds > 0 ? `You've saved ${briefing.totalSeconds} seconds today` : "No time saved today"}
              action={<Badge tone="neutral"><Clock size={10} /> {briefing.totalSeconds} sec</Badge>}
            />
            <div className="divide-y divide-paper-line/70">
              {briefing.charts.length === 0 ? (
                <EmptyState
                  title="No charts to display"
                  body="Run opportunities through the pipeline to generate charts"
                  action={<Link href="/app/opportunities"><Button size="sm">View opportunities</Button></Link>}
                />
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {briefing.charts.map((chart) => (
                    <div key={chart.id} className="w-full">
                      <ChartChart chart={chart} />
                    }
                  ))}
                </div>
              )
            }
          </div>
        </div>
      </div>
    </div>
  );
}
