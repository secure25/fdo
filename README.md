# Founder Distribution OS

> **You built the product. Now find the people who need it.**

An AI-powered distribution operating system for indie hackers, SaaS founders, AI builders, developers, agencies and small teams. It discovers your customers, identifies buying signals, recommends where to engage, executes with human-in-the-loop review, and learns which channels actually generate revenue.

**DISCOVER CUSTOMERS → IDENTIFY INTENT → RECOMMEND ACTION → EXECUTE → MEASURE → LEARN**

---

## Quick start

```bash
npm install
npm run db:push      # create the SQLite database from the Prisma schema
npm run db:seed      # seed the demo workspace (Atelier)
npm run dev          # http://localhost:3000
```

Or all of it at once: `npm run setup && npm run dev`

**Demo login:** `demo@founderos.app` / `demo1234` (Growth-plan workspace for *Atelier*, an AI fashion technology product, pre-populated with opportunities, prospects, campaigns, experiments, competitor events, revenue and learning data).

Production build: `npm run build && npm start`

### Optional configuration

Copy `.env.example` to `.env`:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLite by default (`file:./dev.db`). The Prisma datasource block is the only change needed for Postgres. |
| `AUTH_SECRET` | Session cookie secret — set a strong random value in production. |
| `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL` | Any OpenAI-compatible endpoint (OpenAI, Groq, Z.AI, vLLM, llama.cpp…). **Optional** — without a key the platform runs on its deterministic built-in intelligence engine. Free testing: NVIDIA NIM (`https://integrate.api.nvidia.com/v1`, e.g. `nvidia/nemotron-3.5-lightning-30b-a3b`) — see `.env.example`; verify with `node scripts/ai-smoke.mjs`. |
| `PADDLE_API_KEY` / `PADDLE_WEBHOOK_SECRET` / `PADDLE_PRICE_*` / `PADDLE_ENV` | Optional. **Paddle Billing** — merchant-of-record checkout (global cards/PayPal/Apple Pay + tax handled), works from South Africa and most countries. Without it, plan changes activate instantly via built-in checkout (self-hosted mode). |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Optional Stripe alternative. Provider is auto-selected: Paddle if `PADDLE_API_KEY` is set, else Stripe, else manual checkout. |
| `FIRECRAWL_API_KEY` / `FIRECRAWL_CLI_PATH` | Optional. Deep-research pipeline (site scrape + web search). Keyless via the installed [firecrawl-cli](https://www.npmjs.com/package/firecrawl-cli) free tier by default; set a key for the hosted API. |

---

## What's inside

### The core loop

| Surface | What it does |
| --- | --- |
| **Overview** | The Founder Command Center: "What should I do today?" — a ranked, time-boxed daily plan plus Distribution Health with a plain-language diagnosis of the weakest area. |
| **Opportunities** | The central feed. Every discovered post is classified by intent (problem awareness → active buying → partnership), scored 0–100 with six explainable sub-scores, and answered with WHAT happened / WHY it matters / WHY it matches you / WHAT to do next. One-click AI drafts — always for human review. |
| **Customers** | Prospect intelligence built from public signals, with verified information explicitly separated from inference, staged pipeline (NEW → CONTACTED → … → CUSTOMER). |
| **Distribution** | Every acquisition channel (communities, social, search, direct, partnerships, directories/marketplaces) scored on ICP fit, intent density, competition, effort and expected conversion — plus a partnership engine ranking agencies, consultants, newsletters, affiliates and integrators with a recommended deal model. |
| **Campaigns** | Coordinated per-channel action checklists tied to opportunities and prospects. |
| **Experiments** | A/B channel tests with full funnel math (Opportunities → Visits → Signups → Activation → Customers → Revenue) and efficiency verdicts ("Reddit currently produces customers 4.9× more efficiently"). |
| **Analytics** | Channel funnels, conversion rates, MRR, channel-efficiency ranking — optimized for customers, not vanity metrics. |
| **Competitors** | Public competitor signals (pricing, features, launches, complaints) each answered with What changed / Why it matters / Potential response. |
| **Content** | Drafts with guardrails: spam-risk scoring, community-rule warnings, duplicate/marketing-speak detection, and an explicit **"Don't pitch yet"** state for awareness-stage threads. |
| **AI Strategist** | A conversational strategist grounded in your live data — "What should I work on today?", "Find me 20 customers", "Why isn't LinkedIn working?" — answering with specifics and actions, not generic advice. |

### Architecture

- **Next.js 14 (App Router) + TypeScript** — server components read through a service layer; mutations go through validated API routes (`zod`).
- **Prisma + SQLite** — 26 modular entities (users, organizations, products, product_analysis, icps, personas, channels, sources, communities, opportunities, opportunity_signals, prospects, companies, campaigns, campaign_actions, content, experiments, experiment_results, competitors, competitor_events, customers, conversions, revenue_events, learning_observations, learning_insights, recommendations, integrations, usage, subscriptions, jobs).
- **Modular source adapters** (`src/lib/discovery/`) — Hacker News (public Algolia API) and Reddit (public endpoints) run live; a sandbox source powers demo data. Adapters respect platform APIs, rate limits and ToS, and can be replaced without touching the engine.
- **Explainable scoring engine** (`src/lib/engines/scoring.ts`) — fixed weights over ICP match, problem match, buying intent, recency, competition, engagement potential. The flagship spec example scores exactly 96/100.
- **Deterministic-first AI** (`src/lib/ai/`, `src/lib/engines/`) — specialized analyst services (Product Analyst, Intent Analyst, Opportunity Scorer, Content Strategist, Outreach Writer, Competitor Analyst, Learning Analyst, Founder Strategist…). Every LLM call degrades gracefully to the deterministic engine, so the product is fully functional with zero API keys.
- **Background jobs** (`src/lib/jobs/`) — durable DB-backed queue with lease-based claiming, per-type leases, exponential backoff and dead-lettering; runs discovery scans, competitor watch, digests and the deep-research chain via `instrumentation.ts`. Swap for Redis/BullMQ on horizontal deployments without changing the job API.
- **Deep research pipeline** (`src/lib/research/`) — after onboarding, `FETCH_SITE` (scrapes the product URL into clean markdown via Firecrawl, SSRF-guarded) → `RESEARCH` (15 web searches in batches of 3 across web/Reddit/HN, deduped by URL, saved to the job record) → `AI_ANALYZE` (LLM analysis grounded in that real evidence, persisted over the baseline). Research hits also flow into the opportunity feed through the standard scoring pipeline — real market threads become actionable leads, with LOW-relevance noise filtered out and self-hits/namesakes suppressed conservatively: own-domain hits deterministically, brand-mentioning hits only when an LLM adjudicator is HIGHLY confident it's the same product or a same-name-different-company — uncertain verdicts stay in the feed (see `src/lib/research/self-hit.ts`). Live discovery scans renew themselves daily so leads keep arriving without manual triggers. The dashboard polls the chain and flips to "Deep research complete" when it lands; on any failure the baseline analysis simply stays. Works keyless via the firecrawl-cli free tier, or with `FIRECRAWL_API_KEY` for the hosted API.
- **Security & ops** — DB-backed sessions (httpOnly, SameSite=Lax cookies), bcrypt password hashing, same-origin enforcement on mutations, per-route token-bucket rate limiting, structured JSON logging, unified error envelope, security headers, `GET /api/health` probe.
- **Billing** — plan entitlements (Free $0 / Maker $15 / Growth $39 / Pro $99) enforced in services, AI-credit metering with pay-as-you-go packs, **Paddle Billing** (merchant of record — recommended for South Africa / global sellers) and Stripe Checkout with real HMAC-verified webhooks; simulated activation without keys.
- **Public API** — `GET /api/v1/opportunities` with scoped API keys (`sk-dos-…`, Pro plan, 60 req/min).
- **Content with visuals** — every draft supports an image: upload PNG/JPEG/WebP/GIF (magic-byte validated, served from `data/uploads` via a path-safe route) or generate an AI-designed 16:9 SVG banner from the draft's content (sanitized; works on the free NIM chat tier — raster image models aren't served there). Generate/upload/remove metered like every AI action.
- **Campaigns with scheduling** — create campaigns now or schedule a start (the background scheduler activates them automatically), add actions with due dates (overdue badges included), pause/resume/complete, and toggle action progress; plan limits enforced.
- **AI Strategist with tool use** — asking the strategist to "find new opportunities / scan for leads" kicks off the live discovery scan and deep-research chain from the chat, then streams a grounded answer with an action link; scoring, dedupe and quality filters run in the pipeline so new leads land in the feed automatically.

### Tests

```bash
npm test          # 54 tests across 5 suites
npm run typecheck
```

Covers: the scoring engine (including the spec's 96/100 example), intent classification for every canonical phrase, the product analyst's ability to independently profile an unknown SaaS (InvoicePilot), the distribution map, learning insights, experiment conclusions, ROI verdicts, rate limiting, entitlements and the content guardrails.

---

## Repository layout

```
prisma/            schema.prisma (26 models) · seed.ts (Atelier demo workspace)
scripts/           render-pages.mjs (headless full-page screenshots for visual review)
src/app/           landing page, auth, onboarding, /app/* (14 surfaces), /api/* routes
src/components/    design system (ui.tsx), SVG charts, page clients
src/lib/
  engines/         taxonomy · product-analyst · intent · scoring · distribution-map ·
                   prospect · content-engine · health · priorities · experiments ·
                   learning · roi · competitor · strategist
  discovery/       adapter interface · hackernews · reddit · sandbox · orchestrator
  jobs/            durable queue · handlers · scheduler
  services/        workspace · products · opportunities · dashboard · analytics · app-data ·
                   strategist-context
  auth/            sessions · passwords · guards        ai/    OpenAI-compatible provider
```
