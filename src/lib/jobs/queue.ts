/**
 * Durable in-process job queue (spec §20: background jobs, queues, retry).
 * - Lease-based claiming so a crashed worker's jobs are re-queued after the lease expires.
 * - Exponential backoff; DEAD after maxAttempts.
 * Swap for a Redis/BullMQ worker on horizontal deployments — the Job table API stays identical.
 */

import { prisma } from "../db";
import { logger } from "../logger";

export type JobType = "DISCOVERY_SCAN" | "COMPETITOR_WATCH" | "AI_ENRICH" | "DIGEST" | "FETCH_SITE" | "RESEARCH" | "AI_ANALYZE";

export type JobHandler = (payload: Record<string, unknown>, job: { id: string; orgId: string | null; attempt: number }) => Promise<void>;

const BACKOFF_MS = [10_000, 60_000, 5 * 60_000, 30 * 60_000];
const LEASE_MS = 2 * 60_000;
// Deep-research stages do real network work (scrape, ~15 searches, LLM call);
// a short lease could expire mid-run and double-execute them.
const LEASE_BY_TYPE: Partial<Record<JobType, number>> = {
  FETCH_SITE: 5 * 60_000,
  RESEARCH: 5 * 60_000,
  AI_ANALYZE: 10 * 60_000,
};
const MAX_CONCURRENCY = 1;

export function enqueueJob(type: JobType, orgId: string | null, payload: Record<string, unknown>, opts: { priority?: number; runAt?: Date; maxAttempts?: number } = {}) {
  return prisma.job.create({
    data: {
      type,
      orgId,
      payload: JSON.stringify(payload),
      priority: opts.priority ?? 50,
      runAt: opts.runAt ?? new Date(),
      maxAttempts: opts.maxAttempts ?? 3,
    },
  });
}

export async function processDueJobs(handlers: Record<JobType, JobHandler>): Promise<number> {
  let processed = 0;
  for (let i = 0; i < MAX_CONCURRENCY; i++) {
    const job = await claimNext();
    if (!job) break;
    processed += 1;
    const handler = handlers[job.type as JobType];
    if (!handler) {
      await failJob(job.id, job.attempts, job.maxAttempts, `No handler for ${job.type}`);
      continue;
    }
    try {
      await handler(JSON.parse(job.payload) as Record<string, unknown>, {
        id: job.id,
        orgId: job.orgId,
        attempt: job.attempts,
      });
      await prisma.job.update({ where: { id: job.id }, data: { status: "DONE", leasedUntil: null, updatedAt: new Date() } });
    } catch (err) {
      await failJob(job.id, job.attempts, job.maxAttempts, err instanceof Error ? err.message : String(err));
    }
  }
  return processed;
}

async function claimNext() {
  const now = new Date();
  // Release expired leases
  await prisma.job.updateMany({
    where: { status: "RUNNING", leasedUntil: { lt: now } },
    data: { status: "QUEUED", leasedUntil: null },
  });
  const candidate = await prisma.job.findFirst({
    where: { status: "QUEUED", runAt: { lte: now } },
    orderBy: [{ priority: "asc" }, { runAt: "asc" }],
  });
  if (!candidate) return null;
  const leaseMs = LEASE_BY_TYPE[candidate.type as JobType] ?? LEASE_MS;
  const leased = await prisma.job.updateMany({
    where: { id: candidate.id, status: "QUEUED" },
    data: { status: "RUNNING", leasedUntil: new Date(Date.now() + leaseMs), attempts: { increment: 1 }, updatedAt: now },
  });
  if (leased.count === 0) return null;
  return { ...candidate, attempts: candidate.attempts + 1 };
}

async function failJob(id: string, attempts: number, maxAttempts: number, error: string) {
  const dead = attempts >= maxAttempts;
  const backoff = BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)] ?? 60_000;
  logger.warn("job failed", { id, attempts, dead, error: error.slice(0, 300) });
  await prisma.job.update({
    where: { id },
    data: {
      status: dead ? "DEAD" : "QUEUED",
      lastError: error.slice(0, 1000),
      runAt: new Date(Date.now() + backoff),
      leasedUntil: null,
      updatedAt: new Date(),
    },
  });
}

export async function queueStats() {
  const [queued, running, done, dead] = await Promise.all([
    prisma.job.count({ where: { status: "QUEUED" } }),
    prisma.job.count({ where: { status: "RUNNING" } }),
    prisma.job.count({ where: { status: "DONE" } }),
    prisma.job.count({ where: { status: "DEAD" } }),
  ]);
  return { queued, running, done, dead };
}
