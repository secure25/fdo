import { requirePage } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { planOf } from "@/lib/entitlements";
import { SettingsView } from "@/components/settings-view";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const auth = await requirePage();
  const [products, sub, keys] = await Promise.all([
    prisma.product.findMany({ where: { orgId: auth.orgId }, select: { id: true, name: true, isDefault: true } }),
    prisma.subscription.findUnique({ where: { orgId: auth.orgId } }),
    prisma.apiKey.findMany({ where: { orgId: auth.orgId }, orderBy: { createdAt: "desc" } }),
  ]);
  const plan = planOf(sub?.plan);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <SettingsView
        user={{ name: auth.user.name, email: auth.user.email }}
        org={auth.org}
        products={products}
        planApi={plan.limits.api}
        apiKeys={keys.map((k) => ({ id: k.id, name: k.name, prefix: k.prefix, createdAt: k.createdAt.toISOString() }))}
      />
    </div>
  );
}
