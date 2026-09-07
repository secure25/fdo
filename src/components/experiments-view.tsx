"use client";

import { useState } from "react";
import { Badge, Button, Card, CardHeader, Field, Input, Modal, SectionLabel, Textarea, Select } from "@/components/ui";
import { FunnelChart } from "@/components/charts";
import { fmtMoney } from "@/lib/utils";

export type ExperimentViewDTO = {
  id: string;
  name: string;
  hypothesis: string;
  channelA: string;
  channelB: string;
  status: string;
  startedAt: string;
  funnels: {
    channel: string;
    opportunities: number;
    engagements: number;
    clicks: number;
    signups: number;
    activations: number;
    customers: number;
    revenueCents: number;
    hoursInvested: number;
    customersPerHour: number;
  }[];
  conclusion: { winner: string | null; efficiencyMultiple: number | null; recommendation: string } | null;
};

const STAGE_LABELS = [
  ["opportunities", "Opportunities"],
  ["engagements", "Engagement"],
  ["clicks", "Visits"],
  ["signups", "Signups"],
  ["activations", "Activation"],
  ["customers", "Customers"],
] as const;

export function ExperimentsView({ initial }: { initial: ExperimentViewDTO[] }) {
  const [experiments, setExperiments] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [logging, setLogging] = useState<ExperimentViewDTO | null>(null);
  const [form, setForm] = useState({ name: "", hypothesis: "", channelA: "Reddit", channelB: "LinkedIn" });
  const [logForm, setLogForm] = useState({ channel: "", opportunities: "0", engagements: "0", clicks: "0", signups: "0", activations: "0", customers: "0", revenueCents: "0", hoursInvested: "0" });

  const [err, setErr] = useState<string | null>(null);

  async function create() {
    setErr(null);
    const res = await fetch("/api/experiments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const data = await res.json();
      setExperiments((prev) => [
        { id: data.id, name: form.name, hypothesis: form.hypothesis, channelA: form.channelA, channelB: form.channelB, status: "RUNNING", startedAt: new Date().toISOString(), funnels: [], conclusion: null },
        ...prev,
      ]);
      setCreating(false);
      setForm({ name: "", hypothesis: "", channelA: "Reddit", channelB: "LinkedIn" });
    } else {
      const data = await res.json().catch(() => ({}));
      setErr(data?.error?.message ?? "Could not create experiment");
    }
  }

  async function logResult() {
    if (!logging) return;
    const payload = {
      channel: logForm.channel || logging.channelA,
      opportunities: Number(logForm.opportunities),
      engagements: Number(logForm.engagements),
      clicks: Number(logForm.clicks),
      signups: Number(logForm.signups),
      activations: Number(logForm.activations),
      customers: Number(logForm.customers),
      revenueCents: Number(logForm.revenueCents),
      hoursInvested: Number(logForm.hoursInvested),
      spendCents: 0,
    };
    const res = await fetch(`/api/experiments?experimentId=${logging.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      window.location.reload();
    }
  }

  async function conclude(e: ExperimentViewDTO) {
    await fetch(`/api/experiments?experimentId=${e.id}&action=conclude`, { method: "PUT" });
    setExperiments((prev) => prev.map((x) => (x.id === e.id ? { ...x, status: "CONCLUDED" } : x)));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Experiments</h1>
          <p className="text-xs text-ink-faint mt-0.5">Test channels and strategies. Track Opportunities → Engagement → Visits → Signups → Activation → Customers → Revenue.</p>
        </div>
        {err ? <div className="mb-4 rounded-md bg-warn-soft px-4 py-2 text-xs text-warn">{err} <button className="ml-2 underline" onClick={() => setErr(null)}>dismiss</button></div> : null}
        <Button size="sm" onClick={() => setCreating(true)}>New experiment</Button>
      </div>

      <div className="space-y-5">
        {experiments.length === 0 ? (
          <Card className="p-10 text-center text-sm text-ink-mute">No experiments yet. Create one to start comparing channels with real funnel data.</Card>
        ) : null}
        {experiments.map((e) => (
          <Card key={e.id}>
            <CardHeader
              title={e.name}
              subtitle={e.hypothesis}
              action={
                <div className="flex items-center gap-2">
                  <Badge tone={e.status === "RUNNING" ? "good" : "neutral"}>{e.status.toLowerCase()}</Badge>
                  {e.status === "RUNNING" ? <Button size="sm" variant="secondary" onClick={() => setLogging(e)}>Log results</Button> : null}
                </div>
              }
            />
            <div className="p-5 grid lg:grid-cols-2 gap-8">
              {e.funnels.length === 0 ? (
                <div className="lg:col-span-2 text-sm text-ink-mute py-4 text-center">No results logged yet — log funnel numbers for each channel to see the comparison.</div>
              ) : null}
              {e.funnels.map((f) => (
                <div key={f.channel}>
                  <SectionLabel className="mb-3">{f.channel} · {f.hoursInvested}h invested</SectionLabel>
                  <FunnelChart
                    stages={STAGE_LABELS.map(([k, label]) => ({ label, value: f[k as keyof typeof f] as number }))}
                  />
                  <div className="mt-3 flex items-center justify-between text-2xs text-ink-faint border-t border-paper-line/60 pt-2.5">
                    <span>{f.customersPerHour > 0 ? `${f.customersPerHour.toFixed(2)} customers/hour` : "no customers yet"}</span>
                    <span>{fmtMoney(f.revenueCents, { compact: true })} revenue</span>
                  </div>
                </div>
              ))}
            </div>
            {e.conclusion ? (
              <div className="px-5 py-4 border-t border-paper-line bg-paper-sunken/40 rounded-b-lg">
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge tone="accent">Result</Badge>
                  {e.conclusion.winner ? <span className="text-xs font-medium">Winner: {e.conclusion.winner}</span> : null}
                  {e.conclusion.efficiencyMultiple ? <Badge tone="good">{e.conclusion.efficiencyMultiple}× more efficient</Badge> : null}
                </div>
                <p className="text-[13px] text-ink-soft leading-relaxed">{e.conclusion.recommendation}</p>
              </div>
            ) : null}
          </Card>
        ))}
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="New experiment">
        <div className="space-y-3.5">
          <Field label="Name"><Input value={form.name} onChange={(ev) => setForm({ ...form, name: ev.target.value })} placeholder="Reddit vs LinkedIn" /></Field>
          <Field label="Hypothesis"><Textarea rows={2} value={form.hypothesis} onChange={(ev) => setForm({ ...form, hypothesis: ev.target.value })} placeholder="Reddit produces fewer visitors but higher-intent customers." /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Channel A">
              <Select value={form.channelA} onChange={(ev) => setForm({ ...form, channelA: ev.target.value })}>
                {["Reddit", "LinkedIn", "X", "Hacker News", "Email", "SEO", "Product Hunt", "YouTube", "TikTok", "Discord"].map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Channel B">
              <Select value={form.channelB} onChange={(ev) => setForm({ ...form, channelB: ev.target.value })}>
                {["Reddit", "LinkedIn", "X", "Hacker News", "Email", "SEO", "Product Hunt", "YouTube", "TikTok", "Discord"].map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            <Button onClick={create} disabled={form.name.length < 2 || form.hypothesis.length < 10}>Create</Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(logging)} onClose={() => setLogging(null)} title={`Log results — ${logging?.name ?? ""}`}>
        {logging ? (
          <div className="space-y-3.5">
            <Field label="Channel">
              <Select value={logForm.channel || logging.channelA} onChange={(ev) => setLogForm({ ...logForm, channel: ev.target.value })}>
                {[logging.channelA, logging.channelB].map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  ["opportunities", "Opportunities"],
                  ["engagements", "Engagements"],
                  ["clicks", "Visits"],
                  ["signups", "Signups"],
                  ["activations", "Activations"],
                  ["customers", "Customers"],
                  ["revenueCents", "Revenue (cents)"],
                  ["hoursInvested", "Hours invested"],
                ] as const
              ).map(([k, label]) => (
                <Field key={k} label={label}>
                  <Input type="number" min={0} value={logForm[k]} onChange={(ev) => setLogForm({ ...logForm, [k]: ev.target.value })} />
                </Field>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setLogging(null)}>Cancel</Button>
              <Button onClick={logResult}>Save result</Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
