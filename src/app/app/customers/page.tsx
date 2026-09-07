import { requirePage } from "@/lib/auth/guard";
import { listProspects } from "@/lib/services/app-data";
import { prisma } from "@/lib/db";
import { ProspectBoard } from "@/components/prospect-board";
import { jparse } from "@/lib/jsonfield";
import { Card, CardHeader, Badge } from "@/components/ui";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams?: { stage?: string } }) {
  const auth = await requirePage();
  const [rows, companies] = await Promise.all([
    listProspects(auth.orgId, { stage: searchParams?.stage ? [searchParams.stage] : undefined }),
    prisma.company.findMany({ where: { orgId: auth.orgId }, take: 12 }),
  ]);

  const prospects = rows.map((p) => ({
    id: p.id,
    name: p.name,
    handle: p.handle,
    company: p.company,
    role: p.role,
    website: p.website,
    industry: p.industry,
    icpFit: p.icpFit,
    intentScore: p.intentScore,
    signalsVerified: jparse<string[]>(p.signalsVerified, []),
    signalsInferred: jparse<string[]>(p.signalsInferred, []),
    approach: p.approach,
    stage: p.stage,
    notes: p.notes,
    sourceOpportunity: p.sourceOpportunity
      ? { title: p.sourceOpportunity.title, url: p.sourceOpportunity.url, communityName: p.sourceOpportunity.communityName }
      : null,
    createdAt: p.createdAt.toISOString(),
  }));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <ProspectBoard initial={prospects} stageFilter={searchParams?.stage} />
      {companies.length > 0 ? (
        <Card className="mt-8">
          <CardHeader title="Companies" subtitle="Derived from prospect and signal data" />
          <div className="p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {companies.map((c) => (
              <div key={c.id} className="rounded-md border border-paper-line p-3">
                <div className="text-sm font-medium">{c.name}</div>
                <div className="text-2xs text-ink-faint mt-0.5">{c.industry ?? "—"}{c.sizeBand ? ` · ${c.sizeBand}` : ""}</div>
                <div className="flex gap-1 mt-2">
                  {(jparse<string[]>(c.signals, []).slice(0, 2)).map((s, i) => (
                    <Badge key={i} tone="neutral">{s}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
