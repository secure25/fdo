import { requirePage } from "@/lib/auth/guard";
import { getDistributionMap } from "@/lib/services/app-data";
import { Card, CardHeader, Badge, SectionLabel, ScoreNum } from "@/components/ui";
import { ExternalLink, Handshake } from "lucide-react";

export const metadata = { title: "Distribution" };

const GROUP_LABELS: Record<string, string> = {
  COMMUNITIES: "Communities",
  SOCIAL: "Social",
  SEARCH: "Search",
  DIRECT: "Direct",
  PARTNERSHIPS: "Partnerships",
  DIRECTORIES: "Directories & Marketplaces",
};

const OPP_TONE: Record<string, "urgent" | "good" | "warn" | "neutral"> = {
  VERY_HIGH: "urgent",
  HIGH: "good",
  MEDIUM: "warn",
  LOW: "neutral",
};

export default async function DistributionPage() {
  const auth = await requirePage();
  const { product, channels, communities, partners } = await getDistributionMap(auth.orgId, null);

  if (!product) {
    return <div className="max-w-6xl mx-auto px-6 py-10 text-sm text-ink-mute">Complete onboarding to see your distribution map.</div>;
  }

  const topChannels = channels.slice(0, 4);
  const byGroup = channels.reduce<Record<string, typeof channels>>((acc, c) => {
    (acc[c.group] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-lg font-semibold tracking-tight">Distribution map</h1>
        <p className="text-xs text-ink-faint mt-0.5">
          Every acquisition channel scored for {product.name} — ICP fit, intent density, competition, effort, expected conversion.
        </p>
      </div>

      {/* Top priorities */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {topChannels.map((c, i) => (
          <Card key={c.name} className="p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-2xs text-ink-faint">#{i + 1}</span>
              <Badge tone={OPP_TONE[c.opportunity] ?? "neutral"}>{c.opportunity.replace("_", " ").toLowerCase()}</Badge>
            </div>
            <div className="text-sm font-semibold mt-1.5">{c.name}</div>
            <div className="mt-2.5 space-y-1.5">
              {[
                ["ICP fit", c.icpFit],
                ["Intent", c.intentDensity],
                ["Competition", c.competition],
              ].map(([l, v]) => (
                <div key={l as string} className="flex items-center justify-between text-2xs">
                  <span className="text-ink-faint">{l}</span>
                  <ScoreNum score={v as number} className={l === "Competition" ? "" : undefined} />
                </div>
              ))}
              <div className="flex items-center justify-between text-2xs pt-0.5">
                <span className="text-ink-faint">Effort</span>
                <span className="text-ink-soft">{c.effort.toLowerCase()}</span>
              </div>
            </div>
            <p className="text-2xs text-ink-mute mt-2.5 pt-2.5 border-t border-paper-line/70 leading-relaxed line-clamp-3">{c.strategy}</p>
          </Card>
        ))}
      </div>

      {/* Full channel table */}
      <Card className="mb-8">
        <CardHeader title="All channels" subtitle="Ranked by opportunity composite" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead>
              <tr className="text-left font-mono text-2xs uppercase tracking-[0.12em] text-ink-faint border-b border-paper-line">
                <th className="px-4 py-2.5 font-medium">Channel</th>
                <th className="px-4 py-2.5 font-medium">Group</th>
                <th className="px-4 py-2.5 font-medium text-right">ICP</th>
                <th className="px-4 py-2.5 font-medium text-right">Intent</th>
                <th className="px-4 py-2.5 font-medium text-right">Comp.</th>
                <th className="px-4 py-2.5 font-medium text-right">Effort</th>
                <th className="px-4 py-2.5 font-medium text-right">Conv.</th>
                <th className="px-4 py-2.5 font-medium">Opportunity</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => (
                <tr key={c.name} className="border-b border-paper-line/60 hover:bg-paper-sunken/40">
                  <td className="px-4 py-2.5 text-sm font-medium">{c.name}</td>
                  <td className="px-4 py-2.5 text-2xs text-ink-faint">{GROUP_LABELS[c.group]}</td>
                  <td className="px-4 py-2.5 text-right"><ScoreNum score={c.icpFit} /></td>
                  <td className="px-4 py-2.5 text-right"><ScoreNum score={c.intentDensity} /></td>
                  <td className="px-4 py-2.5 text-right text-ink-mute">{c.competition}</td>
                  <td className="px-4 py-2.5 text-right text-2xs text-ink-soft">{c.effort.toLowerCase()}</td>
                  <td className="px-4 py-2.5 text-right"><ScoreNum score={c.expectedConversion} /></td>
                  <td className="px-4 py-2.5"><Badge tone={OPP_TONE[c.opportunity] ?? "neutral"}>{c.opportunity.replace("_", " ")}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Strategy per top channel */}
      <Card className="mb-8">
        <CardHeader title="Recommended strategies" subtitle="How to play the top channels" />
        <div className="divide-y divide-paper-line/60">
          {channels.slice(0, 5).map((c) => (
            <div key={c.name} className="px-5 py-3.5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{c.name}</div>
                <Badge tone={OPP_TONE[c.opportunity] ?? "neutral"}>{c.opportunity.replace("_", " ").toLowerCase()}</Badge>
              </div>
              <p className="text-xs text-ink-mute mt-1 leading-relaxed">{c.strategy}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Communities */}
      <Card className="mb-8">
        <CardHeader title="Where your ICP gathers" subtitle="Curated communities matched to your product — with rules that matter" />
        <div className="p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {communities.map((c) => (
            <div key={c.id} className="rounded-md border border-paper-line p-3.5">
              <div className="flex items-center justify-between gap-2">
                <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-ink hover:text-accent inline-flex items-center gap-1">
                  {c.name} <ExternalLink size={10} className="text-ink-faint" />
                </a>
                <Badge tone={c.fit >= 80 ? "good" : "neutral"}>{c.fit}</Badge>
              </div>
              <div className="text-2xs text-ink-faint mt-0.5">{c.platform.toLowerCase()} · {c.memberEstimate ?? "—"}</div>
              <p className="text-2xs text-ink-mute mt-1.5 leading-relaxed">{c.focus}</p>
              {c.rules.length > 0 ? (
                <div className="mt-2 pt-2 border-t border-paper-line/60">
                  {c.rules.slice(0, 2).map((r) => (
                    <div key={r} className="text-[10px] text-ink-faint">⚠ {r}</div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Card>

      {/* Partnerships */}
      <div id="partnerships">
      <Card>
        <CardHeader
          title={<span id="partnerships" className="flex items-center gap-2"><Handshake size={15} /> Partnership engine</span>}
          subtitle="People who can bring many customers — ranked by audience fit, overlap and reach"
        />
        <div className="p-4 grid md:grid-cols-2 gap-3">
          {partners.map((p) => (
            <div key={p.name} className="rounded-md border border-paper-line p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-2xs text-ink-faint mt-0.5">{p.type} · {p.audience} · {p.reach}</div>
                </div>
                <div className="text-right shrink-0">
                  <ScoreNum score={p.partnershipPotential} className="text-lg" />
                  <div className="text-[10px] text-ink-faint">potential</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
                {[["Fit", p.audienceFit], ["Overlap", p.customerOverlap], ["Relevance", p.relevance], ["Reach", p.reachScore]].map(([l, v]) => (
                  <div key={l as string} className="rounded bg-paper-sunken py-1.5">
                    <div className="data-num text-xs font-semibold">{v}</div>
                    <div className="text-[9px] text-ink-faint">{l}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <Badge tone="accent">{p.recommendedModel}</Badge>
                <span className="text-2xs text-ink-faint font-mono">{p.partnershipPotential >= 80 ? "priority" : "pipeline"}</span>
              </div>
              <p className="text-2xs text-ink-mute mt-2 leading-relaxed">{p.rationale}</p>
            </div>
          ))}
        </div>
      </Card>
      </div>
    </div>
  );
}
