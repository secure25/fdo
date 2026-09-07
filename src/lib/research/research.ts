/**
 * Research stage — runs ~15 targeted web searches (batches of 3, each batch
 * mixing general web, Reddit and Hacker News) to ground the deep product
 * analysis in real market evidence. Results are deduplicated by URL.
 */

import { firecrawlSearch, type SearchHit } from "./firecrawl";
import type { RawCandidate } from "../discovery/adapters";

export type ResearchInput = {
  name: string;
  category: string;
  icpName: string;
  keywords: string[];
  problems: string[];
  competitors: string[];
};

const YEAR = new Date().getFullYear();

/**
 * 5 batches × 3 queries. Deliberately mixes:
 *  - general market queries (category, keywords, problems)
 *  - site:reddit.com queries (community voice, pain points)
 *  - site:news.ycombinator.com queries (technical buyer voice)
 *  - competitor queries (positioning + alternatives)
 */
export function buildResearchBatches(input: ResearchInput): string[][] {
  const kw = (input.keywords ?? []).filter(Boolean);
  const prob = (input.problems ?? []).filter(Boolean);
  const comp = (input.competitors ?? []).filter(Boolean);
  const k = (i: number) => kw[i % Math.max(1, kw.length)] ?? input.category;
  const p = (i: number) => prob[i % Math.max(1, prob.length)] ?? k(i);
  const c = (i: number) => comp[i % Math.max(1, comp.length)] ?? input.name;

  return [
    [
      `${input.category} ${k(0)} ${YEAR}`.replace(/\s+/g, " ").trim(),
      `site:reddit.com ${p(0)}`.trim(),
      `site:news.ycombinator.com ${input.name} OR ${k(1)}`.trim(),
    ],
    [
      `how to solve ${p(1)}`.replace(/\s+/g, " ").trim(),
      `site:reddit.com ${input.icpName} ${k(1)}`.replace(/\s+/g, " ").trim(),
      `${c(0)} pricing alternatives`.trim(),
    ],
    [
      `best ${input.category} tools ${YEAR}`.replace(/\s+/g, " ").trim(),
      `site:reddit.com ${input.name} alternative`.trim(),
      `site:news.ycombinator.com ${p(2)}`.trim(),
    ],
    [
      `${input.name} review customer feedback`.trim(),
      `site:reddit.com ${c(1)}`.trim(),
      `${input.category} pain points ${k(2)}`.replace(/\s+/g, " ").trim(),
    ],
    [
      `${c(2)} vs ${input.name}`.trim(),
      `site:news.ycombinator.com ${k(3)}`.trim(),
      `${p(0)} community forum discussion`.replace(/\s+/g, " ").trim(),
    ],
  ];
}

/** Normalize a URL for dedup: lowercase host, strip hash, tracking params, trailing slash. */
export function normalizeUrlForDedup(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    const tracking = [...u.searchParams.keys()].filter((k) => /^utm($|_)|^(fbclid|gclid|msclkid|ref)$/i.test(k));
    for (const k of tracking) u.searchParams.delete(k);
    const qs = u.searchParams.toString();
    return `${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, "")}${qs ? "?" + qs : ""}`;
  } catch {
    return url.toLowerCase();
  }
}

/** Dedupe by URL keeping the highest-ranked occurrence (lowest position). */
export function dedupeByUrl(hits: SearchHit[]): SearchHit[] {
  const byUrl = new Map<string, SearchHit>();
  for (const hit of hits) {
    const key = normalizeUrlForDedup(hit.url);
    const existing = byUrl.get(key);
    if (!existing || hit.position < existing.position) byUrl.set(key, hit);
  }
  return Array.from(byUrl.values()).sort((a, b) => a.position - b.position);
}

export type ResearchOutcome = {
  queries: string[];
  results: SearchHit[];
  failedQueries: string[];
};

/** Run batches of 3 concurrent searches; individual query failures don't kill the stage. */
export async function runResearch(batches: string[][], opts: { limit?: number; maxResults?: number } = {}): Promise<ResearchOutcome> {
  const limit = opts.limit ?? 6;
  const maxResults = opts.maxResults ?? 60;
  const queries = batches.flat();
  const collected: SearchHit[] = [];
  const failedQueries: string[] = [];

  for (const batch of batches) {
    const settled = await Promise.allSettled(batch.map((q) => firecrawlSearch(q, limit)));
    settled.forEach((r, i) => {
      if (r.status === "fulfilled") collected.push(...r.value);
      else failedQueries.push(batch[i]);
    });
  }

  return {
    queries,
    results: dedupeByUrl(collected).slice(0, maxResults),
    failedQueries,
  };
}

// ─── Research hits → opportunity feed ─────────────────────────────────────────

/**
 * Stable short hash (FNV-1a 32-bit + length) for research hit dedup.
 * Deliberately dependency-free so it stays usable from any bundle.
 */
export function researchExternalId(url: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) {
    h ^= url.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `r${(h >>> 0).toString(16).padStart(8, "0")}-${url.length.toString(36)}`;
}

/** Map a search hit to a discovery-pipeline candidate (adapter: "research"). */
export function searchHitToCandidate(hit: SearchHit, postedAt: Date = new Date()): RawCandidate {
  const platform = hit.source === "reddit" ? "REDDIT" : hit.source === "hn" ? "HACKERNEWS" : "WEB";
  let communityName: string | null = null;
  if (hit.source === "reddit") {
    const sub = hit.url.match(/reddit\.com\/r\/([^/]+)/i)?.[1];
    communityName = sub ? `r/${sub}` : null;
  } else if (hit.source === "hn") {
    communityName = "Hacker News";
  }
  return {
    adapter: "research",
    externalId: researchExternalId(normalizeUrlForDedup(hit.url)),
    platform,
    communityName,
    url: hit.url,
    title: hit.title,
    body: hit.description || hit.title,
    author: null,
    authorUrl: null,
    postedAt,
    replyCount: 0,
    vendorMentions: 0,
    upvotes: 0,
    isPartnerSignal: false,
  };
}
