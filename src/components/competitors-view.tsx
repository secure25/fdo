"use client";

import { useState } from "react";
import { Badge, Button, Card, CardHeader, Field, Input, Modal, Select, ScoreNum } from "@/components/ui";
import { timeAgo } from "@/lib/utils";
import { Eye, EyeOff, Plus } from "lucide-react";

export type CompetitorDTO = {
  id: string;
  name: string;
  url: string | null;
  positioning: string | null;
  monitor: boolean;
  events: {
    id: string;
    kind: string;
    title: string;
    detail: string;
    whatChanged: string;
    whyItMatters: string;
    potentialResponse: string;
    severity: string;
    detectedAt: string;
  }[];
};

const KIND_TONE: Record<string, "bad" | "warn" | "good" | "accent" | "neutral"> = {
  PRICING: "bad",
  COMPLAINT: "urgent" as never,
  FEATURE: "accent",
  LAUNCH: "accent",
  REVIEW: "neutral",
  CONTENT: "neutral",
  POSITIONING: "warn",
};

export function CompetitorsView({ initial }: { initial: CompetitorDTO[] }) {
  const [competitors, setCompetitors] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", url: "", positioning: "" });

  const [err, setErr] = useState<string | null>(null);

  async function add() {
    setErr(null);
    const res = await fetch("/api/competitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, url: form.url || undefined, positioning: form.positioning || undefined }),
    });
    if (res.ok) {
      const data = await res.json();
      setCompetitors((prev) => [...prev, { id: data.id, name: form.name, url: form.url || null, positioning: form.positioning || null, monitor: true, events: [] }]);
      setAdding(false);
      setForm({ name: "", url: "", positioning: "" });
    } else {
      const data = await res.json().catch(() => ({}));
      setErr(data?.error?.message ?? "Could not add competitor");
    }
  }

  async function toggleMonitor(c: CompetitorDTO) {
    setCompetitors((prev) => prev.map((x) => (x.id === c.id ? { ...x, monitor: !x.monitor } : x)));
    await fetch("/api/competitors?action=monitor", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, monitor: !c.monitor }),
    }).catch(() => undefined);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Competitor intelligence</h1>
          <p className="text-xs text-ink-faint mt-0.5">Public signals: pricing changes, launches, reviews and customer complaints — each with a potential response.</p>
        </div>
      </div>

      {err ? (
        <div className="mb-4 rounded-md bg-warn-soft px-4 py-2 text-xs text-warm flex items-center justify-between">{err} <button className="ml-2 underline" onClick={() => setErr(null)}>dismiss</button></div>
      ) : null}

      <div className="space-y-4">
        {competitors.map((c) => (
          <Card key={c.id}>
            <CardHeader
              title={
                <span className="flex items-center gap-2.5">
                  {c.name}
                  {c.url ? <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-2xs text-accent hover:underline font-normal">{c.url.replace(/^https?:\/\//, "")}</a> : null}
                </span>
              }
              subtitle={c.positioning ?? undefined}
              action={
                <Button size="sm" variant="ghost" onClick={() => toggleMonitor(c)}>
                  {c.monitor ? <><Eye size={12} /> Monitoring</> : <><EyeOff size={12} /> Paused</>}
                </Button>
              }
            />
            {c.events.length === 0 ? (
              <div className="px-5 py-6 text-center text-2xs text-ink-faint">No events captured yet. Monitoring scans public sources for {c.name} mentions.</div>
            ) : (
              <div className="divide-y divide-paper-line/60">
                {c.events.map((ev) => (
                  <div key={ev.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge tone={(KIND_TONE[ev.kind] ?? "neutral") as never}>{ev.kind.toLowerCase()}</Badge>
                        <Badge tone={ev.severity === "HIGH" ? "bad" : ev.severity === "MEDIUM" ? "warn" : "neutral"}>{ev.severity.toLowerCase()} severity</Badge>
                        <span className="text-2xs text-ink-faint">{timeAgo(ev.detectedAt)}</span>
                      </div>
                    </div>
                    <div className="text-sm font-medium mt-2">{ev.title}</div>
                    <div className="mt-2.5 grid sm:grid-cols-3 gap-3">
                      {[
                        ["What changed", ev.whatChanged],
                        ["Why it matters", ev.whyItMatters],
                        ["Potential response", ev.potentialResponse],
                      ].map(([l, v]) => (
                        <div key={l} className="rounded-md bg-paper-sunken/70 px-3 py-2.5">
                          <div className="text-2xs font-mono uppercase tracking-wider text-ink-faint mb-1">{l}</div>
                          <p className="text-xs text-ink-soft leading-relaxed">{v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add competitor">
        <div className="space-y-3.5">
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Botika" /></Field>
          <Field label="URL" hint="Optional"><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://competitor.com" /></Field>
          <Field label="Positioning" hint="How they describe themselves"><Input value={form.positioning} onChange={(e) => setForm({ ...form, positioning: e.target.value })} placeholder="AI fashion models for apparel photography" /></Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            <Button onClick={add} disabled={form.name.length < 2}>Add & monitor</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
