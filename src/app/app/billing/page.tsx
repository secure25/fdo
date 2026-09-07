import { requirePage } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { planOf } from "@/lib/entitlements";
import { creditsSummary } from "@/lib/usage";
import { paymentProvider } from "@/lib/billing";
import { BillingView } from "@/components/billing-view";

export const metadata = { title: "Billing" };

export default async function BillingPage() {
  const auth = await requirePage();
  const [sub, credits, productCount] = await Promise.all([
    prisma.subscription.findUnique({ where: { orgId: auth.orgId } }),
    creditsSummary(auth.orgId),
    prisma.product.count({ where: { orgId: auth.orgId } }),
  ]);
  const plan = planOf(sub?.plan);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <BillingView
        plan={plan.id}
        credits={credits.balance}
        usedThisMonth={credits.usedThisMonth}
        monthlyGrant={credits.monthlyGrant}
        seats={sub?.seats ?? 1}
        productsInUse={productCount}
        provider={paymentProvider()}
      />
    </div>
  );
}
