import Link from "next/link";
import { Button, Badge, Card, SectionLabel } from "@/components/ui";
import { DiscoveryDemo, Faq, LoopDiagram } from "@/components/marketing";
import { PLANS, PLAN_ORDER } from "@/lib/entitlements";
import { fmtMoney } from "@/lib/utils";

const NAV = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Distribution intelligence", href: "#distribution" },
  { label: "Intent engine", href: "#intent" },
  { label: "Strategist", href: "#strategist" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

const EXAMPLES = [
  {
    name: "Atelier",
    category: "AI fashion technology",
    target: "Online fashion retailers",
    discovers: ["“Looking for an affordable virtual try-on solution for Shopify.”", "“Our clothing returns are killing margins.”", "“Anyone know an AI fashion try-on tool?”"],
    recommends: "Answers the thread genuinely, mentions the product only where contextually appropriate — and waits to pitch where intent is awareness-stage.",
  },
  {
    name: "Forge",
    category: "AI developer tooling",
    target: "AI startups & engineering teams",
    discovers: ["“How do we reproduce AI-generated code bugs?”", "“Looking for AI agent evaluation tools.”", "“How do we benchmark coding agents?”"],
    recommends: "Engages in HN threads with technical depth, drafts eval-comparison content, and flags the engineering leaders discussing agent reliability.",
  },
  {
    name: "InvoicePilot",
    category: "Accounting automation (unknown SaaS)",
    target: "Determined independently by the platform",
    discovers: ["“Does anyone know a tool for automating invoice capture for a small firm?”", "“Chasing clients for documents is eating my week.”", "“Is there an alternative to hiring a bookkeeper for data entry?”"],
    recommends: "With no input beyond a description, the platform derives the ICP (small accounting firms), buyer (Firm Partner), keywords, competitors and channel plan — then starts discovery.",
  },
];

const FAQ_ITEMS = [
  {
    q: "Is this another AI social-media scheduler?",
    a: "No. Schedulers publish content. Founder Distribution OS is built around a different loop: discover people already describing your customers' problem, score their intent, recommend the exact action, help you draft it for human review, and measure which channels actually produce customers. Publishing is one small part.",
  },
  {
    q: "Won't automated outreach get me banned?",
    a: "The platform is human-in-the-loop by design: DISCOVER → RECOMMEND → DRAFT → USER REVIEW → APPROVE → EXECUTE. Nothing is posted automatically. Every draft carries spam-risk scoring, community-rule warnings, duplicate detection and timing checks — and the system will explicitly tell you 'Don't pitch yet' when a thread is awareness-stage.",
  },
  {
    q: "Which sources does discovery cover?",
    a: "The engine uses modular source adapters — currently Hacker News (public API) and Reddit (public endpoints), with community watching across Discord, Slack, forums and marketplaces on the roadmap. Adapters respect platform APIs, rate limits and terms of service, and can be replaced or extended without touching the core engine.",
  },
  {
    q: "How is the match score calculated?",
    a: "Every opportunity is decomposed into six explainable sub-scores: ICP match, problem match, buying intent, recency, competition, and engagement potential. They combine through fixed, published weights — so you can always see why something scored 96 and not 72.",
  },
  {
    q: "What data does it use about people?",
    a: "Only publicly available information: public posts, public profiles, and public business signals. Prospect profiles clearly distinguish verified information from inference, and the platform is designed to respect privacy requirements.",
  },
  {
    q: "Do I need an AI API key?",
    a: "No. The platform ships with a complete deterministic intelligence engine — scoring, intent classification, drafting and the strategist all work offline. If you configure an OpenAI-compatible API key, the same engines gain LLM enrichment (richer drafts, streamed strategist answers) without changing the workflow.",
  },
  {
    q: "What counts as a 'qualified customer opportunity'?",
    a: "An opportunity scoring High or Very High intent: a real person, in your ICP, publicly describing the problem you solve with a detectable buying signal. That's the north-star metric everything else serves — eventually measured in customers acquired and revenue generated.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-paper">
      {/* ─── Nav ─── */}
      <header className="sticky top-0 z-40 bg-paper/90 backdrop-blur border-b border-paper-line">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-ink inline-flex items-center justify-center">
              <span className="w-2 h-2 rounded-sm bg-white" />
            </span>
            <span className="text-sm font-semibold tracking-tight">Founder Distribution OS</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="text-xs text-ink-mute hover:text-ink transition">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link href="/signup"><Button size="sm">Find My Customers</Button></Link>
          </div>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="map-grid border-b border-paper-line">
        <div className="max-w-6xl mx-auto px-6 pt-20 pb-16 grid lg:grid-cols-[1.05fr_0.95fr] gap-12 items-center">
          <div>
            <Badge tone="accent" className="mb-5">Distribution intelligence for founders</Badge>
            <h1 className="display text-[42px] leading-[1.06] sm:text-[54px] font-semibold tracking-tight text-ink">
              You built the product.
              <br />
              Now find the people
              <br />
              who need it.
            </h1>
            <p className="mt-6 text-[15px] leading-relaxed text-ink-mute max-w-xl">
              An AI-powered distribution operating system that discovers your customers, identifies buying
              signals, recommends where to engage, and learns which channels actually generate revenue.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/signup"><Button size="lg">Find My Customers</Button></Link>
              <a href="#how-it-works"><Button size="lg" variant="secondary">See How It Works</Button></a>
            </div>
            <div className="mt-10 grid grid-cols-4 gap-4 max-w-md">
              {[
                ["74", "opportunities discovered"],
                ["18", "high intent"],
                ["6", "urgent"],
                ["3", "partnership signals"],
              ].map(([n, l]) => (
                <div key={l}>
                  <div className="data-num text-2xl font-semibold">{n}</div>
                  <div className="text-2xs text-ink-faint mt-0.5 leading-tight">{l}</div>
                </div>
              ))}
            </div>
          </div>
          <DiscoveryDemo />
        </div>
      </section>

      {/* ─── Problem ─── */}
      <section className="border-b border-paper-line">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <SectionLabel>The problem</SectionLabel>
          <div className="mt-4 grid lg:grid-cols-2 gap-12">
            <h2 className="display text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
              AI made building easy.
              <br />
              Distribution didn&apos;t get easier.
            </h2>
            <div className="space-y-4 text-sm text-ink-mute leading-relaxed">
              <p>
                Thousands of founders can now build excellent products — then stall on questions that used to
                be a growth team&apos;s job:
              </p>
              <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
                {[
                  "Who actually needs my product?",
                  "Where are those people?",
                  "Who is actively looking for a solution?",
                  "Which channels should I prioritize?",
                  "What should I say?",
                  "Which activities produce customers?",
                ].map((q) => (
                  <li key={q} className="flex gap-2">
                    <span className="text-ink-faint">·</span> {q}
                  </li>
                ))}
              </ul>
              <p>
                Founder Distribution OS is the growth department a solo founder can&apos;t afford to hire — not
                another dashboard to manage.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section id="how-it-works" className="border-b border-paper-line bg-paper-raise">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <SectionLabel>How it works</SectionLabel>
          <h2 className="display text-3xl font-semibold tracking-tight mt-4 max-w-2xl">
            Discover customers → identify intent → recommend action → execute → measure → learn
          </h2>
          <div className="mt-6">
            <LoopDiagram />
          </div>
          <div className="mt-10 grid md:grid-cols-3 gap-4">
            {[
              ["1 · Product intelligence", "Enter your URL and description. The platform derives your ICP, buyer personas, competitors, keywords, buying triggers and objections — and shows which claims are verified vs inferred."],
              ["2 · Distribution discovery", "Source adapters continuously scan communities for questions, complaints, 'looking for…' posts, competitor dissatisfaction and buying signals. Nothing is platform-locked."],
              ["3 · Measured execution", "Draft replies and content for human review, track prospects and partnerships, run channel experiments, and watch which channel produces customers — not vanity metrics."],
            ].map(([t, d]) => (
              <Card key={t} className="p-5">
                <div className="text-sm font-semibold">{t}</div>
                <p className="text-[13px] text-ink-mute mt-2 leading-relaxed">{d}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Distribution intelligence ─── */}
      <section id="distribution" className="border-b border-paper-line">
        <div className="max-w-6xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <SectionLabel>Distribution intelligence</SectionLabel>
            <h2 className="display text-3xl font-semibold tracking-tight mt-4">A map of every channel that could work — scored for your product</h2>
            <p className="text-sm text-ink-mute mt-4 leading-relaxed">
              Communities, social, search, direct outreach, partnerships and marketplaces — each scored on ICP
              fit, intent density, competition and effort, with a recommended strategy. Know where to go deep
              before you spend a week anywhere.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {["Reddit", "LinkedIn", "Hacker News", "SEO", "Email outreach", "Agencies", "Product Hunt", "Shopify ecosystem", "Newsletters"].map((c) => (
                <Badge key={c}>{c}</Badge>
              ))}
            </div>
          </div>
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Reddit</div>
              <Badge tone="urgent">Opportunity: Very High</Badge>
            </div>
            <div className="mt-4 space-y-2.5">
              {[
                ["ICP Fit", 94],
                ["Intent", 91],
                ["Competition", 42],
              ].map(([l, v]) => (
                <div key={l as string} className="flex items-center gap-3">
                  <span className="w-24 text-xs text-ink-mute">{l}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-paper-sunken overflow-hidden">
                    <div className="h-full rounded-full bg-good" style={{ width: `${v}%` }} />
                  </div>
                  <span className="data-num text-xs w-8 text-right">{v}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-paper-line text-[13px] text-ink-soft leading-relaxed">
              <span className="font-mono text-2xs uppercase tracking-wider text-ink-faint block mb-1">Recommendation</span>
              “Prioritize. Your audience is actively discussing the problem.”
            </div>
          </Card>
        </div>
      </section>

      {/* ─── Intent engine ─── */}
      <section id="intent" className="border-b border-paper-line bg-paper-raise">
        <div className="max-w-6xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
          <Card className="p-5 order-2 lg:order-1">
            <div className="text-2xs font-mono uppercase tracking-wider text-ink-faint">High-intent opportunity</div>
            <div className="mt-3 flex items-start justify-between gap-4">
              <div className="text-sm font-semibold">“Looking for an affordable virtual try-on solution for Shopify.”</div>
              <div className="text-right shrink-0">
                <div className="data-num text-3xl font-semibold text-good">96<span className="text-sm text-ink-faint font-normal">/100</span></div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                ["ICP Match", 98], ["Problem Match", 97], ["Buying Intent", 94],
                ["Recency", 99], ["Competition", 31], ["Engagement", 89],
              ].map(([l, v]) => (
                <div key={l as string} className="rounded bg-paper-sunken px-2 py-2">
                  <div className="data-num text-sm font-semibold">{v}</div>
                  <div className="text-[10px] text-ink-faint mt-0.5">{l}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-paper-line">
              <div className="text-2xs font-mono uppercase tracking-wider text-ink-faint mb-1.5">Why this matters</div>
              <div className="space-y-1">
                {["Exact ICP", "Exact problem", "Active solution search", "Recent", "Strong purchase signal"].map((c) => (
                  <div key={c} className="text-xs text-good">✓ {c}</div>
                ))}
              </div>
            </div>
          </Card>
          <div className="order-1 lg:order-2">
            <SectionLabel>Intent engine</SectionLabel>
            <h2 className="display text-3xl font-semibold tracking-tight mt-4">Every opportunity is scored — and the score explains itself</h2>
            <p className="text-sm text-ink-mute mt-4 leading-relaxed">
              “Does anyone know a tool for…”, “I&apos;m looking for…”, “Is there an alternative to…”, “I wish
              there was…” — these aren&apos;t social posts, they&apos;re distribution opportunities. Each one is
              classified (problem awareness → active buying → partnership) with WHAT happened, WHY it matters,
              WHY it matches you, and WHAT to do next.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Customer intelligence ─── */}
      <section className="border-b border-paper-line">
        <div className="max-w-6xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <SectionLabel>Customer intelligence</SectionLabel>
            <h2 className="display text-3xl font-semibold tracking-tight mt-4">Prospect profiles built from public signals</h2>
            <p className="text-sm text-ink-mute mt-4 leading-relaxed">
              When someone in your ICP expresses the problem, the platform builds a profile: who they are, what
              they said, their ICP fit and buying intent — with verified information clearly separated from
              inference.
            </p>
          </div>
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Sarah Mitchell — Founder, Example Fashion</div>
                <div className="text-2xs text-ink-faint mt-0.5">via LinkedIn</div>
              </div>
              <div className="flex gap-2">
                <Badge tone="good">ICP 94</Badge>
                <Badge tone="accent">Intent 88</Badge>
              </div>
            </div>
            <div className="mt-4 text-2xs font-mono uppercase tracking-wider text-ink-faint">Signals</div>
            <div className="mt-1.5 space-y-1 text-xs text-ink-soft">
              <div>✓ Shopify store</div>
              <div>✓ 400 products</div>
              <div>✓ Recently launched collection</div>
              <div>✓ Publicly discussing conversion problems</div>
            </div>
            <div className="mt-4 pt-4 border-t border-paper-line text-[13px] text-ink-soft">
              <span className="font-mono text-2xs uppercase tracking-wider text-ink-faint block mb-1">Recommended approach</span>
              “Start with a personalized response to the problem rather than a generic sales pitch.”
            </div>
          </Card>
        </div>
      </section>

      {/* ─── AI strategist ─── */}
      <section id="strategist" className="border-b border-paper-line bg-paper-raise">
        <div className="max-w-6xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
          <Card className="p-5">
            <div className="space-y-3">
              <div className="flex justify-end">
                <div className="bg-ink text-white rounded-lg rounded-br-sm px-3.5 py-2 text-xs max-w-[80%]">Why isn&apos;t LinkedIn working?</div>
              </div>
              <div className="flex">
                <div className="bg-paper-sunken rounded-lg rounded-bl-sm px-3.5 py-2.5 text-xs leading-relaxed max-w-[92%]">
                  LinkedIn right now: 12,400 impressions → 92 visits → 14 signups → 1 customer.
                  <br /><br />
                  The problem isn&apos;t reach — it&apos;s resonance: click-through is below 1%, so the content
                  reads as generic to your ICP. Name the exact problem in their words (“returns are killing
                  margins”), not your category.
                  <br /><br />
                  Meanwhile Reddit is producing customers {`4.9×`} more efficiently. Rebalance this week.
                </div>
              </div>
              <div className="flex gap-2 pl-1">
                <Badge tone="accent">Open analytics</Badge>
                <Badge>Reddit vs LinkedIn experiment</Badge>
              </div>
            </div>
          </Card>
          <div>
            <SectionLabel>AI strategist</SectionLabel>
            <h2 className="display text-3xl font-semibold tracking-tight mt-4">Answers grounded in your actual data</h2>
            <p className="text-sm text-ink-mute mt-4 leading-relaxed">
              “What should I work on today?” “Find me 20 customers.” “Which channel should I stop using?” The
              strategist reads your live opportunities, prospects, funnels and experiments — and answers with
              specifics, not generic marketing advice.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Learning + ROI ─── */}
      <section className="border-b border-paper-line">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <SectionLabel>Learning engine + ROI analytics</SectionLabel>
          <h2 className="display text-3xl font-semibold tracking-tight mt-4 max-w-3xl">
            Learn what works, for whom, where — then measure it in customers, not impressions
          </h2>
          <div className="mt-8 grid md:grid-cols-2 gap-4">
            <Card className="p-5">
              <div className="text-sm font-semibold mb-3">The system learns</div>
              <div className="space-y-2 text-[13px] text-ink-soft">
                <div>Topic: <b>Return reduction</b></div>
                <div>Format: <b>Educational</b></div>
                <div>ICP: <b>Fashion ecommerce</b></div>
                <div>Channel: <b>LinkedIn</b></div>
                <div>Result: <Badge tone="good">High — 3 customers</Badge></div>
              </div>
              <p className="text-xs text-ink-mute mt-3 pt-3 border-t border-paper-line">→ Then it recommends more of exactly that.</p>
            </Card>
            <Card className="p-5">
              <div className="text-sm font-semibold mb-3">Reddit vs LinkedIn — funnel</div>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-2xs font-mono uppercase tracking-wider text-ink-faint">
                    <th className="text-left font-medium pb-2">Channel</th>
                    <th className="text-right font-medium pb-2">Visits</th>
                    <th className="text-right font-medium pb-2">Signups</th>
                    <th className="text-right font-medium pb-2">Customers</th>
                    <th className="text-right font-medium pb-2">MRR</th>
                  </tr>
                </thead>
                <tbody className="data-num">
                  <tr className="border-t border-paper-line">
                    <td className="py-2">Reddit</td><td className="text-right">27</td><td className="text-right">11</td><td className="text-right text-good font-semibold">4</td><td className="text-right">$396</td>
                  </tr>
                  <tr className="border-t border-paper-line">
                    <td className="py-2">LinkedIn</td><td className="text-right">92</td><td className="text-right">14</td><td className="text-right">1</td><td className="text-right">$99</td>
                  </tr>
                </tbody>
              </table>
              <p className="text-xs text-ink-mute mt-3 pt-3 border-t border-paper-line">“Reddit currently produces customers 4.9× more efficiently. Increase activity there.”</p>
            </Card>
          </div>
        </div>
      </section>

      {/* ─── Examples ─── */}
      <section className="border-b border-paper-line bg-paper-raise">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <SectionLabel>Examples</SectionLabel>
          <h2 className="display text-3xl font-semibold tracking-tight mt-4">Three products, same operating system</h2>
          <div className="mt-8 grid md:grid-cols-3 gap-4">
            {EXAMPLES.map((ex) => (
              <Card key={ex.name} className="p-5 flex flex-col">
                <div className="flex items-baseline justify-between">
                  <div className="text-sm font-semibold">{ex.name}</div>
                  <div className="text-2xs text-ink-faint">{ex.category}</div>
                </div>
                <div className="text-2xs text-ink-faint mt-0.5">Target: {ex.target}</div>
                <div className="mt-3 space-y-2 flex-1">
                  {ex.discovers.map((d) => (
                    <div key={d} className="text-xs text-ink-soft bg-paper-sunken rounded px-2.5 py-2">{d}</div>
                  ))}
                </div>
                <p className="text-xs text-ink-mute mt-3 leading-relaxed">{ex.recommends}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section id="pricing" className="border-b border-paper-line">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <SectionLabel>Pricing</SectionLabel>
          <h2 className="display text-3xl font-semibold tracking-tight mt-4">Start free. Scale when distribution compounds.</h2>
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PLAN_ORDER.map((id) => {
              const plan = PLANS[id];
              const featured = id === "GROWTH";
              return (
                <Card key={id} className={`p-5 flex flex-col ${featured ? "ring-2 ring-ink/80" : ""}`}>
                  {featured ? <Badge tone="neutral" className="self-start mb-2 bg-ink text-white">Most popular</Badge> : null}
                  <div className="text-sm font-semibold">{plan.name}</div>
                  <div className="data-num text-3xl font-semibold mt-2">
                    {plan.priceCents === 0 ? "$0" : fmtMoney(plan.priceCents)}
                    <span className="text-xs text-ink-faint font-normal">/mo</span>
                  </div>
                  <p className="text-2xs text-ink-mute mt-1.5 leading-relaxed">{plan.tagline}</p>
                  <ul className="mt-4 space-y-1.5 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="text-xs text-ink-soft flex gap-1.5"><span className="text-good">✓</span>{f}</li>
                    ))}
                  </ul>
                  <Link href="/signup" className="mt-5">
                    <Button variant={featured ? "primary" : "secondary"} className="w-full">{plan.cta}</Button>
                  </Link>
                </Card>
              );
            })}
          </div>
          <p className="text-xs text-ink-faint mt-4">
            Also supports usage-based credit packs for pay-as-you-go founders — $1 per 20 AI credits.
          </p>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="border-b border-paper-line">
        <div className="max-w-4xl mx-auto px-6 py-20">
          <SectionLabel>FAQ</SectionLabel>
          <h2 className="display text-3xl font-semibold tracking-tight mt-4 mb-6">Questions founders actually ask</h2>
          <Faq items={FAQ_ITEMS} />
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="bg-ink text-white">
        <div className="max-w-6xl mx-auto px-6 py-24 text-center">
          <h2 className="display text-3xl sm:text-5xl font-semibold tracking-tight leading-tight">
            You built something great.
            <br />
            Now go find the people who need it.
          </h2>
          <p className="text-sm text-white/70 mt-5 max-w-xl mx-auto leading-relaxed">
            Before: “I built something great, but nobody knows about it.”
            <br />
            After: “I know who needs my product, where they are, why they need it, and what I should do next.”
          </p>
          <div className="mt-9 flex justify-center gap-3">
            <Link href="/signup"><Button size="lg" className="bg-white text-ink hover:bg-white/90">Find My Customers</Button></Link>
            <Link href="/login"><Button size="lg" variant="ghost" className="text-white hover:bg-white/10">Sign in</Button></Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-ink text-white/60">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div>© 2026 Founder Distribution OS — the distribution OS for the new generation of software founders.</div>
          <div className="flex gap-5">
            <a href="#pricing" className="hover:text-white transition">Pricing</a>
            <a href="#faq" className="hover:text-white transition">FAQ</a>
            <Link href="/login" className="hover:text-white transition">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
