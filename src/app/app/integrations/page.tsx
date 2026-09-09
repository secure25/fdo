import { requirePage } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { jparse } from "@/lib/jsonfield";
import { IntegrationsView } from "@/components/integrations-view";

export const metadata = { title: "Integrations" };

const SOURCE_NAMES: Record<string, string> = {
  hackernews: "Hacker News",
  reddit: "Reddit",
  sandbox: "Sandbox (demo)",
};

export default async function IntegrationsPage() {
  const auth = await requirePage();
  const [rows, sources] = await Promise.all([
    prisma.integration.findMany({ where: { orgId: auth.orgId } }),
    prisma.source.findMany({ where: { orgId: auth.orgId }, orderBy: { adapter: "asc" } }),
  ]);
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <IntegrationsView
        initial={rows.map((r) => ({
          provider: r.provider,
          status: r.status,
          config: jparse<Record<string, unknown>>(r.config, {}),
        }))}
        sources={sources.map((s) => ({
          adapter: s.adapter,
          name: SOURCE_NAMES[s.adapter] ?? s.name,
          status: s.status,
          lastRunAt: s.lastRunAt ? s.lastRunAt.toISOString() : null,
          isLive: s.adapter !== "sandbox",
        }))}
      />
    </div>
  );
}
