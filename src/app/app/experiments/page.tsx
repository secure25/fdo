import { requirePage } from "@/lib/auth/guard";
import { getExperimentView } from "@/lib/services/analytics";
import { ExperimentsView } from "@/components/experiments-view";

export const metadata = { title: "Experiments" };

export default async function ExperimentsPage() {
  const auth = await requirePage();
  const experiments = await getExperimentView(auth.orgId);
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <ExperimentsView initial={experiments} />
    </div>
  );
}
