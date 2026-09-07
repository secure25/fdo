import { withRoute, json } from "@/lib/api";
import { requireApi, assertSameOrigin } from "@/lib/auth/guard";
import { generateResponseFor } from "@/lib/services/opportunities";

export const POST = withRoute<{ id: string }>(
  async ({ req, params }) => {
    await assertSameOrigin();
    const auth = await requireApi();
    const body = (await req.json().catch(() => ({}))) as { productId?: string };
    const draft = await generateResponseFor(auth.orgId, body.productId ?? null, params.id);
    return json(draft);
  },
  { name: "opportunities/draft", rateLimit: { limit: 20, windowSec: 600 } }
);
