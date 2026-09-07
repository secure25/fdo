import { withRoute, json } from "@/lib/api";
import { requireApi, assertSameOrigin } from "@/lib/auth/guard";
import { prospectUpdateSchema } from "@/lib/validation/schemas";
import { updateProspect } from "@/lib/services/app-data";

export const PATCH = withRoute<{ id: string }>(
  async ({ req, params }) => {
    await assertSameOrigin();
    const auth = await requireApi();
    const data = prospectUpdateSchema.parse(await req.json());
    const updated = await updateProspect(auth.orgId, params.id, data);
    return json({ ok: true, stage: updated.stage });
  },
  { name: "prospects/patch" }
);
