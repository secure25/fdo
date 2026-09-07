/**
 * Deep-research pipeline orchestration:
 *   FETCH_SITE (scrape product URL → job.result) → RESEARCH (~15 web searches,
 *   deduped → job.result) → AI_ANALYZE (evidence-grounded intelligence → DB).
 * Enqueued from onboarding; the dashboard polls deepResearchStatusFor().
 */

import { prisma } from "../db";
import { jparse } from "../jsonfield";
import { enqueueJob } from "../jobs/queue";

const DEEP_JOB_TYPES = ["FETCH_SITE", "RESEARCH", "AI_ANALYZE"] as const;

export function enqueueDeepResearch(orgId: string, productId: string, url: string | null): Promise<unknown> {
  if (url) {
    return enqueueJob("FETCH_SITE", orgId, { orgId, productId, url });
  }
  // No URL to scrape — start straight at research (description-driven).
  return enqueueJob("RESEARCH", orgId, { orgId, productId });
}

export type DeepResearchStatus = {
  status: "idle" | "queued" | "running" | "done" | "failed";
  stage: string | null;
  updatedAt: string | null;
};

/** Latest chain state per product for one org. */
export async function deepResearchStatuses(orgId: string): Promise<Record<string, DeepResearchStatus>> {
  const jobs = await prisma.job.findMany({
    where: { orgId, type: { in: [...DEEP_JOB_TYPES] } },
    orderBy: { createdAt: "desc" },
    take: 120,
  });

  const byProduct = new Map<string, typeof jobs>();
  for (const job of jobs) {
    const productId = jparse<{ productId?: string }>(job.payload, {}).productId;
    if (!productId) continue;
    const list = byProduct.get(productId) ?? [];
    if (list.length < 3) list.push(job);
    byProduct.set(productId, list);
  }

  const out: Record<string, DeepResearchStatus> = {};
  for (const [productId, chain] of byProduct) {
    const active = chain.find((j) => j.status === "RUNNING" || j.status === "QUEUED");
    if (active) {
      out[productId] = {
        status: active.status === "RUNNING" ? "running" : "queued",
        stage: active.type,
        updatedAt: active.updatedAt.toISOString(),
      };
      continue;
    }
    const done = chain.find((j) => j.type === "AI_ANALYZE" && j.status === "DONE");
    if (done) {
      out[productId] = { status: "done", stage: null, updatedAt: done.updatedAt.toISOString() };
      continue;
    }
    const dead = chain.find((j) => j.status === "DEAD");
    out[productId] = dead
      ? { status: "failed", stage: dead.type, updatedAt: dead.updatedAt.toISOString() }
      : { status: "idle", stage: null, updatedAt: null };
  }
  return out;
}
