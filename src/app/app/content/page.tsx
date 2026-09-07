import { requirePage } from "@/lib/auth/guard";
import { listContent } from "@/lib/services/app-data";
import { ContentView } from "@/components/content-view";
import { jparse } from "@/lib/jsonfield";

export const metadata = { title: "Content" };

export default async function ContentPage() {
  const auth = await requirePage();
  const rows = await listContent(auth.orgId);
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <ContentView
        initial={rows.map((c) => ({
          id: c.id,
          channel: c.channel,
          format: c.format,
          title: c.title,
          body: c.body,
          status: c.status,
          spamRisk: c.spamRisk,
          warnings: jparse(c.warnings, []),
          publishedAt: c.publishedAt?.toISOString() ?? null,
          url: c.url,
          imageUrl: c.imageUrl,
          metrics: c.metrics ? jparse<Record<string, number>>(c.metrics, {}) : null,
          opportunity: c.opportunity ? { title: c.opportunity.title, communityName: c.opportunity.communityName } : null,
          updatedAt: c.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
