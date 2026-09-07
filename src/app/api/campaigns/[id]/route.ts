import { withRoute, json } from "@/lib/api";
import { requireApi, assertSameOrigin } from "@/lib/auth/guard";
import { z } from "zod";
import { setCampaignStatus } from "@/lib/services/app-data";

const statusSchema = z.object({
  status: z.enum(["ACTIVE", "PAUSED", "DONE", "SCHEDULED"]),
});

/** Campaign status control: pause / resume / mark done. */
export const PATCH = withRoute(
  async ({ req, params }) => {
    await assertSameOrigin();
    const auth = await requireApi();
    const { status } = statusSchema.parse(await req.json());
    const campaign = await setCampaignStatus(auth.orgId, params.id, status);
    return json({ ok: true, status: campaign.status });
  },
  { name: "campaigns/status" }
);
