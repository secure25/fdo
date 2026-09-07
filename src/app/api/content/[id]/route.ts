import { withRoute, json } from "@/lib/api";
import { requireApi, assertSameOrigin } from "@/lib/auth/guard";
import { contentUpdateSchema } from "@/lib/validation/schemas";
import { updateContent } from "@/lib/services/app-data";

export const POST = withRoute<{ id: string }>(
  async ({ req, params }) => {
    await assertSameOrigin();
    const auth = await requireApi();
    const data = contentUpdateSchema.parse(await req.json());
    const updated = await updateContent(auth.orgId, params.id, data.action, {
      title: data.title,
      body: data.body,
      url: data.url,
      metrics: data.metrics,
    });
    return json({ ok: true, status: updated.status });
  },
  { name: "content/update" }
);
