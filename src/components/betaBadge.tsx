"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui";

type Status = "idle" | "active" | "expired" | "none";

export function BetaBadge({ orgId }: { orgId: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [daysRemaining, setDaysRemaining] = useState<number>(0);

  useEffect(() => {
    if (!orgId) {
      setStatus("none");
      return;
    }

    let mounted = true;
    const checkStatus = async () => {
      try {
        const res = await fetch("/api/betaEntitlement");
        if (!res.ok) {
          if (mounted) setStatus("none");
          return;
        }
        const data = await res.json();
        if (!mounted) return;
        if (data.active && data.betaEntitlement) {
          setStatus("active");
          setDaysRemaining(data.betaEntitlement.daysRemaining ?? 0);
        } else {
          setStatus("none");
        }
      } catch {
        if (mounted) setStatus("none");
      }
    };

    checkStatus();
    return () => {
      mounted = false;
    };
  }, [orgId]);

  if (status === "none" || status === "idle") {
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

