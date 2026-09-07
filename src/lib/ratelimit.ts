/**
 * In-process token-bucket rate limiter.
 * Single-node deployments use this Map; horizontal deployments swap `store`
 * for Redis (same interface). Buckets are pruned lazily to bound memory.
 */

type Bucket = { tokens: number; last: number; resetAt: number };

const store = new Map<string, Bucket>();
let lastSweep = Date.now();

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSec: number };

export function rateLimit(key: string, opts: { limit: number; windowSec: number }): RateLimitResult {
  const now = Date.now();
  const windowMs = opts.windowSec * 1000;
  sweep(now);
  let bucket = store.get(key);
  if (!bucket || now - bucket.last > windowMs) {
    bucket = { tokens: opts.limit, last: now, resetAt: now + windowMs };
    store.set(key, bucket);
  }
  const elapsed = now - bucket.last;
  const refill = (elapsed / windowMs) * opts.limit;
  bucket.tokens = Math.min(opts.limit, bucket.tokens + refill);
  bucket.last = now;
  if (bucket.tokens < 1) {
    const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return { ok: false, remaining: 0, retryAfterSec };
  }
  bucket.tokens -= 1;
  return { ok: true, remaining: Math.floor(bucket.tokens), retryAfterSec: 0 };
}

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of store) {
    if (now - b.last > 10 * 60_000) store.delete(k);
  }
}

/** Client identity for rate limiting: ip or session key. */
export function clientKey(prefix: string, ip: string | null | undefined, extra?: string) {
  return `${prefix}:${extra ?? ip ?? "anon"}`;
}
