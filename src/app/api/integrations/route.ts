import { withRoute, json } from "@/lib/api";
import { requireApi, assertSameOrigin } from "@/lib/auth/guard";
import { integrationSchema, settingsSchema } from "@/lib/validation/schemas";
import { prisma } from "@/lib/db";
import { switchOrg } from "@/lib/services/workspace";
import { jstr } from "@/lib/jsonfield";

export const POST = withRoute(
  async ({ req }) => {
    await assertSameOrigin();
    const auth = await requireApi();
    const data = integrationSchema.parse(await req.json());
    if (data.action === "connect") {
      await prisma.integration.upsert({
        where: { orgId_provider: { orgId: auth.orgId, provider: data.provider } },
        update: { status: "CONNECTED", config: data.config ? jstr(data.config) : null, lastSyncAt: new Date() },
        create: { orgId: auth.orgId, provider: data.provider, status: "CONNECTED", config: data.config ? jstr(data.config) : null },
      });
    } else {
      await prisma.integration.updateMany({
        where: { orgId: auth.orgId, provider: data.provider },
        data: { status: "DISCONNECTED" },
      });
    }
    return json({ ok: true });
  },
  { name: "integrations/toggle" }
);

export const PATCH = withRoute(
  async ({ req }) => {
    await assertSameOrigin();
    const auth = await requireApi();
    const data = settingsSchema.parse(await req.json());
    if (data.orgName) {
      await prisma.organization.update({ where: { id: auth.orgId }, data: { name: data.orgName } });
    }
    if (data.name) {
      await prisma.user.update({ where: { id: auth.user.id }, data: { name: data.name } });
    }
    if (data.defaultProductId) {
      await prisma.product.updateMany({ where: { orgId: auth.orgId }, data: { isDefault: false } });
      await prisma.product.updateMany({ where: { orgId: auth.orgId, id: data.defaultProductId }, data: { isDefault: true } });
    }
    return json({ ok: true });
  },
  { name: "settings/patch" }
);

export const PUT = withRoute(
  async ({ req }) => {
    await assertSameOrigin();
    const auth = await requireApi();
    const { orgId } = (await req.json()) as { orgId: string };
    await switchOrg(auth.user.id, orgId, auth.sessionId);
    return json({ ok: true });
  },
  { name: "orgs/switch" }
);
