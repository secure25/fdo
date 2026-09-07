import { requirePage } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { planOf } from "@/lib/entitlements";
import { listOrgsFor } from "@/lib/services/workspace";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await requirePage();
  const productCount = await prisma.product.count({ where: { orgId: auth.orgId } });
  if (productCount === 0) redirect("/onboarding");

  const [orgs, sub] = await Promise.all([
    listOrgsFor(auth.user.id),
    prisma.subscription.findUnique({ where: { orgId: auth.orgId } }),
  ]);

  return (
    <AppShell
      user={{ name: auth.user.name, email: auth.user.email, role: auth.role }}
      org={auth.org}
      orgs={orgs.map((m) => ({ id: m.org.id, name: m.org.name, slug: m.org.slug }))}
      plan={planOf(sub?.plan).name}
    >
      {children}
    </AppShell>
  );
}
