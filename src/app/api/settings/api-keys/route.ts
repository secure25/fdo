import { withRoute, json } from "@/lib/api";
import { requireApi, assertSameOrigin } from "@/lib/auth/guard";
import { generateApiKey } from "@/lib/auth/password";
import { prisma } from "@/lib/db";
import { resolveEffectivePlan } from "@/lib/entitlements";
import { forbidden } from "@/lib/errors";
import { z } from "zod";

const createSchema = z.object({ name: z.string().trim().min(1).max(80) });

export const POST = withRoute(
  async ({ req }) => {
    await assertSameOrigin();
    const auth = await requireApi();
    const plan = await resolveEffectivePlan(auth.orgId);
    if (!plan.limits.api) throw forbidden("API access requires the Pro plan");
    const { name } = createSchema.parse(await req.json());
    const key = generateApiKey();
    const record = await prisma.apiKey.create({
      data: { orgId: auth.orgId, name, prefix: key.prefix, keyHash: key.hash },
    });
    return json({ id: record.id, prefix: key.prefix, key: key.full });
  },
  { name: "settings/api-keys" }
);

export const DELETE = withRoute(
  async ({ req }) => {
    await assertSameOrigin();
    const auth = await requireApi();
    const id = new URL(req.url).searchParams.get("id") ?? "";
    await prisma.apiKey.deleteMany({ where: { id, orgId: auth.orgId } });
    return json({ ok: true });
  },
  { name: "settings/api-keys" }
);
