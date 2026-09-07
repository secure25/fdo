import { withRoute, json } from "@/lib/api";
import { requireApi, assertSameOrigin } from "@/lib/auth/guard";
import { scanSchema } from "@/lib/validation/schemas";
import { enqueueJob } from "@/lib/jobs/queue";
import { runInitialDiscovery } from "@/lib/services/products";

export const POST = withRoute(
  async ({ req }) => {
    await assertSameOrigin();
    const auth = await requireApi();
    const input = scanSchema.parse(await req.json().catch(() => ({})));

    if (input.live) {
      // Live scans run through the queue (retryable, rate-limited by the worker).
      await enqueueJob("DISCOVERY_SCAN", auth.orgId, { orgId: auth.orgId, productId: input.productId ?? null, live: true }, { priority: 10 });
      return json({ queued: true, mode: "live" });
    }
    // Sandbox scan runs inline so new workspaces get instant data.
    const productId = input.productId ?? (await getDefaultProductId(auth.orgId));
    if (!productId) return json({ queued: false, mode: "none" });
    const outcome = await runInitialDiscovery(auth.orgId, productId);
    return json({ queued: false, mode: "sandbox", ...outcome });
  },
  { name: "discovery/scan", rateLimit: { limit: 10, windowSec: 600 } }
);

async function getDefaultProductId(orgId: string): Promise<string | null> {
  const { prisma } = await import("@/lib/db");
  const p = await prisma.product.findFirst({ where: { orgId, isDefault: true } }) ?? (await prisma.product.findFirst({ where: { orgId } }));
  return p?.id ?? null;
}
