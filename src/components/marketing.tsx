"use client";

import { useEffect, useState } from "react";
import { Badge, BandBadge, Button, ScoreNum } from "@/components/ui";
import { cn } from "@/lib/utils";

// ─── Hero live-discovery demo ─────────────────────────────────────────────────

const DEMO_FEED = [
  { community: "r/shopify", platform: "Reddit", ago: "3 hours ago", title: "Looking for an affordable virtual try-on solution for Shopify.", score: 96, band: "VERY_HIGH", checks: ["Exact ICP", "Exact problem", "Active solution search", "Recent", "Strong purchase signal"], action: "Answer genuinely. Mention product only where contextually appropriate.", effort: "7 min", potential: "Very High" },
  { community: "LinkedIn", platform: "LinkedIn", ago: "12 hours ago", title: "Fashion ecommerce founder discussing high return rates.", score: 94, band: "VERY_HIGH", checks: ["Exact ICP", "Return-rate problem", "Public struggle", "Engaged audience"], action: "Engage with an educational comment. Do not pitch yet.", effort: "6 min", potential: "Very High" },
  { community: "r/ecommerce", platform: "Reddit", ago: "9 hours ago", title: "Is there an alternative to Botika for AI fashion models?", score: 91, band: "VERY_HIGH", checks: ["Competitor dissatisfaction", "Comparing options", "In-market now"], action: "Share an honest comparison. Disclose affiliation.", effort: "8 min", potential: "Very High" },
  { community: "Online Geniuses", platform: "Slack", ago: "30 hours ago", title: "Agency owner looking for a try-on tool partner for 20+ fashion clients.", score: 87, band: "HIGH", checks: ["Partnership signal", "Many customers per win"], action: "Reach out privately with a referral structure.", effort: "15 min", potential: "High" },
  { community: "r/fashionbusiness", platform: "Reddit", ago: "6 hours ago", title: "URGENT: need on-model images for 40 pieces by Friday.", score: 95, band: "VERY_HIGH", checks: ["Urgent need", "Budget confirmed", "Exact use case"], action: "Reply fast with the shortest path to unblocked.", effort: "6 min", potential: "Very High" },
];

export function DiscoveryDemo() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % DEMO_FEED.length), 4200);
    return () => clearInterval(t);
  }, [paused]);
  const item = DEMO_FEED[idx]!;
  return (
    <div className="relative" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="absolute -inset-1 rounded-xl bg-gradient-to-b from-paper-sunken to-transparent -z-10" />
      <div className="flex items-center justify-between px-4 pt-3">
        <div className="flex items-center gap-2 text-2xs font-mono uppercase tracking-[0.14em] text-ink-faint">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-good animate-pulse-soft" />
          Live discovery — {item.platform}
        </div>
        <div className="flex gap-1">
          {DEMO_FEED.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)} aria-label={`Demo ${i + 1}`} className={cn("w-1.5 h-1.5 rounded-full transition", i === idx ? "bg-ink" : "bg-paper-line")} />
          ))}
        </div>
      </div>
      <div key={idx} className="p-4 animate-fade-up">
        <div className="bg-paper-raise rounded-lg shadow-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-2xs font-mono uppercase tracking-wider text-ink-faint">
                {item.community} · {item.ago}
              </div>
              <div className="text-sm font-semibold mt-1.5 text-ink">“{item.title}”</div>
            </div>
            <div className="text-right shrink-0">
              <ScoreNum score={item.score} className="text-2xl" />
              <div className="text-2xs text-ink-faint">match</div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {item.checks.map((c) => (
              <Badge key={c} tone="good">✓ {c}</Badge>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-paper-line">
            <div className="text-2xs font-mono uppercase tracking-wider text-ink-faint mb-1">Recommended action</div>
            <p className="text-xs text-ink-soft">{item.action}</p>
            <div className="mt-2 flex items-center gap-3 text-2xs text-ink-mute">
              <span>Effort: {item.effort}</span>
              <span>·</span>
              <span>Potential: {item.potential}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── FAQ accordion ────────────────────────────────────────────────────────────

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="divide-y divide-paper-line border-y border-paper-line">
      {items.map((item, i) => (
        <div key={item.q}>
          <button className="w-full flex items-center justify-between gap-4 py-4 text-left" onClick={() => setOpen(open === i ? -1 : i)}>
            <span className="text-sm font-medium text-ink">{item.q}</span>
            <span className={cn("text-ink-faint transition-transform", open === i && "rotate-45")}>+</span>
          </button>
          {open === i ? <p className="pb-4 text-sm text-ink-mute leading-relaxed max-w-3xl">{item.a}</p> : null}
        </div>
      ))}
    </div>
  );
}

// ─── "How it works" loop ──────────────────────────────────────────────────────

export function LoopDiagram() {
  const steps = ["DISCOVER", "IDENTIFY INTENT", "RECOMMEND", "DRAFT", "REVIEW", "EXECUTE", "MEASURE", "LEARN"];
  return (
    <div className="flex flex-wrap items-center gap-y-3">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center">
          <div className={cn("rounded px-3 py-1.5 text-2xs font-mono tracking-wider", i < 2 ? "bg-ink text-white" : i < 5 ? "bg-paper-sunken text-ink-soft" : "bg-accent-soft text-accent")}>
            {s}
          </div>
          {i < steps.length - 1 ? <span className="mx-1.5 text-ink-faint">→</span> : <span className="mx-1.5 text-ink-faint">↺</span>}
        </div>
      ))}
    </div>
  );
}

export { BandBadge, Button };
