"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui";

type Status = "idle" | "queued" | "running" | "done" | "failed";

const COPY: Record<Status, { label: string; tone: "neutral" | "warn" | "good" | "accent" }> = {
  idle: { label: "", tone: "neutral" },
  queued: { label: "Deep research queued", tone: "neutral" },
  running: { label: "Deep research running — scraping site & scanning the web", tone: "accent" },
  done: { label: "Deep research complete", tone: "good" },
  failed: { label: "Deep research unavailable — using baseline analysis", tone: "warn" },
};

/**
 * Live status chip for the background deep-research chain
 * (FETCH_SITE → RESEARCH → AI_ANALYZE). Polls while active and
 * refreshes the server-rendered dashboard when the analysis lands.
 */
export function DeepResearchStatus({ productId, initialStatus }: { productId: string; initialStatus: Status }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(initialStatus);
  const prev = useRef<Status>(initialStatus);

  useEffect(() => {
    if (status !== "queued" && status !== "running") return;
    const t = setInterval(async () => {
      try {
        const res = await fetch("/api/products/deep-research", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { statuses: Record<string, { status: Status }> };
        const next = data.statuses[productId]?.status;
        if (next && next !== prev.current) {
          prev.current = next;
          setStatus(next);
          if (next === "done") router.refresh();
        }
      } catch {
        // transient network error — keep polling
      }
    }, 6_000);
    return () => clearInterval(t);
  }, [status, productId, router]);

  const copy = COPY[status];
  if (!copy.label) return null;
  return (
    <Badge tone={copy.tone} className={status === "running" ? "animate-pulse" : undefined}>
      {copy.label}
    </Badge>
  );
}
