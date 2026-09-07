import { withRoute, json } from "@/lib/api";
import { requireApi, assertSameOrigin } from "@/lib/auth/guard";
import { competitorSchema, competitorEventSchema } from "@/lib/validation/schemas";
import { addCompetitor, addCompetitorEventManually, toggleCompetitorMonitor } from "@/lib/services/app-data";
import { z } from "zod";

export const POST = withRoute(
  async ({ req }) => {
    await assertSameOrigin();
    const auth = await requireApi();
    const data = competitorSchema.parse(await req.json());
    const competitor = await addCompetitor(auth.orgId, null, { name: data.name, url: data.url || undefined, positioning: data.positioning || undefined });
    return json({ ok: true, id: competitor.id });
  },
  { name: "competitors/create" }
);

export const PUT = withRoute(
  async ({ req }) => {
    await assertSameOrigin();
    const auth = await requireApi();
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    if (action === "monitor") {
      const { id, monitor } = z.object({ id: z.string().cuid(), monitor: z.boolean() }).parse(await req.json());
      await toggleCompetitorMonitor(auth.orgId, id, monitor);
      return json({ ok: true });
    }
    const data = competitorEventSchema.parse(await req.json());
    await addCompetitorEventManually(auth.orgId, data);
    return json({ ok: true });
  },
  { name: "competitors/events" }
);
