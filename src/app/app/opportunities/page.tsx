import { requirePage } from "@/lib/auth/guard";
import { listOpportunities } from "@/lib/services/opportunities";
import { resolveEffectivePlan } from "@/lib/entitlements";
import { OpportunityFeed } from "@/components/opportunity-feed";

export const metadata = { title: "Opportunities" };

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: { band?: string; channel?: string; status?: string; intent?: string };
}) {
  const auth = await requirePage();
  const sp = searchParams;
  const [items, plan] = await Promise.all([
    listOpportunities(auth.orgId, {
      band: sp.band?.split(","),
      status: sp.status && sp.status !== "ALL" ? sp.status.split(",") : undefined,
      intent: sp.intent?.split(","),
      limit: 80,
    }),
    resolveEffectivePlan(auth.orgId),
  ]);
  return (
    <OpportunityFeed
      initial={items}
      status={sp.status ?? "ALL"}
      plan={{ live: plan.limits.liveDiscovery, surfaced: plan.limits.opportunitiesSurfaced }}
    />
  );
}
