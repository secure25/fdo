import { withRoute, json } from "@/lib/api";
import { requireApi, assertSameOrigin } from "@/lib/auth/guard";
import { opportunityActionSchema } from "@/lib/validation/schemas";
import { setOpportunityStatus } from "@/lib/services/opportunities";

export const PATCH = withRoute<{ id: string }>(
  async ({ req, params }) => {
    await assertSameOrigin();
    const auth = await requireApi();
    const { status } = opportunityActionSchema.parse(await req.json());
    const updated = await setOpportunityStatus(auth.orgId, params.id, status);
    return json({ ok: true, status: updated.status });
  },
  { name: "opportunities/patch" }
);
