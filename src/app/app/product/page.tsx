import { requirePage } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { Card, CardHeader, Badge, EpistemicTag } from "@/components/ui";
import { jparse } from "@/lib/jsonfield";

export const metadata = { title: "Product" };

export default async function ProductPage() {
  const auth = await requirePage();
  const products = await prisma.product.findMany({
    where: { orgId: auth.orgId },
    include: { analysis: true, icps: true, personas: true, channels: { orderBy: { rank: "asc" }, take: 3 } },
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-lg font-semibold tracking-tight">Product intelligence</h1>
        <p className="text-xs text-ink-faint mt-0.5">What the platform knows about your product — every claim tagged as verified, inference, or recommendation.</p>
      </div>

      <div className="space-y-6">
        {products.map((p) => {
          const a = p.analysis;
          const confidence = a ? jparse<Record<string, string>>(a.confidence, {}) : {};
          return (
            <div key={p.id} className="space-y-5">
              <Card className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-semibold tracking-tight">{p.name}</h2>
                      {p.isDefault ? <Badge tone="good">primary</Badge> : null}
                    </div>
                    {p.url ? (
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">{p.url.replace(/^https?:\/\//, "")}</a>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {a ? <Badge tone="accent">{a.category}</Badge> : null}
                    {a ? <Badge tone="neutral">engine: {a.model}</Badge> : null}
                    <Badge tone="neutral">{p.geography ?? "Global"}</Badge>
                  </div>
                </div>
                {a ? (
                  <>
                    <p className="text-sm text-ink-soft mt-3 leading-relaxed">{a.oneLiner}</p>
                    <div className="mt-3 rounded-md bg-accent-soft/60 px-4 py-3">
                      <div className="text-2xs font-mono uppercase tracking-wider text-ink-faint mb-1">Positioning · recommendation</div>
                      <p className="text-[13px] text-ink-soft leading-relaxed">{a.positioning}</p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-ink-mute mt-2">Analysis pending…</p>
                )}
              </Card>

              {a ? (
                <div className="grid md:grid-cols-2 gap-5">
                  <Card>
                    <CardHeader title="Problems solved" action={<EpistemicTag kind={(confidence.problems as "INFERENCE") ?? "INFERENCE"} />} />
                    <div className="p-4 flex flex-wrap gap-1.5">
                      {jparse<string[]>(a.problems, []).map((x) => <Badge key={x} tone="neutral">{x}</Badge>)}
                    </div>
                  </Card>
                  <Card>
                    <CardHeader title="Use cases" action={<EpistemicTag kind="INFERENCE" />} />
                    <div className="p-4 flex flex-wrap gap-1.5">
                      {jparse<string[]>(a.useCases, []).map((x) => <Badge key={x} tone="neutral">{x}</Badge>)}
                    </div>
                  </Card>
                  <Card>
                    <CardHeader title="Buying triggers" action={<EpistemicTag kind="INFERENCE" />} />
                    <div className="p-4 space-y-1.5">
                      {jparse<string[]>(a.buyingTriggers, []).map((x) => (
                        <div key={x} className="text-xs text-ink-soft flex gap-2"><span className="text-good">▲</span>{x}</div>
                      ))}
                    </div>
                  </Card>
                  <Card>
                    <CardHeader title="Objections to overcome" action={<EpistemicTag kind="INFERENCE" />} />
                    <div className="p-4 space-y-1.5">
                      {jparse<string[]>(a.objections, []).map((x) => (
                        <div key={x} className="text-xs text-ink-soft flex gap-2"><span className="text-warn">△</span>{x}</div>
                      ))}
                    </div>
                  </Card>
                  <Card>
                    <CardHeader title="SEO keywords" action={<EpistemicTag kind="INFERENCE" />} />
                    <div className="p-4 flex flex-wrap gap-1.5">
                      {jparse<string[]>(a.keywords, []).slice(0, 16).map((x) => (
                        <span key={x} className="text-2xs font-mono bg-paper-sunken rounded px-2 py-1 text-ink-soft">{x}</span>
                      ))}
                    </div>
                  </Card>
                  <Card>
                    <CardHeader title="Detected competitors" action={<EpistemicTag kind="INFERENCE" />} />
                    <div className="p-4 space-y-2">
                      <CompetitorList productId={p.id} />
                    </div>
                  </Card>
                </div>
              ) : null}

              <div className="grid md:grid-cols-2 gap-5">
                <Card>
                  <CardHeader title="ICP" subtitle={p.icps[0]?.description} action={p.icps.length > 0 ? <EpistemicTag kind={(confidence.icp as "VERIFIED") ?? "INFERENCE"} /> : null} />
                  <div className="p-4 space-y-1.5 text-[13px]">
                    {p.icps.map((i) => (
                      <div key={i.id} className="space-y-1">
                        <div className="font-medium">{i.name}</div>
                        <div className="text-xs text-ink-mute">Buyer: {i.buyerRole} · {i.seniority} · {i.companySize} · {i.geography}</div>
                      </div>
                    ))}
                  </div>
                </Card>
                <Card>
                  <CardHeader title="Personas" action={<EpistemicTag kind="INFERENCE" />} />
                  <div className="p-4 space-y-3">
                    {p.personas.map((pe) => (
                      <div key={pe.id} className="rounded-md border border-paper-line p-3.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="text-sm font-medium">{pe.name}</div>
                          <div className="text-2xs text-ink-faint">{pe.role}</div>
                        </div>
                        {pe.quote ? <p className="text-xs text-ink-mute italic mt-1.5">“{pe.quote}”</p> : null}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {jparse<string[]>(pe.wateringHoles, []).map((w) => <Badge key={w} tone="neutral">{w}</Badge>)}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

async function CompetitorList({ productId }: { productId: string }) {
  const competitors = await prisma.competitor.findMany({ where: { productId }, take: 6 });
  return (
    <div className="space-y-2">
      {competitors.map((c) => (
        <div key={c.id} className="flex items-start justify-between gap-3 rounded-md bg-paper-sunken/60 px-3 py-2">
          <div>
            <div className="text-xs font-medium">{c.name}</div>
            <div className="text-2xs text-ink-faint">{c.positioning}</div>
          </div>
          <Badge tone={c.monitor ? "good" : "neutral"}>{c.monitor ? "watching" : "off"}</Badge>
        </div>
      ))}
    </div>
  );
}
