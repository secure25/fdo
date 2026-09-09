import { requirePage } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { resolveEffectivePlan } from "@/lib/entitlements";
import { SettingsView } from "@/components/settings-view";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const auth = await requirePage();
  const [products, plan, keys, memberships] = await Promise.all([
    prisma.product.findMany({ where: { orgId: auth.orgId }, select: { id: true, name: true, isDefault: true } }),
    resolveEffectivePlan(auth.orgId),
    prisma.apiKey.findMany({ where: { orgId: auth.orgId }, orderBy: { createdAt: "desc" } }),
    prisma.membership.findMany({
      where: { orgId: auth.orgId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <SettingsView
        user={{ id: auth.user.id, name: auth.user.name, email: auth.user.email }}
        org={auth.org}
        products={products}
        planApi={plan.limits.api}
        apiKeys={keys.map((k) => ({ id: k.id, name: k.name, prefix: k.prefix, createdAt: k.createdAt.toISOString() }))}
        team={{
          members: memberships.map((m) => ({
            id: m.id,
            userId: m.user.id,
            name: m.user.name,
            email: m.user.email,
            role: m.role,
            createdAt: m.createdAt.toISOString(),
          })),
          seatsLimit: plan.limits.seats,
          planName: plan.name,
          currentUserId: auth.user.id,
          currentRole: auth.role,
        }}
      />
    </div>
  );
}
