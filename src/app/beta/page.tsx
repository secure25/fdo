import { requirePage } from "@/lib/auth/guard";
import {
  getActiveBetaEntitlement,
  isBetaEntitlementActive,
} from "@/lib/betaEntitlement/betaEntitlement.service";
import { BetaClient } from "./beta-client";

export const metadata = { title: "Beta Program" };

export default async function BetaPage() {
  const auth = await requirePage();
  const active = await isBetaEntitlementActive(auth.orgId);
  const entitlement = active ? await getActiveBetaEntitlement(auth.orgId) : null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <BetaClient
        initialActive={active}
        initialEntitlement={
          entitlement
            ? {
                id: entitlement.id,
                cohort: entitlement.cohort,
                startsAt: entitlement.startsAt.toISOString(),
                endsAt: entitlement.endsAt.toISOString(),
                status: entitlement.status,
              }
            : null
        }
      />
    </div>
  );
}

