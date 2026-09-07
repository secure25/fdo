"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, BandBadge, Button, Card, EmptyState, Modal, ScoreNum, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { ExternalLink, Save, X, Sparkles, Copy, Check, AlertTriangle, MessageSquare, Handshake } from "lucide-react";

export type FeedOpportunity = {
  id: string;
  platform: string;
  community: string | null;
  title: string;
  body: string;
  author: string | null;
  authorUrl: string | null;
  url: string | null;
  postedAt: string;
  ageHours: number;
  score: number;
  band: string;
  intentType: string;
  effortMinutes: number;
  status: string;
  explanation: { what: string; whyMatters: string[]; whyYou: string[]; nextAction: string; caution?: string };
  matchedPhrases: string[];
  subs: { icp: number; problem: number; intent: number; recency: number; competition: number; engagement: number };
  isLive: boolean;
  competitorName: string | null;
  isPartnerSignal: boolean;
  signals: { kind: string; phrase: string; weight: number }[];
};

type Draft = { contentId: string; title: string; body: string; spamRisk: number; warnings: { level: string; code: string; message: string }[]; model: string };

const INTENT_LABEL: Record<string, string> = {
  PROBLEM_AWARENESS: "Problem awareness",
  SOLUTION_RESEARCH: "Solution research",
  VENDOR_COMPARISON: "Vendor comparison",
  ACTIVE_BUYING: "Active buying",
  COMPETITOR_DISSATISFACTION: "Competitor dissatisfaction",
  RECOMMENDATION_REQUEST: "Recommendation request",
  URGENT_NEED: "Urgent need",
  PARTNERSHIP_OPPORTUNITY: "Partnership",
};

const AWARENESS_INTENTS = ["PROBLEM_AWARENESS", "SOLUTION_RESEARCH"];

