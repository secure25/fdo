import { requirePage } from "@/lib/auth/guard";
import { buildStrategistContext } from "@/lib/services/strategist-context";
import { answerStrategist } from "@/lib/engines/strategist";
import { StrategistChat } from "@/components/strategist-chat";

export const metadata = { title: "AI Strategist" };

export default async function StrategistPage() {
  const auth = await requirePage();
  const ctx = await buildStrategistContext(auth.orgId);
  const { text, actions } = answerStrategist("What should I work on today?", ctx);
  const greeting = `I'm your strategist for ${ctx.productName}. Quick read: ${ctx.stats.highIntent} high-intent opportunities, ${ctx.prospects.length} prospects in pipeline${ctx.healthScore ? `, distribution score ${ctx.healthScore}` : ""}.\n\n${text}`;
  return <StrategistChat greeting={greeting} />;
}
