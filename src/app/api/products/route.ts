import { withRoute, json } from "@/lib/api";
import { requireApi, assertSameOrigin } from "@/lib/auth/guard";
import { productSchema } from "@/lib/validation/schemas";
import { createProduct, runInitialDiscovery } from "@/lib/services/products";
import { enqueueDeepResearch } from "@/lib/research/pipeline";

export const POST = withRoute(
  async ({ req }) => {
    await assertSameOrigin();
    const auth = await requireApi();
    const input = productSchema.parse(await req.json());
    const { product, intel } = await createProduct(auth.orgId, {
      name: input.name,
      url: input.url || null,
      description: input.description,
      targetCustomer: input.targetCustomer || null,
      industry: input.industry || null,
      geography: input.geography || null,
      budgetBand: input.budgetBand || null,
      timePerWeek: input.timePerWeek ?? null,
    });
    // Kick off first discovery so the feed is populated immediately.
    const discovery = await runInitialDiscovery(auth.orgId, product.id);
    // Deep research runs in the background: FETCH_SITE → RESEARCH → AI_ANALYZE
    // upgrades this baseline with real website + market evidence when it lands.
    await enqueueDeepResearch(auth.orgId, product.id, input.url || null);
    return json({
      product: { id: product.id, name: product.name },
      intel: {
        category: intel.category,
        icp: intel.icp,
        problems: intel.problems,
        competitors: intel.competitors,
        confidence: intel.detectionConfidence,
        model: intel.model,
      },
      discovery,
      deepResearch: { queued: true, url: input.url || null },
    });
  },
  { name: "products/create", rateLimit: { limit: 6, windowSec: 3600 } }
);
