/**
 * Job handlers + background scheduler. The scheduler runs inside the Next.js
 * Node runtime via instrumentation.ts (idempotent singleton, dev+prod).
 */

import { prisma } from "../db";
import { logger } from "../logger";
import { processDueJobs, enqueueJob, type JobHandler, type JobType } from "./queue";
import { runPipeline, communityMapFor } from "../discovery/orchestrator";
import { ADAPTERS } from "../discovery/adapters";
import { planOf } from "../entitlements";
import { analyzeEvent, type CompetitorEventKind } from "../engines/competitor";
import { classifyIntent } from "../engines/intent";
import { meter } from "../usage";
import { isPublicHttpUrl } from "../research/url-guard";
import { firecrawlScrape, MAX_MARKDOWN_CHARS, type SearchHit } from "../research/firecrawl";
import { buildResearchBatches, runResearch, searchHitToCandidate } from "../research/research";
import { isOwnSite, hitMentionsBrand, classifyResearchHits, shouldSuppress, type ClassifiedHit } from "../research/self-hit";
import { deepAnalyzeProduct } from "../research/deep-analyze";
import { persistIntelligence } from "../services/products";
import { jparse } from "../jsonfield";

// ─── Handlers ─────────────────────────────────────────────────────────────────

const discoveryScan: JobHandler = async (payload) => {
  const orgId = String(payload.orgId);
  const productId = payload.productId ? String(payload.productId) : null;
  const useLive = Boolean(payload.live);

  const sub = await prisma.subscription.findUnique({ where: { orgId } });
  const plan = planOf(sub?.plan);

  const product = productId
    ? await prisma.product.findUnique({ where: { id: productId }, include: { analysis: true } })
    : await prisma.product.findFirst({ where: { orgId, isDefault: true }, include: { analysis: true } });
  if (!product?.analysis) throw new Error("Product or analysis missing for scan");

  const communityIds = await communityMapFor(orgId, product.id);
  const productCommunities = await prisma.productCommunity.findMany({
    where: { productId: product.id },
    include: { community: true },
  });

  const ctx = {
    orgId,
    productId: product.id,
    productName: product.name,
    category: product.analysis.category,
    icpName: String((JSON.parse(product.analysis.confidence) as Record<string, unknown>).icpName ?? product.analysis.category),
    keywords: JSON.parse(product.analysis.keywords) as string[],
    problems: JSON.parse(product.analysis.problems) as string[],
    communityIds,
  };

  const communityNames = productCommunities
    .filter((pc) => pc.community.platform === "REDDIT")
    .map((pc) => pc.community.name.replace(/^r\//i, ""));
  const competitorNames = (await prisma.competitor.findMany({ where: { orgId, productId: product.id } })).map((c) => c.name);

  const candidates = [];
  const liveLimit = Math.min(30, plan.limits.opportunitiesSurfaced);

  if (useLive && plan.limits.liveDiscovery) {
    const hn = await ADAPTERS.hackernews.discover(
      { keywords: ctx.keywords, communityNames: [], competitorNames, icpDescription: ctx.icpName },
      { limit: Math.ceil(liveLimit / 2) }
    );
    candidates.push(...hn);
    const rd = await ADAPTERS.reddit.discover(
      { keywords: ctx.keywords, communityNames, competitorNames, icpDescription: ctx.icpName },
      { limit: Math.ceil(liveLimit / 2) }
    );
    candidates.push(...rd);
    for (const adapterId of ["hackernews", "reddit"]) {
      await prisma.source.updateMany({
        where: { orgId, adapter: adapterId },
        data: { lastRunAt: new Date(), status: "ACTIVE", lastError: null },
      });
    }
  }

  const outcome = await runPipeline(candidates, ctx);
  await meter(orgId, "DISCOVERY_SCAN", 1, { inserted: outcome.inserted, live: useLive });
  logger.info("discovery scan complete", { orgId, ...outcome, live: useLive });

  // Keep leads flowing: a completed live scan renews itself for +24h. The chain
  // stops on plan downgrade (guard re-checked next run) or persistent failure.
  if (useLive && plan.limits.liveDiscovery) {
    await enqueueJob("DISCOVERY_SCAN", orgId, { orgId, productId, live: true }, {
      runAt: new Date(Date.now() + 24 * 3600 * 1000),
      priority: 60,
    });
  }
};

const competitorWatch: JobHandler = async (payload) => {
  const orgId = String(payload.orgId);
  const productId = payload.productId ? String(payload.productId) : null;
  const competitors = await prisma.competitor.findMany({
    where: { orgId, monitor: true, ...(productId ? { productId } : {}) },
  });
  if (!competitors.length) return;

  let eventsCreated = 0;
  for (const comp of competitors.slice(0, 5)) {
    const hits = await ADAPTERS.hackernews.discover(
      { keywords: [comp.name], communityNames: [], competitorNames: [comp.name], icpDescription: "" },
      { limit: 6 }
    );
    for (const hit of hits) {
      const text = `${hit.title}\n${hit.body}`.toLowerCase();
      // Guard against fuzzy adapter matches: the competitor name must actually
      // appear in the story, otherwise the event would misattribute it.
      if (!text.includes(comp.name.toLowerCase())) continue;
      const kind: CompetitorEventKind | null = /switch|switched|left|frustrat|hate|unhappy|cancel/.test(text)
        ? "COMPLAINT"
        : /pricing|price|cost|expensive|cheaper/.test(text)
          ? "PRICING"
          : /launch|shipped|released|announc/.test(text)
            ? "LAUNCH"
            : /review/.test(text)
              ? "REVIEW"
              : null;
      if (!kind) continue;
      const intent = classifyIntent(hit.title, hit.body);
      const existing = await prisma.competitorEvent.findFirst({
        where: { competitorId: comp.id, sourceUrl: hit.url },
      });
      if (existing) continue;
      const draft = analyzeEvent(kind, comp.name, hit.title);
      await prisma.competitorEvent.create({
        data: {
          competitorId: comp.id,
          orgId,
          kind,
          title: draft.title.slice(0, 300),
          detail: hit.body.slice(0, 1200) || hit.title,
          sourceUrl: hit.url,
          whatChanged: draft.whatChanged,
          whyItMatters: draft.whyItMatters,
          potentialResponse: draft.potentialResponse,
          severity: draft.severity,
          detectedAt: hit.postedAt,
        },
      });
      eventsCreated += 1;
      // Complaints also flow into the opportunity pipeline as competitor-dissatisfaction signal.
      if (kind === "COMPLAINT" && intent.intentType !== "PARTNERSHIP_OPPORTUNITY") {
        const communityIds = await communityMapFor(orgId, productId);
        await runPipeline([hit], {
          orgId,
          productId: productId ?? (await prisma.product.findFirst({ where: { orgId, isDefault: true } }))?.id ?? "",
          productName: comp.name ? "competitor-watch" : "competitor-watch",
          category: "competitor watch",
          icpName: "",
          keywords: [comp.name],
          problems: [],
          communityIds,
        }).catch(() => undefined);
      }
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  logger.info("competitor watch complete", { orgId, eventsCreated });
};

const digest: JobHandler = async (payload) => {
  const orgId = String(payload.orgId);
  const highIntent = await prisma.opportunity.count({
    where: { orgId, band: { in: ["HIGH", "VERY_HIGH"] }, status: "NEW" },
  });
  logger.info("daily digest", { orgId, highIntent });
};

// ─── Deep-research chain: FETCH_SITE → RESEARCH → AI_ANALYZE ─────────────────

/** Stage 1: scrape the product's real website into clean markdown → job.result. */
const fetchSite: JobHandler = async (payload, job) => {
  const orgId = String(payload.orgId);
  const productId = String(payload.productId);
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error("Product missing for fetch_site");

  const url = payload.url ? String(payload.url) : product.url;
  let result: Record<string, unknown>;
  if (!url) {
    result = { skipped: "product has no website URL" };
  } else if (!(await isPublicHttpUrl(url))) {
    result = { skipped: "URL is not a publicly reachable website (blocked for safety)" };
  } else {
    const scraped = await firecrawlScrape(url);
    result = {
      url: scraped.url,
      title: scraped.title,
      markdown: scraped.markdown,
      chars: scraped.markdown.length,
      capped: scraped.markdown.length >= MAX_MARKDOWN_CHARS,
      fetchedAt: new Date().toISOString(),
    };
    logger.info("fetch_site complete", { productId, chars: scraped.markdown.length });
  }

  await prisma.job.update({ where: { id: job.id }, data: { result: JSON.stringify(result) } });
  // Website content is optional evidence — continue the chain either way.
  await enqueueJob("RESEARCH", orgId, { orgId, productId, fetchJobId: job.id });
};

/** Stage 2: ~15 web searches (batches of 3 across web/Reddit/HN) → job.result. */
const research: JobHandler = async (payload, job) => {
  const orgId = String(payload.orgId);
  const productId = String(payload.productId);
  const product = await prisma.product.findUnique({ where: { id: productId }, include: { analysis: true } });
  if (!product?.analysis) throw new Error("Product or analysis missing for research");

  const confidence = jparse<{ icpName?: string }>(product.analysis.confidence, {});
  const competitors = (await prisma.competitor.findMany({ where: { orgId, productId } })).map((c) => c.name);

  const batches = buildResearchBatches({
    name: product.name,
    category: product.analysis.category,
    icpName: confidence.icpName ?? product.analysis.category,
    keywords: jparse<string[]>(product.analysis.keywords, []),
    problems: jparse<string[]>(product.analysis.problems, []),
    competitors,
  });
  const outcome = await runResearch(batches);

  // Self-hit & namesake suppression: a same-name hit is not automatically this
  // product. Own-domain hits are suppressed deterministically; brand-mentioning
  // hits get LLM adjudication and are only suppressed on HIGH confidence.
  const classified: ClassifiedHit[] = outcome.results.map((hit) =>
    isOwnSite(hit.url, product.url)
      ? { ...hit, suppressed: true, suppressionReason: "hit on the product's own domain" }
      : hit
  );
  const toAdjudicate = classified
    .map((hit, i) => ({ hit, i }))
    .filter(({ hit }) => !hit.suppressed && hitMentionsBrand(hit, product.name));
  const verdicts = await classifyResearchHits(
    { name: product.name, url: product.url, description: product.description, category: product.analysis.category },
    toAdjudicate.map(({ hit }) => hit)
  );
  if (verdicts) {
    for (const [subIdx, cls] of verdicts) {
      const { hit, i } = toAdjudicate[subIdx];
      if (shouldSuppress(cls)) {
        classified[i] = { ...hit, suppressed: true, suppressionReason: `${cls.kind.toLowerCase()}: ${cls.reason}` };
      }
    }
  }
  const suppressed = classified.filter((h) => h.suppressed);
  const feedHits = classified.filter((h): h is SearchHit => !h.suppressed);

  await prisma.job.update({
    where: { id: job.id },
    data: {
      result: JSON.stringify({
        queries: outcome.queries,
        failedQueries: outcome.failedQueries,
        count: outcome.results.length,
        results: classified,
        suppressedCount: suppressed.length,
        suppressedList: suppressed.slice(0, 20).map((h) => ({ url: h.url, title: h.title.slice(0, 120), reason: h.suppressionReason })),
        adjudicated: verdicts ? toAdjudicate.length : 0,
        searchedAt: new Date().toISOString(),
      }),
    },
  });
  logger.info("research complete", { productId, queries: outcome.queries.length, results: outcome.results.length, failed: outcome.failedQueries.length, suppressed: suppressed.length, adjudicated: verdicts ? toAdjudicate.length : 0 });

  // Real leads: research hits flow through the same opportunity pipeline as
  // discovery scans — scored, explained, deduped; LOW-band noise is dropped.
  const feedOutcome = await runPipeline(feedHits.map((hit) => searchHitToCandidate(hit)), {
    orgId,
    productId: product.id,
    productName: product.name,
    category: product.analysis.category,
    icpName: confidence.icpName ?? product.analysis.category,
    keywords: jparse<string[]>(product.analysis.keywords, []),
    problems: jparse<string[]>(product.analysis.problems, []),
    communityIds: await communityMapFor(orgId, product.id),
  });
  logger.info("research hits entered feed", { productId, scanned: feedOutcome.scanned, inserted: feedOutcome.inserted, veryHigh: feedOutcome.veryHigh });

  await enqueueJob("AI_ANALYZE", orgId, { orgId, productId, fetchJobId: payload.fetchJobId ?? null, researchJobId: job.id });
};

/** Stage 3: evidence-grounded LLM analysis → persisted over the baseline. */
const aiAnalyze: JobHandler = async (payload) => {
  const orgId = String(payload.orgId);
  const productId = String(payload.productId);

  const [fetchJob, researchJob] = await Promise.all([
    payload.fetchJobId ? prisma.job.findUnique({ where: { id: String(payload.fetchJobId) } }) : null,
    payload.researchJobId ? prisma.job.findUnique({ where: { id: String(payload.researchJobId) } }) : null,
  ]);
  const fetchResult = fetchJob?.result ? jparse<{ url?: string; markdown?: string; skipped?: string }>(fetchJob.result, {}) : {};
  const researchResult = researchJob?.result
    ? jparse<{ results?: { url: string; title: string; description: string; position: number; source: "reddit" | "hn" | "web"; suppressed?: boolean }[] }>(researchJob.result, {})
    : {};
  // Suppressed self-hits/namesakes never count as market evidence either.
  const evidenceHits = (researchResult.results ?? []).filter((r) => !r.suppressed);

  const intel = await deepAnalyzeProduct({
    orgId,
    productId,
    website: fetchResult.markdown && fetchResult.url ? { url: fetchResult.url, markdown: fetchResult.markdown } : null,
    research: evidenceHits.length ? { results: evidenceHits } : null,
  });

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error("Product missing for ai_analyze persist");
  await persistIntelligence(productId, orgId, intel, {
    name: product.name,
    url: product.url,
    description: product.description,
    targetCustomer: product.targetCustomer,
    industry: product.industry,
    geography: product.geography,
    budgetBand: product.budgetBand,
    timePerWeek: product.timePerWeek,
  });
  await meter(orgId, "AI_CREDIT", 5, { kind: "deep_research", productId });
  logger.info("deep analysis complete", { productId, model: intel.model, category: intel.category });
};

const HANDLERS: Record<JobType, JobHandler> = {
  DISCOVERY_SCAN: discoveryScan,
  COMPETITOR_WATCH: competitorWatch,
  AI_ENRICH: async () => undefined,
  DIGEST: digest,
  FETCH_SITE: fetchSite,
  RESEARCH: research,
  AI_ANALYZE: aiAnalyze,
};

// ─── Scheduler singleton ──────────────────────────────────────────────────────

const g = globalThis as unknown as { __dosScheduler?: NodeJS.Timeout };

export function startScheduler() {
  if (g.__dosScheduler) return;
  logger.info("background scheduler started");
  g.__dosScheduler = setInterval(async () => {
    try {
      await processDueJobs(HANDLERS);
      // Activate campaigns whose scheduled start time has arrived.
      const activated = await prisma.campaign.updateMany({
        where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
        data: { status: "ACTIVE", startedAt: new Date() },
      });
      if (activated.count > 0) logger.info("scheduled campaigns activated", { count: activated.count });
    } catch (err) {
      logger.error("scheduler tick failed", { err: err instanceof Error ? err.message : String(err) });
    }
  }, 15_000);
  // Do not keep the process alive just for the scheduler.
  g.__dosScheduler.unref?.();
}

export { HANDLERS };
