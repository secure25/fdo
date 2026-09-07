import { withRoute, json } from "@/lib/api";
import { requireApi } from "@/lib/auth/guard";
import { deepResearchStatuses } from "@/lib/research/pipeline";

/** Deep-research chain status per product (polled by the dashboard badge). */
export const GET = withRoute(
  async () => {
    const auth = await requireApi();
    const statuses = await deepResearchStatuses(auth.orgId);
    return json({ statuses });
  },
  { name: "products/deep-research" }
);
