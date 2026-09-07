import { requirePage } from "@/lib/auth/guard";
import { listOpportunities } from "@/lib/services/opportunities";
import { planOf } from "@/lib/entitlements";
import { prisma } from "@/lib/db";
import { OpportunityFeed } from "@/components/opportunity-feed";

export const metadata = { title: "Opportunities" };

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams?: { band?: string; status?: string; intent?: string };
}) {
  const auth = await requirePage();
  const sp = searchParams ?? {};
  const [items, sub] = await Promise.all([
    listOpportunities(auth.orgId, {
      band: sp.band?.split(","),
      status: sp.status?.split(","),
      intent: sp.intent?.split(","),
      limit: 80,
    }),
    prisma.subscription.findUnique({ where: { orgId: auth.orgId } }),
  ]);
  const plan = planOf(sub?.plan);
  return (
    <OpportunityFeed
      initial={items}
      status={sp.status ?? "ALL"}
      plan={{ live: plan.limits.liveDiscovery, surfaced: plan.limits.opportunitiesSurfaced }}
    />
  );
}
