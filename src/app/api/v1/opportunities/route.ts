/**
 * Public API (Pro plan) — API-key authenticated read endpoints.
 * Key format: sk-dos-<prefix>-<secret>; only the SHA-256 hash is stored.
 */

import { NextRequest, NextResponse } from "next/server";
import { sha256 } from "@/lib/auth/password";
import { prisma } from "@/lib/db";
import { planOf } from "@/lib/entitlements";
import { rateLimit } from "@/lib/ratelimit";
import { toDTO } from "@/lib/services/opportunities";

async function authenticate(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer sk-dos-")) return null;
  const key = auth.slice(7).trim();
  const record = await prisma.apiKey.findUnique({ where: { keyHash: sha256(key) } });
  if (!record) return null;
  const sub = await prisma.subscription.findUnique({ where: { orgId: record.orgId } });
  const plan = planOf(sub?.plan);
  if (!plan.limits.api) return null;
  await prisma.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  return { orgId: record.orgId, plan };
}

export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (!ctx) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Valid Pro API key required" } }, { status: 401 });
  }
  const rl = rateLimit(`api:${ctx.orgId}`, { limit: 60, windowSec: 60 });
  if (!rl.ok) {
    return NextResponse.json({ error: { code: "RATE_LIMITED", message: "60 requests/minute on Pro API" } }, { status: 429 });
  }

  const url = new URL(req.url);
  const band = url.searchParams.get("band");
  const status = url.searchParams.get("status") ?? "NEW";
  const limit = Math.min(50, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20);

  const rows = await prisma.opportunity.findMany({
    where: {
      orgId: ctx.orgId,
      ...(band ? { band: { in: band.split(",") } } : {}),
      ...(status ? { status: { in: status.split(",") } } : {}),
    },
    orderBy: { score: "desc" },
    take: limit,
  });

  return NextResponse.json({
    data: rows.map((r) => toDTO(r)),
    meta: { plan: ctx.plan.id, remaining: rl.remaining },
  });
}
