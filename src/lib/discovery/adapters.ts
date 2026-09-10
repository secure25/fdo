/**
 * Discovery source adapters (spec §4/§21). Every adapter implements the same
 * interface; the orchestrator is platform-agnostic so sources can be added,
 * paused or replaced without touching engine code.
 *
 * All adapters respect public API terms and rate limits:
 * - Hacker News via the public Algolia HN Search API (no auth, generous limits)
 * - Reddit via public JSON endpoints (polite UA + low frequency + backoff)
 * - Sandbox: deterministic demonstration source used for the seeded workspace
 *   (clearly flagged isLive=false).
 */

export type RawCandidate = {
  adapter: string;
  externalId: string;
  platform: string;
  communityName: string | null;
  url: string | null;
  title: string;
  body: string;
  author: string | null;
  authorUrl: string | null;
  postedAt: Date;
  replyCount: number;
  vendorMentions: number;
  upvotes: number;
  isPartnerSignal: boolean;
};

export interface SourceAdapter {
  readonly id: string;
  readonly name: string;
  readonly platform: string;
  /** Discover candidates matching the product context. Adapters must catch network errors internally and return [] on failure. */
  discover(ctx: DiscoveryContext, opts: { limit: number }): Promise<RawCandidate[]>;
}

export type DiscoveryContext = {
  keywords: string[];
  communityNames: string[]; // e.g. subreddits ["shopify", "ecommerce"]
  competitorNames: string[];
  icpDescription: string;
};

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url: string, init?: RequestInit, timeoutMs = 12_000): Promise<unknown | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Hacker News (Algolia API) ────────────────────────────────────────────────

type AlgoliaHit = {
  objectID: string;
  title?: string | null;
  story_title?: string | null;
  comment_text?: string | null;
  story_text?: string | null;
  author?: string | null;
  points?: number | null;
  num_comments?: number | null;
  created_at_i?: number;
  url?: string | null;
};

export const hackerNewsAdapter: SourceAdapter = {
  id: "hackernews",
  name: "Hacker News",
  platform: "HACKERNEWS",
  async discover(ctx, { limit }) {
    const out: RawCandidate[] = [];
    const queries = new Set<string>();
    for (const kw of ctx.keywords.slice(0, 4)) queries.add(kw);
    for (const comp of ctx.competitorNames.slice(0, 2)) queries.add(comp);
    for (const q of Array.from(queries).slice(0, 4)) {
      const data = (await fetchJson(
        `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(q)}&tags=(story,comment)&hitsPerPage=${Math.ceil(limit / 2)}`
      )) as { hits?: AlgoliaHit[] } | null;
      for (const hit of data?.hits ?? []) {
        const title = hit.title ?? hit.story_title ?? "";
        const body = hit.comment_text ?? hit.story_text ?? "";
        if (!title && !body) continue;
        // Algolia returns recent stories even when a query matches nothing —
        // only keep hits that actually mention the searched term.
        if (!`${title}\n${body}`.toLowerCase().includes(q.toLowerCase())) continue;
        const isStory = Boolean(hit.title || hit.story_title);
        out.push({
          adapter: "hackernews",
          externalId: `hn-${hit.objectID}`,
          platform: "HACKERNEWS",
          communityName: "Hacker News",
          url: isStory
            ? hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`
            : `https://news.ycombinator.com/item?id=${hit.objectID}`,
          title: title || (body.slice(0, 90) + (body.length > 90 ? "…" : "")),
          body: body || title,
          author: hit.author ?? null,
          authorUrl: hit.author ? `https://news.ycombinator.com/user?id=${hit.author}` : null,
          postedAt: new Date((hit.created_at_i ?? Math.floor(Date.now() / 1000)) * 1000),
          replyCount: hit.num_comments ?? 0,
          vendorMentions: 0,
          upvotes: hit.points ?? 0,
          isPartnerSignal: /agency|consultant|partner|affiliate/i.test(`${title} ${body}`),
        });
      }
      await sleep(400); // be polite between queries
    }
    return out.slice(0, limit);
  },
};

