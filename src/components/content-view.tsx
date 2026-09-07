"use client";

import { useRef, useState } from "react";
import { Badge, Button, Card, EmptyState, Modal, Textarea, Input, SectionLabel } from "@/components/ui";
import { timeAgo } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Send, Archive, ImageIcon, Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ContentDTO = {
  id: string;
  channel: string;
  format: string;
  title: string;
  body: string;
  status: string;
  spamRisk: number;
  warnings: { level: string; code: string; message: string }[];
  publishedAt: string | null;
  url: string | null;
  imageUrl: string | null;
  metrics: Record<string, number> | null;
  opportunity: { title: string; communityName: string | null } | null;
  updatedAt: string;
};

const STATUS_TONE: Record<string, "warn" | "good" | "neutral" | "accent"> = {
  DRAFT: "warn",
  APPROVED: "accent",
  PUBLISHED: "good",
  ARCHIVED: "neutral",
};

export function ContentView({ initial }: { initial: ContentDTO[] }) {
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState("ALL");
  const [editing, setEditing] = useState<ContentDTO | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [imgBusy, setImgBusy] = useState<string | null>(null);
  const [imgMsg, setImgMsg] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const uploadFor = useRef<string | null>(null);

  const filtered = filter === "ALL" ? items : items.filter((c) => c.status === filter);

  async function act(c: ContentDTO, action: "approve" | "publish" | "archive" | "edit", data?: { title?: string; body?: string; metrics?: Record<string, number> }) {
    setItems((prev) =>
      prev.map((x) =>
        x.id === c.id
          ? { ...x, status: action === "approve" ? "APPROVED" : action === "publish" ? "PUBLISHED" : action === "archive" ? "ARCHIVED" : x.status, title: data?.title ?? x.title, body: data?.body ?? x.body }
          : x
      )
    );
    await fetch(`/api/content/${c.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...data }),
    }).catch(() => undefined);
  }

  function setImage(c: ContentDTO, imageUrl: string | null) {
    setItems((prev) => prev.map((x) => (x.id === c.id ? { ...x, imageUrl } : x)));
  }

  async function uploadImage(c: ContentDTO, file: File) {
    setImgBusy(c.id);
    setImgMsg(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/content/${c.id}/image`, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.imageUrl) setImage(c, data.imageUrl);
      else setImgMsg(data?.error?.message ?? "Upload failed");
    } finally {
      setImgBusy(null);
    }
  }

  async function generateImage(c: ContentDTO) {
    setImgBusy(c.id);
    setImgMsg(null);
    try {
      const res = await fetch(`/api/content/${c.id}/image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.imageUrl) setImage(c, data.imageUrl);
      else setImgMsg(data?.error?.message ?? "Generation failed");
    } finally {
      setImgBusy(null);
    }
  }

  async function removeImage(c: ContentDTO) {
    setImgBusy(c.id);
    try {
      await fetch(`/api/content/${c.id}/image`, { method: "DELETE" });
      setImage(c, null);
    } finally {
      setImgBusy(null);
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Content</h1>
          <p className="text-xs text-ink-faint mt-0.5">AI drafts with guardrails — every piece is reviewed by you before it goes anywhere.</p>
        </div>
        <div className="flex items-center gap-1.5">
          {["ALL", "DRAFT", "APPROVED", "PUBLISHED"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn("text-2xs font-mono uppercase px-2 py-1 rounded transition", filter === s ? "bg-ink text-white" : "text-ink-faint hover:text-ink bg-paper-sunken")}
            >
              {s.toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {imgMsg ? (
        <div className="mb-4 rounded-md bg-warn-soft px-4 py-2 text-xs text-warn">{imgMsg} <button className="ml-2 underline" onClick={() => setImgMsg(null)}>dismiss</button></div>
      ) : null}

      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const id = uploadFor.current;
          const file = e.target.files?.[0];
          const item = items.find((x) => x.id === id);
          if (file && item) void uploadImage(item, file);
          e.target.value = "";
        }}
      />

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            title="No content here"
            body="Generate drafts from high-intent opportunities, or create SEO comparison pages from the opportunity feed."
          />
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map((c) => (
            <Card key={c.id} className="flex flex-col">
              <div className="px-5 pt-4 pb-3 border-b border-paper-line">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-2xs font-mono uppercase tracking-wider text-ink-faint">
                      {c.channel} · {c.format.toLowerCase()} · {timeAgo(c.updatedAt)}
                    </div>
                    <div className="text-sm font-semibold mt-1 leading-snug">{c.title}</div>
                    {c.opportunity ? <div className="text-2xs text-ink-faint mt-1">↳ “{c.opportunity.title}” ({c.opportunity.communityName ?? "public"})</div> : null}
                  </div>
                  <Badge tone={STATUS_TONE[c.status] ?? "neutral"}>{c.status.toLowerCase()}</Badge>
                </div>
              </div>

              {c.imageUrl ? (
                <div className="px-5 pt-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.imageUrl} alt={`Visual for ${c.title}`} className="w-full h-36 object-cover rounded-md border border-paper-line" />
                </div>
              ) : null}

              {c.warnings.length > 0 ? (
                <div className="px-5 pt-3 space-y-1.5">
                  {c.warnings.slice(0, 2).map((w, i) => (
                    <div key={i} className={cn("flex gap-2 rounded-md px-3 py-2", w.level === "BLOCK" ? "bg-bad-soft" : w.level === "WARN" ? "bg-warn-soft" : "bg-paper-sunken")}>
                      <AlertTriangle size={13} className={cn("shrink-0 mt-0.5", w.level === "BLOCK" ? "text-bad" : "text-warn")} />
                      <p className="text-2xs text-ink-soft leading-relaxed">{w.message}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="px-5 py-3 flex-1">
                <p className="text-xs text-ink-mute leading-relaxed line-clamp-4 whitespace-pre-line">{c.body}</p>
                {c.metrics ? (
                  <div className="mt-2 flex gap-3 text-2xs text-ink-faint data-num">
                    <span>{c.metrics.impressions ?? 0} impr</span>
                    <span>{c.metrics.engagements ?? 0} eng</span>
                    <span>{c.metrics.signups ?? 0} signups</span>
                    <span className="text-good">{c.metrics.customers ?? 0} customers</span>
                  </div>
                ) : null}
              </div>

              <div className="px-5 py-3 border-t border-paper-line/60 flex flex-wrap items-center gap-1.5">
                <span className="text-2xs text-ink-faint mr-auto">spam risk {c.spamRisk}/100</span>
                {c.status === "DRAFT" ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(c); setEditTitle(c.title); setEditBody(c.body); }}>Edit</Button>
                    <Button size="sm" variant="secondary" onClick={() => act(c, "approve")}><CheckCircle2 size={12} /> Approve</Button>
                  </>
                ) : null}
                {c.status === "APPROVED" ? (
                  <Button size="sm" onClick={() => act(c, "publish", { metrics: {} })}><Send size={12} /> Mark published</Button>
                ) : null}
                {c.status === "PUBLISHED" ? (
                  <>
                    {c.url ? <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">View live</a> : null}
                    <Button size="sm" variant="ghost" onClick={() => act(c, "archive")}><Archive size={12} /> Archive</Button>
                  </>
                ) : null}
                {c.status !== "ARCHIVED" ? (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={imgBusy === c.id}
                      onClick={() => { uploadFor.current = c.id; fileInput.current?.click(); }}
                    >
                      <ImageIcon size={12} /> {c.imageUrl ? "Replace" : "Upload"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={imgBusy === c.id}
                      onClick={() => void generateImage(c)}
                    >
                      <Sparkles size={12} /> {imgBusy === c.id ? "Working…" : c.imageUrl ? "AI banner" : "AI banner"}
                    </Button>
                    {c.imageUrl ? (
                      <Button size="sm" variant="ghost" disabled={imgBusy === c.id} onClick={() => void removeImage(c)}>
                        <Trash2 size={12} />
                      </Button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit draft" wide>
        {editing ? (
          <div className="space-y-3.5">
            <SectionLabel>{editing.channel} · {editing.format.toLowerCase()}</SectionLabel>
            <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            <Textarea rows={12} value={editBody} onChange={(e) => setEditBody(e.target.value)} className="text-[13px]" />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button
                onClick={() => {
                  act(editing, "edit", { title: editTitle, body: editBody });
                  setEditing(null);
                }}
              >
                Save changes
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
