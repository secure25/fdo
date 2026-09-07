"use client";

import { useState } from "react";
import { Badge, Button, Card, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { cn, timeAgo, timeUntil } from "@/lib/utils";
import { Plus, CheckCircle2, Circle, SkipForward, Calendar, Pause, Play, Flag, ListPlus, X } from "lucide-react";

export type CampaignDTO = {
  id: string;
  name: string;
  channel: string;
  objective: string;
  status: string;
  goalMetric: string | null;
  startedAt: string | null;
  scheduledAt: string | null;
  actions: {
    id: string;
    type: string;
    title: string;
    status: string;
    doneAt: string | null;
    dueAt: string | null;
    opportunity: { title: string } | null;
    prospect: { name: string } | null;
  }[];
};

const ACTION_TYPES = ["REPLY", "COMMENT", "POST", "EMAIL", "CONNECT", "PARTNER", "CONTENT", "SEO", "FOLLOWUP"];
const STATUS_TONE: Record<string, "good" | "warn" | "neutral" | "accent"> = {
  SCHEDULED: "accent",
  ACTIVE: "good",
  PAUSED: "warn",
  DONE: "neutral",
};

export function CampaignsView({ initial }: { initial: CampaignDTO[] }) {
  const [campaigns, setCampaigns] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", channel: "Reddit", objective: "", goalMetric: "", scheduledAt: "" });
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [actionForm, setActionForm] = useState({ type: "REPLY", title: "", dueAt: "" });

  const [err, setErr] = useState<string | null>(null);

  async function create() {
    setErr(null);
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        goalMetric: form.goalMetric || undefined,
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const scheduled = Boolean(form.scheduledAt) && new Date(form.scheduledAt).getTime() > Date.now() + 60_000;
      setCampaigns((prev) => [
        {
          id: data.id,
          name: form.name,
          channel: form.channel,
          objective: form.objective,
          status: scheduled ? "SCHEDULED" : "ACTIVE",
          goalMetric: form.goalMetric || null,
          startedAt: scheduled ? null : new Date().toISOString(),
          scheduledAt: scheduled ? new Date(form.scheduledAt).toISOString() : null,
          actions: [],
        },
        ...prev,
      ]);
      setCreating(false);
      setForm({ name: "", channel: "Reddit", objective: "", goalMetric: "", scheduledAt: "" });
    } else {
      const data = await res.json().catch(() => ({}));
      setErr(data?.error?.message ?? "Could not create campaign");
    }
  }

  async function toggleAction(campaignId: string, actionId: string, status: "DONE" | "TODO" | "SKIPPED") {
    setCampaigns((prev) =>
      prev.map((c) =>
        c.id === campaignId
          ? { ...c, actions: c.actions.map((a) => (a.id === actionId ? { ...a, status, doneAt: status === "DONE" ? new Date().toISOString() : null } : a)) }
          : c
      )
    );
    await fetch(`/api/campaigns/actions/${actionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => undefined);
  }

  async function setCampaignStatus(campaignId: string, status: "ACTIVE" | "PAUSED" | "DONE") {
    setCampaigns((prev) =>
      prev.map((c) =>
        c.id === campaignId
          ? { ...c, status, startedAt: status === "ACTIVE" && !c.startedAt ? new Date().toISOString() : c.startedAt }
          : c
      )
    );
    await fetch(`/api/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => undefined);
  }

  async function addAction(campaignId: string) {
    if (actionForm.title.trim().length < 2) return;
    const res = await fetch(`/api/campaigns?campaignId=${campaignId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: actionForm.type,
        title: actionForm.title,
        dueAt: actionForm.dueAt ? new Date(actionForm.dueAt).toISOString() : undefined,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === campaignId
            ? {
                ...c,
                actions: [
                  ...c.actions,
                  {
                    id: data.id,
                    type: actionForm.type,
                    title: actionForm.title,
                    status: "TODO",
                    doneAt: null,
                    dueAt: actionForm.dueAt ? new Date(actionForm.dueAt).toISOString() : null,
                    opportunity: null,
                    prospect: null,
                  },
                ],
              }
            : c
        )
      );
      setActionForm({ type: "REPLY", title: "", dueAt: "" });
      setAddingFor(null);
    }
  }

  const doneCount = (c: CampaignDTO) => c.actions.filter((a) => a.status === "DONE").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Campaigns</h1>
          <p className="text-xs text-ink-faint mt-0.5">Coordinated activity per channel — schedule a start, add actions with due dates, work the list.</p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}><Plus size={13} /> New campaign</Button>
      </div>

      {err ? (
        <div className="mb-4 rounded-md bg-warn-soft px-4 py-2 text-xs text-warn flex items-center justify-between">{err} <button className="ml-2 underline" onClick={() => setErr(null)}>dismiss</button></div>
      ) : null}

      <div className="grid md:grid-cols-2 gap-4">
        {campaigns.map((c) => (
          <Card key={c.id} className="flex flex-col">
            <div className="px-5 pt-4 pb-3 border-b border-paper-line">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{c.name}</div>
                  <div className="text-2xs text-ink-faint mt-0.5">
                    {c.channel} ·{" "}
                    {c.status === "SCHEDULED" && c.scheduledAt
                      ? `starts ${timeUntil(c.scheduledAt)}`
                      : c.startedAt
                        ? `started ${timeAgo(c.startedAt)}`
                        : "not started"}
                    {c.goalMetric ? ` · goal: ${c.goalMetric}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge tone={STATUS_TONE[c.status] ?? "neutral"}>{c.status.toLowerCase()}</Badge>
                  {c.status === "ACTIVE" ? (
                    <Button size="sm" variant="ghost" onClick={() => setCampaignStatus(c.id, "PAUSED")} aria-label="Pause campaign"><Pause size={12} /></Button>
                  ) : null}
                  {c.status === "PAUSED" || c.status === "SCHEDULED" ? (
                    <Button size="sm" variant="ghost" onClick={() => setCampaignStatus(c.id, "ACTIVE")} aria-label="Resume campaign"><Play size={12} /></Button>
                  ) : null}
                  {c.status !== "DONE" ? (
                    <Button size="sm" variant="ghost" onClick={() => setCampaignStatus(c.id, "DONE")} aria-label="Mark campaign done"><Flag size={12} /></Button>
                  ) : null}
                </div>
              </div>
              <p className="text-xs text-ink-mute mt-1.5 leading-relaxed">{c.objective}</p>
              <div className="mt-2 text-2xs text-ink-faint">{doneCount(c)}/{c.actions.length} actions done</div>
            </div>

            <div className="divide-y divide-paper-line/50 flex-1">
              {c.actions.map((a) => {
                const overdue = a.dueAt && a.status === "TODO" && new Date(a.dueAt).getTime() < Date.now();
                return (
                  <div key={a.id} className="px-5 py-2.5 flex items-center gap-3">
                    <button
                      onClick={() => toggleAction(c.id, a.id, a.status === "DONE" ? "TODO" : "DONE")}
                      className={cn("shrink-0", a.status === "DONE" ? "text-good" : "text-ink-faint hover:text-ink")}
                      aria-label="Toggle action"
                    >
                      {a.status === "DONE" ? <CheckCircle2 size={15} /> : a.status === "SKIPPED" ? <SkipForward size={14} /> : <Circle size={15} />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className={cn("text-xs truncate", a.status === "DONE" && "text-ink-faint line-through")}>{a.title}</div>
                      <div className="text-2xs text-ink-faint">
                        {a.type.toLowerCase()} · {a.opportunity?.title ? `opp: ${a.opportunity.title.slice(0, 44)}` : a.prospect ? `prospect: ${a.prospect.name}` : "general"}
                      </div>
                    </div>
                    {a.dueAt ? (
                      <Badge tone={overdue ? "bad" : "neutral"}>
                        <Calendar size={9} /> {overdue ? "overdue" : `due ${timeUntil(a.dueAt)}`}
                      </Badge>
                    ) : null}
                    <Badge tone="neutral">{a.type}</Badge>
                  </div>
                );
              })}
              {c.actions.length === 0 ? (
                <div className="px-5 py-6 text-center text-2xs text-ink-faint">No actions yet — add the first one below.</div>
              ) : null}

              {addingFor === c.id ? (
                <div className="px-5 py-3 space-y-2 bg-paper-sunken/60">
                  <div className="flex items-center justify-between">
                    <span className="text-2xs font-mono uppercase tracking-wider text-ink-faint">New action</span>
                    <button onClick={() => setAddingFor(null)} className="text-ink-faint hover:text-ink" aria-label="Cancel adding action"><X size={13} /></button>
                  </div>
                  <Input value={actionForm.title} onChange={(e) => setActionForm({ ...actionForm, title: e.target.value })} placeholder="Reply to the returns thread in r/shopify" />
                  <div className="flex gap-2">
                    <Select value={actionForm.type} onChange={(e) => setActionForm({ ...actionForm, type: e.target.value })} className="h-8 text-xs">
                      {ACTION_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </Select>
                    <Input type="datetime-local" value={actionForm.dueAt} onChange={(e) => setActionForm({ ...actionForm, dueAt: e.target.value })} className="h-8 text-xs" />
                  </div>
                  <Button size="sm" className="w-full" onClick={() => void addAction(c.id)} disabled={actionForm.title.trim().length < 2}>
                    <ListPlus size={12} /> Add action
                  </Button>
                </div>
              ) : (
                <div className="px-5 py-2">
                  <Button size="sm" variant="ghost" className="w-full" onClick={() => { setAddingFor(c.id); setActionForm({ type: "REPLY", title: "", dueAt: "" }); }}>
                    <Plus size={12} /> Add action
                  </Button>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="New campaign">
        <div className="space-y-3.5">
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Reddit intent capture" /></Field>
          <Field label="Channel">
            <Select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
              {["Reddit", "LinkedIn", "X", "Hacker News", "Email", "SEO", "Partnerships", "Product Hunt", "YouTube"].map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Objective" hint="What does success look like in one sentence?">
            <Textarea rows={2} value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} placeholder="Reply to all high-intent threads within 24h" />
          </Field>
          <Field label="Goal metric" hint="Optional"><Input value={form.goalMetric} onChange={(e) => setForm({ ...form, goalMetric: e.target.value })} placeholder="Replies → conversations" /></Field>
          <Field label="Schedule start" hint="Optional — leave empty to start now">
            <Input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            <Button onClick={create} disabled={form.name.length < 2 || form.objective.length < 2}>{form.scheduledAt ? "Schedule" : "Create"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
