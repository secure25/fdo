import { withRoute, json } from "@/lib/api";
import { requireApi, assertSameOrigin } from "@/lib/auth/guard";
import { setCampaignActionStatus } from "@/lib/services/app-data";
import { z } from "zod";

const schema = z.object({ status: z.enum(["TODO", "DONE", "SKIPPED"]) });

export const PATCH = withRoute<{ id: string }>(
  async ({ req, params }) => {
    await assertSameOrigin();
    const auth = await requireApi();
    const { status } = schema.parse(await req.json());
    await setCampaignActionStatus(auth.orgId, params.id, status);
    return json({ ok: true });
  },
  { name: "campaigns/patch-action" }
);
