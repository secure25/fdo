import { withRoute, json } from "@/lib/api";
import { requireApi, assertSameOrigin } from "@/lib/auth/guard";
import { experimentSchema, experimentResultSchema } from "@/lib/validation/schemas";
import { createExperiment, addExperimentResult, concludeExperiment } from "@/lib/services/app-data";
import { z } from "zod";

export const POST = withRoute(
  async ({ req }) => {
    await assertSameOrigin();
    const auth = await requireApi();
    const data = experimentSchema.parse(await req.json());
    const experiment = await createExperiment(auth.orgId, null, data);
    return json({ ok: true, id: experiment.id });
  },
  { name: "experiments/create" }
);

export const PUT = withRoute(
  async ({ req }) => {
    await assertSameOrigin();
    const auth = await requireApi();
    const url = new URL(req.url);
    const experimentId = url.searchParams.get("experimentId") ?? "";
    const action = url.searchParams.get("action");
    if (action === "conclude") {
      await concludeExperiment(auth.orgId, experimentId);
      return json({ ok: true, concluded: true });
    }
    const data = experimentResultSchema.parse(await req.json());
    await addExperimentResult(auth.orgId, experimentId, data);
    return json({ ok: true });
  },
  { name: "experiments/results" }
);
