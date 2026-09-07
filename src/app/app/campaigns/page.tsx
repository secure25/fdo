import { requirePage } from "@/lib/auth/guard";
import { listCampaigns } from "@/lib/services/app-data";
import { CampaignsView } from "@/components/campaigns-view";

export const metadata = { title: "Campaigns" };

export default async function CampaignsPage() {
  const auth = await requirePage();
  const campaigns = await listCampaigns(auth.orgId);
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <CampaignsView
        initial={campaigns.map((c) => ({
          id: c.id,
          name: c.name,
          channel: c.channel,
          objective: c.objective,
          status: c.status,
          goalMetric: c.goalMetric,
          startedAt: c.startedAt?.toISOString() ?? null,
          scheduledAt: c.scheduledAt?.toISOString() ?? null,
          actions: c.actions.map((a) => ({
            id: a.id,
            type: a.type,
            title: a.title,
            status: a.status,
            doneAt: a.doneAt?.toISOString() ?? null,
            dueAt: a.dueAt?.toISOString() ?? null,
            opportunity: a.opportunity ? { title: a.opportunity.title } : null,
            prospect: a.prospect ? { name: a.prospect.name } : null,
          })),
        }))}
      />
    </div>
  );
}
