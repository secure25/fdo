import { withRoute, json } from "@/lib/api";
import { requireApi, assertSameOrigin } from "@/lib/auth/guard";
import { campaignSchema, campaignActionSchema } from "@/lib/validation/schemas";
import { createCampaign, addCampaignAction } from "@/lib/services/app-data";

export const POST = withRoute(
  async ({ req }) => {
    await assertSameOrigin();
    const auth = await requireApi();
    const data = campaignSchema.parse(await req.json());
    const campaign = await createCampaign(auth.orgId, null, { ...data, goalMetric: data.goalMetric ?? undefined });
    return json({ ok: true, id: campaign.id });
  },
  { name: "campaigns/create" }
);

export const PUT = withRoute(
  async ({ req }) => {
    await assertSameOrigin();
    const auth = await requireApi();
    const data = campaignActionSchema.parse(await req.json());
    const campaignId = new URL(req.url).searchParams.get("campaignId") ?? "";
    const action = await addCampaignAction(auth.orgId, campaignId, { ...data, dueAt: data.dueAt ?? null });
    return json({ ok: true, id: action.id });
  },
  { name: "campaigns/add-action" }
);
