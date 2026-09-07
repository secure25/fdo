import { withRoute, json } from "@/lib/api";
import { requireApi, assertSameOrigin } from "@/lib/auth/guard";
import { recommendationSchema } from "@/lib/validation/schemas";
import { prisma } from "@/lib/db";
import { notFound } from "@/lib/errors";

export const POST = withRoute(
  async ({ req }) => {
    await assertSameOrigin();
    const auth = await requireApi();
    const data = recommendationSchema.parse(await req.json());
    const rec = await prisma.recommendation.findFirst({ where: { id: data.id, orgId: auth.orgId } });
    if (!rec) throw notFound("Recommendation not found");
    await prisma.recommendation.update({ where: { id: data.id }, data: { status: data.status } });
    return json({ ok: true });
  },
  { name: "recommendations/update" }
);