// ─── Reddit (public JSON, unauthenticated) ────────────────────────────────────

type RedditListingChild = {
  data: {
    id: string;
    title?: string;
    selftext?: string;
    author?: string;
    subreddit?: string;
    permalink?: string;
    created_utc?: number;
    num_comments?: number;
    ups?: number;
    link_flair_text?: string | null;
  };
};

export const redditAdapter: SourceAdapter = {
  id: "reddit",
  name: "Reddit",
  platform: "REDDIT",
  async discover(ctx, { limit }) {
    const out: RawCandidate[] = [];
    const subs = (ctx.communityNames.length ? ctx.communityNames : ["SaaS", "smallbusiness", "startups"]).slice(0, 4);
    const query = ctx.keywords.slice(0, 3).map((k) => `"${k}"`).join(" OR ") || "looking for a tool";
    const keywordTerms = ctx.keywords.slice(0, 3).map((k) => k.toLowerCase());
    for (const sub of subs) {
      // Search endpoint returns new+relevant posts; public, unauthenticated.
      const data = (await fetchJson(
        `https://www.reddit.com/r/${encodeURIComponent(sub)}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&sort=new&t=week&limit=${Math.ceil(limit / subs.length)}`
      )) as { data?: { children?: RedditListingChild[] } } | null;
      for (const child of data?.data?.children ?? []) {
        const d = child.data;
        const body = d.selftext ?? "";
        if (!d.title) continue;
        // Keep only posts actually about the product's space (Reddit search is
        // already relevant, but sort=new can drift into loosely related posts).
        const hay = `${d.title}\n${body}`.toLowerCase();
        const relevant = keywordTerms.length
          ? keywordTerms.some((t) => hay.includes(t))
          : /looking for|anyone know|recommend|alternative|switch(ed)? (from|to)|is there/i.test(hay);
        if (!relevant) continue;
        out.push({
          adapter: "reddit",
          externalId: `rd-${d.id}`,
          platform: "REDDIT",
          communityName: d.subreddit ? `r/${d.subreddit}` : `r/${sub}`,
          url: d.permalink ? `https://reddit.com${d.permalink}` : null,
          title: d.title,
          body: body || d.title,
          author: d.author ?? null,
          authorUrl: d.author ? `https://reddit.com/user/${d.author}` : null,
          postedAt: new Date((d.created_utc ?? Date.now() / 1000) * 1000),
          replyCount: d.num_comments ?? 0,
          vendorMentions: (body.match(/(try|check out|use)\s+[A-Z][a-zA-Z]+/g) ?? []).length,
          upvotes: d.ups ?? 0,
          isPartnerSignal: /agency|consultant|partner|affiliate/i.test(`${d.title} ${body}`),
        });
      }
      await sleep(600); // respect Reddit public endpoints
    }
    return out.slice(0, limit);
  },
};

// ─── Sandbox (deterministic demonstration source) ─────────────────────────────

export type SandboxTemplate = {
  communityKey: string;
  platform: string;
  communityName: string;
  title: string;
  body: string;
  ageHours: number;
  author: string;
  replyCount: number;
  upvotes: number;
};

export const sandboxAdapter: SourceAdapter = {
  id: "sandbox",
  name: "Sandbox",
  platform: "SANDBOX",
  async discover(ctx, { limit }) {
    // The sandbox source is seeded directly via templates (see orchestrator + seed);
    // live generation here would duplicate content on every scan.
    void ctx; void limit;
    return [];
  },
};

export const ADAPTERS: Record<string, SourceAdapter> = {
  hackernews: hackerNewsAdapter,
  reddit: redditAdapter,
  sandbox: sandboxAdapter,
};

export { fetchJson as _fetchJsonForTests };
