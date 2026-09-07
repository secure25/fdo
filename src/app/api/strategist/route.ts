import { NextResponse } from "next/server";
import { withRoute } from "@/lib/api";
import { requireApi } from "@/lib/auth/guard";
import { strategistSchema } from "@/lib/validation/schemas";
import { buildStrategistContext, answer } from "@/lib/services/strategist-context";
import { tryAI } from "@/lib/ai/provider";
import { spendCredits } from "@/lib/usage";
import { prisma } from "@/lib/db";
import { enqueueJob } from "@/lib/jobs/queue";
import { enqueueDeepResearch } from "@/lib/research/pipeline";

/**
 * Detects "go find new leads" requests so the strategist can act, not just
 * advise: e.g. "find new opportunities", "scan for leads", "source customers".
 * Kept verb-gated so questions like "which opportunities should I focus on"
 * never trigger a scan.
 */
const DISCOVERY_INTENT =
  /\b(find|scan|look for|look out|discover|source|gather|search for|hunt for|research|mine)\b[^.?!]{0,60}\b(opportunit\w*|leads?|prospects?|customers?|people|users?|threads?|conversations?|buyers?|discussions?|posts?|markets?)\b/i;

export const POST = withRoute(
  async ({ req }) => {
    const auth = await requireApi();
    const { message } = strategistSchema.parse(await req.json());
    const ctx = await buildStrategistContext(auth.orgId);
    const result = answer(message, ctx);

    // Tool use: a discovery request kicks off the real machinery — live scan +
    // deep research. Scoring, dedupe (unique per URL hash) and quality filters
    // happen in the pipeline; new leads land in the feed automatically.
    let discoveryNote = "";
    const extraActions: { label: string; href: string }[] = [];
    if (DISCOVERY_INTENT.test(message)) {
      const product = await prisma.product.findFirst({
        where: { orgId: auth.orgId, isDefault: true },
        select: { id: true, url: true },
      });
      if (product) {
        await enqueueJob("DISCOVERY_SCAN", auth.orgId, { orgId: auth.orgId, productId: product.id, live: true }, { priority: 10 });
        await enqueueDeepResearch(auth.orgId, product.id, product.url);
        const last24h = await prisma.opportunity.count({
          where: { orgId: auth.orgId, createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
        });
        discoveryNote = `On it — I've kicked off a live discovery scan plus a deep-research run (site scrape + ~15 market searches across Reddit, Hacker News and the web). New scored leads start landing in your feed within a couple of minutes; duplicates and low-relevance noise are filtered automatically. For context, ${last24h} opportunities landed in the last 24h.\n\n`;
        extraActions.push({ label: "Open opportunities feed", href: "/app/opportunities" });
      } else {
        discoveryNote = "I can run a live scan and market research for you — but first I need a product to scan for. Complete onboarding and ask me again.\n\n";
      }
    }
    const actions = [...extraActions, ...result.actions];

    // LLM path: stream a richer, context-grounded answer.
    const stream = req.nextUrl.searchParams.get("stream") === "1";
    if (stream && result.hasAI) {
      await spendCredits(auth.orgId, 3, { kind: "strategist" }).catch(() => {
        throw Object.assign(new Error("AI credits exhausted"), { status: 402 });
      });
      const encoder = new TextEncoder();
      const gen = await tryAI(
        (ai) => ai.stream({
          system: result.systemPrompt,
          messages: [{ role: "user", content: message }],
          temperature: 0.5,
          maxTokens: 700,
        }),
        { label: "strategist" }
      );

      return new NextResponse(
        new ReadableStream({
          async start(controller) {
            let produced = false;
            try {
              if (discoveryNote) controller.enqueue(encoder.encode(discoveryNote));
              if (gen) {
                for await (const chunk of gen) {
                  produced = true;
                  controller.enqueue(encoder.encode(chunk));
                }
              }
            } catch {
              // fall through to deterministic answer below
            }
            if (!produced && !discoveryNote) {
              controller.enqueue(encoder.encode(result.text));
            }
            controller.enqueue(encoder.encode(`\n---ACTIONS---\n${JSON.stringify(actions)}`));
            controller.close();
          },
        }),
        { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json({ text: discoveryNote + result.text, actions });
  },
  { name: "strategist", rateLimit: { limit: 30, windowSec: 300 } }
);
