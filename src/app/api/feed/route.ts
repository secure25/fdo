import { withRoute, json } from "@/lib/api";
import { requireApi } from "@/lib/auth/guard";
import { listOpportunities } from "@/lib/services/opportunities";

export const GET = withRoute(
  async ({ req }) => {
    const auth = await requireApi();
    const url = new URL(req.url);
    const band = url.searchParams.get("band");
    const status = url.searchParams.get("status");
    const intent = url.searchParams.get("intent");
    const data = await listOpportunities(auth.orgId, {
      band: band?.split(","),
      status: status?.split(","),
      intent: intent?.split(","),
      limit: 80,
    });
    return json({ data });
  },
  { name: "feed" }
);
