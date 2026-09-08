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
  // Surface the chain that's actively running (the product just onboarded);
  // otherwise show the default product's deep-research state.
  const activeEntry = Object.entries(statuses).find(([, s]) => s.status === "queued" || s.status === "running");
  const badgeProductId = activeEntry?.[0] ?? defaultProduct?.id ?? null;
  const deepStatus = (badgeProductId && statuses[badgeProductId]?.status) || "idle";

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="display text-3xl font-semibold tracking-tight">{briefing.greeting}.</h1>
          <p className="text-sm text-ink-mute mt-1.5 flex flex-wrap items-center gap-1.5" data-testid="briefing-headline">
            {productName ? <span className="font-medium text-ink">{productName}</span> : null}
            {productName ? <BetaBadge orgId={auth.orgId} /> : null}
            {productName ? <span aria-hidden>·</span> : null}
            <span>
              {briefing.stats.newOpportunities} new opportunities · {briefing.stats.highIntent} high intent ·{" "}
              {briefing.stats.urgent} urgent · {briefing.stats.partnerships} partnership{briefing.stats.partnerships === 1 ? "" : "s"}
            </span>
            {badgeProductId ? <DeepResearchStatus productId={badgeProductId} initialStatus={deepStatus} /> : null}
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
                        <Clock size={10} /> {p.minutes} min
                      </div>
                    </div>
                    <Link href={p.href} className="shrink-0 self-center">
                      <Button variant="secondary" size="sm" className="opacity-80 group-hover:opacity-100">
                        {p.cta} <ArrowRight size={12} />
                      </Button>
                    </Link>
                  </div>
                ))
              )}
            </div>
            <div className="px-5 py-3 bg-paper-sunken/50 rounded-b-lg">
              <p className="text-xs text-ink-soft">{briefing.focusMessage}</p>
            </div>
          </Card>

          {/* Top opportunities preview */}
          <TopOpportunities orgId={auth.orgId} />
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Distribution health */}
          <Card>
            <CardHeader title="Distribution health" subtitle={`Weakest area: ${health.weakest.label}`} />
            <div className="p-5">
              <ScoreBars
                components={Object.entries(health.components).map(([key, score]) => ({
                  key,
                  label: key === "customerClarity" ? "Customer clarity" : key === "channelFit" ? "Channel fit" : key === "intentCapture" ? "Intent capture" : key === "seo" ? "SEO" : key.charAt(0).toUpperCase() + key.slice(1),
                  score,
                }))}
              />
              <div className="mt-5 rounded-md bg-warn-soft border border-warn/15 px-4 py-3">
                <div className="text-2xs font-mono uppercase tracking-wider text-warn mb-1">Diagnosis</div>
                <p className="text-xs text-ink-soft leading-relaxed">{health.weakest.diagnosis}</p>
              </div>
            </div>
          </Card>

          {/* Stats */}
          <Card>
            <CardHeader title="Signal counts" />
            <div className="grid grid-cols-2 divide-x divide-y divide-paper-line/60">
              {[
                { icon: Flame, label: "High intent", value: briefing.stats.highIntent, tone: "text-urgent", href: "/app/opportunities?band=VERY_HIGH,HIGH" },
                { icon: AlertTriangle, label: "Urgent", value: briefing.stats.urgent, tone: "text-bad", href: "/app/opportunities?intent=URGENT_NEED" },
                { icon: Handshake, label: "Partnerships", value: briefing.stats.partnerships, tone: "text-accent", href: "/app/opportunities?intent=PARTNERSHIP_OPPORTUNITY" },
                { icon: Clock, label: "Ready drafts", value: briefing.stats.readyDrafts, tone: "text-good", href: "/app/content?status=APPROVED" },
              ].map((s) => (
                <Link key={s.label} href={s.href} className="p-4 hover:bg-paper-sunken/50 transition">
                  <div className="flex items-center gap-1.5 text-2xs uppercase tracking-wider text-ink-faint font-mono">
                    <s.icon size={11} /> {s.label}
                  </div>
                  <div className={cn("data-num text-2xl font-semibold mt-1", s.tone)}>{s.value}</div>
                </Link>
              ))}
            </div>
          </Card>

          {/* Activity */}
          <Card>
            <CardHeader title="Latest signals" />
            <div className="divide-y divide-paper-line/60">
              {activity.recentOpps.slice(0, 4).map((o) => (
                <Link key={o.id} href="/app/opportunities" className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-paper-sunken/40 transition">
                  <div className="min-w-0">
                    <div className="text-xs text-ink truncate">{o.title}</div>
                    <div className="text-2xs text-ink-faint">{timeAgo(o.createdAt)}</div>
                  </div>
                  <Badge tone={o.band === "VERY_HIGH" ? "urgent" : o.band === "HIGH" ? "good" : "neutral"}>{o.score}</Badge>
                </Link>
              ))}
              {activity.recentEvents.slice(0, 2).map((e) => (
                <Link key={e.id} href="/app/competitors" className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-paper-sunken/40 transition">
                  <div className="min-w-0">
                    <div className="text-xs text-ink truncate">{e.title}</div>
                    <div className="text-2xs text-ink-faint">{e.competitor} · {timeAgo(e.detectedAt)}</div>
                  </div>
                  <Badge tone={e.severity === "HIGH" ? "bad" : "warn"}>{e.severity.toLowerCase()}</Badge>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

async function TopOpportunities({ orgId }: { orgId: string }) {
  const { listOpportunities } = await import("@/lib/services/opportunities");
  const opportunities = await listOpportunities(orgId, { status: ["NEW"], limit: 5 });
  return (
    <Card>
      <CardHeader
        title="Act on these first"
        subtitle="Highest-scoring new opportunities across all sources"
        action={<Link href="/app/opportunities" className="text-xs text-accent hover:underline">View all →</Link>}
      />
      <div className="divide-y divide-paper-line/70">
        {opportunities.slice(0, 5).map((o) => (
          <Link key={o.id} href="/app/opportunities" className="block px-5 py-3.5 hover:bg-paper-sunken/40 transition">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-2xs font-mono uppercase tracking-wider text-ink-faint">
                  {o.community ?? o.platform} · {timeAgo(o.postedAt)}
                </div>
                <div className="text-sm font-medium text-ink mt-0.5 truncate">“{o.title}”</div>
              </div>
              <div className="text-right shrink-0">
                <Badge tone={o.band === "VERY_HIGH" ? "urgent" : o.band === "HIGH" ? "good" : "warn"}>{o.score}</Badge>
                <div className="text-2xs text-ink-faint mt-1">{o.effortMinutes} min</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}

