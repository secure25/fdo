/**
 * Firecrawl client — site scraping (clean markdown) and web search.
 *
 * Two transports, chosen automatically:
 *  - FIRECRAWL_API_KEY set  → hosted v2 REST API with Bearer auth (production).
 *  - no key                 → the official firecrawl-cli (free keyless tier,
 *    rate-limited per IP), installed via: npx -y firecrawl-cli@latest init --all --browser
 *    The CLI entry script is invoked directly with node (no shell) so arbitrary
 *    query strings are safe.
 */

// Bare builtin specifiers (not "node:" prefixed) — the instrumentation-hook
// compile pass externalizes unprefixed builtins only.
import { execFile } from "child_process";
import { existsSync } from "fs";
import { homedir, platform } from "os";
import { join } from "path";
import { env } from "../env";
import { logger } from "../logger";

const API_BASE = "https://api.firecrawl.dev";
const HTTP_TIMEOUT_MS = 60_000;
const CLI_TIMEOUT_MS = 90_000;
const MAX_MARKDOWN_CHARS = 12_000;

export type ScrapeResult = { url: string; title: string | null; markdown: string };

export type SearchHit = {
  url: string;
  title: string;
  description: string;
  position: number;
  source: "reddit" | "hn" | "web";
};

// ─── CLI transport (keyless) ──────────────────────────────────────────────────

let cliEntryCache: string | null | undefined;

/** Resolve the globally-installed firecrawl-cli dist entry. null if absent. */
function resolveCliEntry(): string | null {
  if (cliEntryCache !== undefined) return cliEntryCache;
  const rel = join("firecrawl-cli", "dist", "index.js");
  const candidates: string[] = [];
  if (env.firecrawl.cliPath) candidates.push(env.firecrawl.cliPath);
  if (platform() === "win32" && process.env.APPDATA) {
    candidates.push(join(process.env.APPDATA, "npm", "node_modules", rel));
  }
  candidates.push(
    join(homedir(), ".npm-global", "lib", "node_modules", rel),
    "/usr/local/lib/node_modules/" + rel,
    "/usr/lib/node_modules/" + rel,
    join(homedir(), ".npm", "global", "node_modules", rel),
  );
  cliEntryCache = candidates.find((c) => existsSync(c)) ?? null;
  if (!cliEntryCache) {
    logger.warn("firecrawl-cli not found — deep research will use it only when installed (npx -y firecrawl-cli@latest init)");
  }
  return cliEntryCache;
}

function cliCall(args: string[]): Promise<string> {
  const entry = resolveCliEntry();
  if (!entry) throw new Error("firecrawl-cli is not installed — run: npx -y firecrawl-cli@latest init --all --browser (or set FIRECRAWL_API_KEY)");
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [entry, ...args], { timeout: CLI_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 }, (err, stdout) => {
      if (err) {
        const msg = String((err as { message?: string }).message || err).slice(0, 300);
        reject(new Error(`firecrawl-cli failed: ${msg}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Scrape a page into clean markdown (scripts/styles/nav stripped server-side). */
export async function firecrawlScrape(url: string): Promise<ScrapeResult> {
  if (env.firecrawl.apiKey) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), HTTP_TIMEOUT_MS);
    try {
      const res = await fetch(`${API_BASE}/v2/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.firecrawl.apiKey}` },
        body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
        signal: ctrl.signal,
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean; error?: string;
        data?: { markdown?: string; metadata?: { title?: string } };
      };
      if (!res.ok || !json.success) throw new Error(`Firecrawl scrape ${res.status}: ${json.error ?? "failed"}`);
      const markdown = (json.data?.markdown ?? "").slice(0, MAX_MARKDOWN_CHARS);
      return { url, title: json.data?.metadata?.title ?? null, markdown };
    } finally {
      clearTimeout(timer);
    }
  }

  const out = await cliCall(["scrape", url, "--json"]);
  const parsed = JSON.parse(out) as { markdown?: string; metadata?: { title?: string; sourceURL?: string } };
  const markdown = (parsed.markdown ?? "").slice(0, MAX_MARKDOWN_CHARS);
  if (!markdown) throw new Error(`Firecrawl scrape returned no content for ${url}`);
  return { url: parsed.metadata?.sourceURL ?? url, title: parsed.metadata?.title ?? null, markdown };
}

/** Web search returning structured hits (url/title/description). */
export async function firecrawlSearch(query: string, limit = 6): Promise<SearchHit[]> {
  const map = (rows: { url?: string; title?: string; description?: string; position?: number }[]): SearchHit[] =>
    rows
      .filter((r) => r.url && r.title)
      .map((r, i) => ({
        url: String(r.url),
        title: String(r.title).slice(0, 300),
        description: String(r.description ?? "").slice(0, 500),
        position: r.position ?? i + 1,
        source: sourceOf(String(r.url)),
      }));

  if (env.firecrawl.apiKey) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), HTTP_TIMEOUT_MS);
    try {
      const res = await fetch(`${API_BASE}/v2/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.firecrawl.apiKey}` },
        body: JSON.stringify({ query, limit }),
        signal: ctrl.signal,
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean; error?: string; data?: { web?: { url?: string; title?: string; description?: string; position?: number }[] };
      };
      if (!res.ok || !json.success) throw new Error(`Firecrawl search ${res.status}: ${json.error ?? "failed"}`);
      return map(json.data?.web ?? []);
    } finally {
      clearTimeout(timer);
    }
  }

  const out = await cliCall(["search", query, "--limit", String(limit), "--json"]);
  const parsed = JSON.parse(out) as { data?: { web?: { url?: string; title?: string; description?: string; position?: number }[] } };
  return map(parsed.data?.web ?? []);
}

export function sourceOf(url: string): SearchHit["source"] {
  const lower = url.toLowerCase();
  if (lower.includes("reddit.com")) return "reddit";
  if (lower.includes("news.ycombinator.com")) return "hn";
  return "web";
}

export { MAX_MARKDOWN_CHARS };
