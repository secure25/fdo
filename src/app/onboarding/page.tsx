import { requirePage } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { OnboardingWizard } from "@/components/onboarding";

export const metadata = { title: "Set up your product" };

export default async function OnboardingPage() {
  const auth = await requirePage();
  const org = await prisma.organization.findUnique({ where: { id: auth.orgId } });
  const productCount = await prisma.product.count({ where: { orgId: auth.orgId } });
  return <OnboardingWizard orgName={org?.name ?? "Your workspace"} userName={auth.user.name} key={productCount} />;
}
