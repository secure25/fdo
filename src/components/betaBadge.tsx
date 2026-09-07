"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui";
import { isBetaEntitlementActive, getActiveBetaEntitlement } from "@/lib/betaEntitlement/betaEntitlement.service";

type Status = "idle" | "active" | "expired" | "none";

export function BetaBadge({ orgId }: { orgId: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [betaEntitlement, setBetaEntitlement] = useState<any>(null);
  const [daysRemaining, setDaysRemaining] = useState<number>(0);

  useEffect(() => {
    if (!orgId) {
      setStatus("none");
      return;
    }

    const checkStatus = async () => {
      const active = await isBetaEntitlementActive(orgId);
      if (active) {
        const entitlement = await getActiveBetaEntitlement(orgId);
        setBetaEntitlement(entitlement);
        setStatus("active");
        
        // Calculate days remaining
        const msRemaining = entitlement.endsAt.getTime() - Date.now();
        const days = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));
        setDaysRemaining(days);
      } else {
        setStatus("expired");
        setDaysRemaining(0);
      }
    };

    checkStatus();
  }, [orgId]);

  if (status === "none") {
    return null;
  }

  if (status === "active") {
    return (
      <Badge tone="accent" className="whitespace-nowrap">
        PRO BETA
        {daysRemaining > 0 && (
          <span className="ml-1 text-xs">({daysRemaining}d)</span>
        )}
      </Badge>
    );
  }

  if (status === "expired") {
    return (
      <Badge tone="warn" className="whitespace-nowrap">
        BETA EXPIRED
      </Badge>
    );
  }

  return null;
}