/** Deterministic age label from the stored ageHours (no client/server clock drift). */
function ageLabel(o: { ageHours: number }): string {
  const h = Math.max(1, Math.round(o.ageHours));
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function OpportunityFeed({
  initial,
  status,
  plan,
}: {
  initial: FeedOpportunity[];
  status: string;
  plan: { live: boolean; surfaced: number };
}) {
  const [items, setItems] = useState(initial);
  const [selected, setSelected] = useState<FeedOpportunity | null>(initial[0] ?? null);
  const [bandFilter, setBandFilter] = useState<string>("ALL");
  const [intentFilter, setIntentFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>(status);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return items.filter((o) => {
      if (bandFilter === "HIGH+" && !["HIGH", "VERY_HIGH"].includes(o.band)) return false;
      if (bandFilter === "VERY_HIGH" && o.band !== "VERY_HIGH") return false;
      if (intentFilter !== "ALL" && o.intentType !== intentFilter) return false;
      if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
      if (query && !`${o.title} ${o.body}`.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [items, bandFilter, intentFilter, statusFilter, query]);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/feed", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setItems(data.data ?? []);
    }
  }, []);

  async function act(opp: FeedOpportunity, nextStatus: string) {
    setItems((prev) => prev.map((o) => (o.id === opp.id ? { ...o, status: nextStatus } : o)));
    await fetch(`/api/opportunities/${opp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    }).catch(() => undefined);
  }

  async function generateDraft(opp: FeedOpportunity) {
    setDraftLoading(true);
    setDraft(null);
    try {
      const res = await fetch(`/api/opportunities/${opp.id}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) setDraft(data);
    } finally {
      setDraftLoading(false);
    }
  }

  async function runScan(live: boolean) {
    setScanning(true);
    setScanMsg(null);
    try {
      const res = await fetch("/api/discovery/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ live }),
      });
      const data = await res.json();
      if (data.queued) setScanMsg("Live scan queued — new opportunities will appear within a minute.");
      else setScanMsg(`Scan complete: ${data.inserted ?? 0} new opportunities from ${data.scanned ?? 0} posts.`);
      await refresh();
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Feed list */}
      <div className="w-full lg:w-[46%] xl:w-[42%] border-r border-paper-line overflow-y-auto">
        <div className="sticky top-0 z-10 bg-paper/95 backdrop-blur border-b border-paper-line px-4 py-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="text-base font-semibold tracking-tight">Opportunities</h1>
              <p className="text-2xs text-ink-faint">{filtered.length} shown · plan surfaces {plan.surfaced}/scan · {plan.live ? "live sources on" : "sandbox only"}</p>
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => runScan(false)} disabled={scanning}>{scanning ? "Scanning…" : "Run scan"}</Button>
              {plan.live ? <Button size="sm" onClick={() => runScan(true)} disabled={scanning}>Live scan</Button> : null}
            </div>
          </div>
          {scanMsg ? <div className="text-2xs text-accent bg-accent-soft rounded px-2.5 py-1.5">{scanMsg}</div> : null}
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="h-7 flex-1 min-w-[120px] rounded-md border border-paper-line bg-paper-raise px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent/25"
            />
            <select value={bandFilter} onChange={(e) => setBandFilter(e.target.value)} className="h-7 rounded-md border border-paper-line bg-paper-raise px-2 text-xs focus:outline-none">
              <option value="ALL">All scores</option>
              <option value="HIGH+">High + Very High</option>
              <option value="VERY_HIGH">Very High only</option>
            </select>
            <select value={intentFilter} onChange={(e) => setIntentFilter(e.target.value)} className="h-7 rounded-md border border-paper-line bg-paper-raise px-2 text-xs max-w-[150px] focus:outline-none">
              <option value="ALL">All intents</option>
              {Object.entries(INTENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-7 rounded-md border border-paper-line bg-paper-raise px-2 text-xs focus:outline-none">
              <option value="ALL">All statuses</option>
              <option value="NEW">New</option>
              <option value="SAVED">Saved</option>
              <option value="ACTED">Acted</option>
              <option value="DISMISSED">Dismissed</option>
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="No opportunities match" body="Adjust the filters or run a discovery scan to pull the latest public signals." />
        ) : (
          <div className="divide-y divide-paper-line/70">
            {filtered.map((o) => (
              <button
                key={o.id}
                onClick={() => { setSelected(o); setDraft(null); }}
                className={cn(
                  "w-full text-left px-4 py-3.5 hover:bg-paper-sunken/50 transition",
                  selected?.id === o.id && "bg-paper-sunken"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-2xs font-mono uppercase tracking-wider text-ink-faint">
                      {o.isPartnerSignal ? <Handshake size={10} className="text-accent" /> : null}
                      {o.community ?? o.platform} · {ageLabel(o)}
                      {!o.isLive ? <Badge tone="neutral" className="ml-1">demo</Badge> : null}
                    </div>
                    <div className="text-[13px] font-medium text-ink mt-1 line-clamp-2 leading-snug">{o.title}</div>
                    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                      <Badge tone={o.band === "VERY_HIGH" ? "urgent" : o.band === "HIGH" ? "good" : o.band === "MEDIUM" ? "warn" : "neutral"}>
                        {INTENT_LABEL[o.intentType] ?? o.intentType}
                      </Badge>
                      {AWARENESS_INTENTS.includes(o.intentType) ? <Badge tone="warn">Don't pitch yet</Badge> : null}
                      {o.competitorName ? <Badge tone="warn">{o.competitorName}</Badge> : null}
                      {o.status !== "NEW" ? <Badge tone="neutral">{o.status.toLowerCase()}</Badge> : null}
                    </div>
                  </div>
                  <ScoreNum score={o.score} className="text-xl shrink-0" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail panel */}
      <div className="hidden lg:block flex-1 overflow-y-auto">
        {selected ? (
          <OpportunityDetail
            key={selected.id}
            opp={selected}
            draft={draft}
            draftLoading={draftLoading}
            copied={copied}
            setCopied={setCopied}
            onDraft={() => generateDraft(selected)}
            onStatus={(s) => act(selected, s)}
          />
        ) : (
          <EmptyState title="Select an opportunity" body="Pick a conversation from the feed to see the full breakdown and recommended action." />
        )}
      </div>

      {/* Mobile detail modal */}
      {selected ? (
        <div className="lg:hidden">
          <Modal open={Boolean(selected && !("detailClosed" in selected))} onClose={() => setSelected(null)} title="Opportunity" wide>
            <OpportunityDetail
              opp={selected}
              draft={draft}
              draftLoading={draftLoading}
              copied={copied}
              setCopied={setCopied}
              onDraft={() => generateDraft(selected)}
              onStatus={(s) => act(selected, s)}
              inModal
            />
          </Modal>
        </div>
      ) : null}
    </div>
  );
}

function OpportunityDetail({
  opp,
  draft,
  draftLoading,
  copied,
  setCopied,
  onDraft,
  onStatus,
  inModal,
}: {
  opp: FeedOpportunity;
  draft: Draft | null;
  draftLoading: boolean;
  copied: boolean;
  setCopied: (b: boolean) => void;
  onDraft: () => void;
  onStatus: (s: string) => void;
  inModal?: boolean;
}) {
  const e = opp.explanation;
  const dontPitch = AWARENESS_INTENTS.includes(opp.intentType) || Boolean(e.caution?.toUpperCase().includes("DON'T PITCH"));
  return (
    <div className={cn("p-5 space-y-5", inModal && "p-0")}>
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-2xs font-mono uppercase tracking-wider text-ink-faint">
          <MessageSquare size={11} />
          {opp.community ?? opp.platform} · {ageLabel(opp)}
          {opp.author ? <> · {opp.author}</> : null}
        </div>
        <h2 className="text-lg font-semibold tracking-tight mt-2 leading-snug">“{opp.title}”</h2>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <Badge tone={opp.band === "VERY_HIGH" ? "urgent" : opp.band === "HIGH" ? "good" : "warn"}>
            {opp.band === "VERY_HIGH" ? "Very high intent" : opp.band === "HIGH" ? "High intent" : "Match"}
          </Badge>
          <Badge tone="neutral">{INTENT_LABEL[opp.intentType] ?? opp.intentType}</Badge>
          <Badge tone="neutral">Effort: {opp.effortMinutes} min</Badge>
          <Badge tone="neutral">Potential: {opp.band === "VERY_HIGH" ? "Very High" : opp.band === "HIGH" ? "High" : "Medium"}</Badge>
        </div>
      </div>

      {/* Body */}
      <Card className="p-4">
        <p className="text-[13px] text-ink-soft leading-relaxed whitespace-pre-line line-clamp-[12]">{opp.body}</p>
        <div className="mt-3 flex items-center gap-3 pt-3 border-t border-paper-line/70">
          {opp.url ? (
            <a href={opp.url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline inline-flex items-center gap-1">
              View conversation <ExternalLink size={11} />
            </a>
          ) : null}
          {opp.authorUrl ? (
            <a href={opp.authorUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline inline-flex items-center gap-1">
              Author profile <ExternalLink size={11} />
            </a>
          ) : null}
        </div>
      </Card>

      {/* Score breakdown */}
      <div>
        <div className="text-2xs font-mono uppercase tracking-wider text-ink-faint mb-2">Match breakdown — {opp.score}/100</div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            ["ICP", opp.subs.icp], ["Problem", opp.subs.problem], ["Intent", opp.subs.intent],
            ["Recency", opp.subs.recency], ["Comp.", opp.subs.competition], ["Engag.", opp.subs.engagement],
          ].map(([l, v]) => (
            <div key={l as string} className="rounded-md bg-paper-sunken px-2 py-2 text-center">
              <div className="data-num text-sm font-semibold">{v}</div>
              <div className="text-[10px] text-ink-faint mt-0.5">{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Explanation */}
      <div className="space-y-3">
        <div>
          <div className="text-2xs font-mono uppercase tracking-wider text-ink-faint mb-1">What happened</div>
          <p className="text-[13px] text-ink-soft leading-relaxed">{e.what}</p>
        </div>
        <div>
          <div className="text-2xs font-mono uppercase tracking-wider text-ink-faint mb-1">Why it matters</div>
          <div className="space-y-1">
            {e.whyMatters.map((w) => <div key={w} className="text-xs text-ink-soft">✓ {w}</div>)}
          </div>
        </div>
        <div>
          <div className="text-2xs font-mono uppercase tracking-wider text-ink-faint mb-1">Why it matches you</div>
          <div className="space-y-1">
            {e.whyYou.map((w) => <div key={w} className="text-xs text-ink-soft">✓ {w}</div>)}
          </div>
        </div>
        {opp.signals.length > 0 ? (
          <div>
            <div className="text-2xs font-mono uppercase tracking-wider text-ink-faint mb-1">Detected signals</div>
            <div className="flex flex-wrap gap-1.5">
              {Array.from(new Map(opp.signals.map((s) => [`${s.kind}|${s.phrase}`, s])).values()).map((s, i) => (
                <Badge key={i} tone={s.kind === "INTENT_PHRASE" ? "good" : s.kind === "COMPETITOR_MENTION" ? "warn" : "neutral"}>“{s.phrase.slice(0, 48)}”</Badge>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Recommended action */}
      <Card className={cn("p-4", dontPitch && "border border-warn/40")}>
        <div className="text-2xs font-mono uppercase tracking-wider text-ink-faint mb-1.5">Recommended action</div>
        <p className="text-[13px] text-ink font-medium leading-relaxed">{e.nextAction}</p>
        {dontPitch ? (
          <div className="mt-2.5 flex gap-2 rounded-md bg-warn-soft px-3 py-2">
            <AlertTriangle size={14} className="text-warn shrink-0 mt-0.5" />
            <p className="text-xs text-ink-soft leading-relaxed">
              {e.caution && e.caution.toUpperCase().includes("DON'T PITCH")
                ? e.caution
                : "Don't pitch yet. This thread is awareness-stage — the author hasn't asked for solutions. Help first; the platform will surface them again when buying intent appears."}
            </p>
          </div>
        ) : e.caution ? (
          <div className="mt-2.5 flex gap-2 rounded-md bg-warn-soft px-3 py-2">
            <AlertTriangle size={14} className="text-warn shrink-0 mt-0.5" />
            <p className="text-xs text-ink-soft leading-relaxed">{e.caution}</p>
          </div>
        ) : null}
      </Card>

      {/* Draft */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-2xs font-mono uppercase tracking-wider text-ink-faint">AI draft — for your review</div>
          {draft ? <Badge tone={draft.spamRisk > 30 ? "warn" : "good"}>spam risk {draft.spamRisk}/100 · {draft.model}</Badge> : null}
        </div>
        {draft ? (
          <div className="space-y-3">
            {draft.warnings.map((w, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-2 rounded-md px-3 py-2.5",
                  w.level === "BLOCK" ? "bg-bad-soft" : w.level === "WARN" ? "bg-warn-soft" : "bg-paper-sunken"
                )}
              >
                <AlertTriangle size={14} className={cn("shrink-0 mt-0.5", w.level === "BLOCK" ? "text-bad" : "text-warn")} />
                <p className="text-xs text-ink-soft leading-relaxed">{w.message}</p>
              </div>
            ))}
            <Card className="p-4">
              <div className="text-xs font-medium mb-2">{draft.title}</div>
              <Textarea readOnly rows={10} value={draft.body} className="text-[13px] bg-transparent border-0 px-0 focus:ring-0" />
            </Card>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  navigator.clipboard.writeText(draft.body).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1600);
                  });
                }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy draft"}
              </Button>
              <Button size="sm" onClick={() => onStatus("ACTED")}>Mark as acted</Button>
              {opp.url ? (
                <a href={opp.url} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="ghost">Open thread to post <ExternalLink size={11} /></Button>
                </a>
              ) : null}
            </div>
          </div>
        ) : (
          <Button onClick={onDraft} disabled={draftLoading}>
            <Sparkles size={13} /> {draftLoading ? "Generating…" : "Generate response"}
          </Button>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 pb-6">
        <Button size="sm" variant="secondary" onClick={() => onStatus("SAVED")}>
          <Save size={12} /> Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onStatus("DISMISSED")}>
          <X size={12} /> Dismiss
        </Button>
        {opp.status !== "NEW" ? <Badge tone="neutral" className="ml-1">status: {opp.status.toLowerCase()}</Badge> : null}
      </div>
    </div>
  );
}
