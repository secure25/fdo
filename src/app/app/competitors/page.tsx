import { requirePage } from "@/lib/auth/guard";
import { listCompetitors } from "@/lib/services/app-data";
import { CompetitorsView } from "@/components/competitors-view";

export const metadata = { title: "Competitors" };

export default async function CompetitorsPage() {
  const auth = await requirePage();
  const competitors = await listCompetitors(auth.orgId);
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <CompetitorsView
        initial={competitors.map((c) => ({
          id: c.id,
          name: c.name,
          url: c.url,
          positioning: c.positioning,
          monitor: c.monitor,
          events: c.events.map((e) => ({
            id: e.id,
            kind: e.kind,
            title: e.title,
            detail: e.detail,
            whatChanged: e.whatChanged,
            whyItMatters: e.whyItMatters,
            potentialResponse: e.potentialResponse,
            severity: e.severity,
            detectedAt: e.detectedAt.toISOString(),
          })),
        }))}
      />
    </div>
  );
}
