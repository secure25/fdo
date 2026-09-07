"use client";

import { useState } from "react";
import { Badge, Button, Card, CardHeader, EmptyState, Modal, Select, ScoreNum } from "@/components/ui";
import { timeAgo } from "@/lib/utils";
import { ExternalLink, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProspectDTO = {
  id: string;
  name: string;
  handle: string | null;
  company: string | null;
  role: string | null;
  website: string | null;
  industry: string | null;
  icpFit: number;
  intentScore: number;
  signalsVerified: string[];
  signalsInferred: string[];
  approach: string;
  stage: string;
  notes: string | null;
  sourceOpportunity: { title: string; url: string | null; communityName: string | null } | null;
  createdAt: string;
};

const STAGES = ["NEW", "CONTACTED", "ENGAGED", "QUALIFIED", "CUSTOMER", "LOST"] as const;

export function ProspectBoard({ initial, stageFilter }: { initial: ProspectDTO[]; stageFilter?: string }) {
  const [prospects, setProspects] = useState(initial);
  const [filter, setFilter] = useState(stageFilter ?? "ALL");
  const [selectedId, setSelectedId] = useState<string | null>(initial[0]?.id ?? null);
  const selected = prospects.find((p) => p.id === selectedId) ?? null;

  async function setStage(p: ProspectDTO, stage: string) {
    setProspects((prev) => prev.map((x) => (x.id === p.id ? { ...x, stage } : x)));
    await fetch(`/api/prospects/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    }).catch(() => undefined);
  }

  const filtered = filter === "ALL" ? prospects : prospects.filter((p) => p.stage === filter);
  const inPipeline = prospects.filter((p) => !["NEW", "LOST"].includes(p.stage)).length;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Customers & prospects</h1>
          <p className="text-xs text-ink-faint mt-0.5">
            Prospect intelligence from public signals — {prospects.length} profiles, {inPipeline} in pipeline
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {["ALL", ...STAGES].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                "text-2xs font-mono uppercase px-2 py-1 rounded transition",
                filter === s ? "bg-ink text-white" : "text-ink-faint hover:text-ink bg-paper-sunken"
              )}
            >
              {s.toLowerCase()}
              {s !== "ALL" ? <span className="ml-1 opacity-60">{prospects.filter((p) => p.stage === s).length}</span> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] gap-6 items-start">
        {/* Roster */}
        <div>
          {filtered.length === 0 ? (
            <Card><EmptyState title="No prospects here" body="Prospects are created automatically from high-intent opportunities, or via outreach campaigns." /></Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px]">
                  <thead>
                    <tr className="text-left font-mono text-2xs uppercase tracking-[0.12em] text-ink-faint border-b border-paper-line">
                      <th className="px-4 py-2.5 font-medium">Prospect</th>
                      <th className="px-4 py-2.5 font-medium">ICP fit</th>
                      <th className="px-4 py-2.5 font-medium">Intent</th>
                      <th className="px-4 py-2.5 font-medium">Stage</th>
                      <th className="px-4 py-2.5 font-medium">Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <tr
                        key={p.id}
                        onClick={() => setSelectedId(p.id)}
                        className={cn(
                          "hover:bg-paper-sunken/50 cursor-pointer transition border-b border-paper-line/60 last:border-b-0",
                          selected?.id === p.id && "bg-paper-sunken"
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-ink">{p.name}</div>
                          <div className="text-2xs text-ink-faint">{[p.role, p.company].filter(Boolean).join(" · ") || "—"}</div>
                          {p.sourceOpportunity ? (
                            <div className="text-2xs text-ink-faint mt-0.5 max-w-[260px] truncate">
                              <span className="text-ink-mute">signal:</span> {p.sourceOpportunity.title}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3"><ScoreNum score={p.icpFit} /></td>
                        <td className="px-4 py-3"><ScoreNum score={p.intentScore} /></td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <Select value={p.stage} onChange={(e) => setStage(p, e.target.value)} className="h-7 text-xs">
                            {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </Select>
                        </td>
                        <td className="px-4 py-3 text-2xs text-ink-faint whitespace-nowrap">{timeAgo(p.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        {/* Profile intelligence — always visible on desktop */}
        <div className="hidden lg:block lg:sticky lg:top-20">
          {selected ? (
            <Card>
              <CardHeader
                title={selected.name}
                subtitle={[selected.role, selected.company].filter(Boolean).join(" · ") || "Role unconfirmed — verify in first conversation"}
              />
              <ProspectDetail p={selected} onStage={(s) => setStage(selected, s)} />
            </Card>
          ) : (
            <Card>
              <EmptyState title="Select a prospect" body="Pick a profile to see verified signals, inferences and the recommended approach." />
            </Card>
          )}
        </div>
      </div>

      {/* Mobile detail modal */}
      {selected ? (
        <div className="lg:hidden">
          <Modal open={Boolean(selected)} onClose={() => setSelectedId(null)} title={`${selected.name}${selected.company ? ` — ${selected.company}` : ""}`} wide>
            <ProspectDetail p={selected} onStage={(s) => setStage(selected, s)} />
          </Modal>
        </div>
      ) : null}
    </div>
  );
}

function ProspectDetail({ p, onStage }: { p: ProspectDTO; onStage: (s: string) => void }) {
  return (
    <div className="space-y-5 px-5 pb-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="text-center">
            <ScoreNum score={p.icpFit} className="text-xl" />
            <div className="text-[10px] text-ink-faint">ICP fit</div>
          </div>
          <div className="text-center">
            <ScoreNum score={p.intentScore} className="text-xl" />
            <div className="text-[10px] text-ink-faint">Buying intent</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={p.stage === "CUSTOMER" ? "good" : p.stage === "LOST" ? "neutral" : "warn"}>{p.stage.toLowerCase()}</Badge>
          <Select value={p.stage} onChange={(e) => onStage(e.target.value)} className="h-8 text-xs">
            {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>
      </div>

      {(p.website || p.industry || p.handle) ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-mute">
          {p.website ? (
            <a href={p.website} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline inline-flex items-center gap-1">
              {p.website.replace(/^https?:\/\//, "")} <ExternalLink size={10} />
            </a>
          ) : null}
          {p.industry ? <span>{p.industry}</span> : null}
          {p.handle ? <span className="font-mono text-ink-faint">@{p.handle}</span> : null}
        </div>
      ) : null}

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-md border border-paper-line p-3.5">
          <div className="text-2xs font-mono uppercase tracking-wider text-good mb-2">✓ Verified information</div>
          <ul className="space-y-1.5">
            {p.signalsVerified.map((s, i) => (
              <li key={i} className="text-xs text-ink-soft flex gap-1.5"><Check size={11} className="text-good shrink-0 mt-0.5" />{s}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-md border border-paper-line p-3.5">
          <div className="text-2xs font-mono uppercase tracking-wider text-ink-faint mb-2">≈ Inference (estimate)</div>
          <ul className="space-y-1.5">
            {p.signalsInferred.map((s, i) => (
              <li key={i} className="text-xs text-ink-mute flex gap-1.5"><span className="text-ink-faint">≈</span>{s}</li>
            ))}
          </ul>
        </div>
      </div>

      {p.sourceOpportunity ? (
        <Card className="p-4">
          <div className="text-2xs font-mono uppercase tracking-wider text-ink-faint mb-1.5">Relevant conversation — {p.sourceOpportunity.communityName ?? "public post"}</div>
          <p className="text-[13px] text-ink-soft">“{p.sourceOpportunity.title}”</p>
          {p.sourceOpportunity.url ? (
            <a href={p.sourceOpportunity.url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline inline-flex items-center gap-1 mt-2">
              View conversation <ExternalLink size={10} />
            </a>
          ) : null}
        </Card>
      ) : null}

      <div>
        <div className="text-2xs font-mono uppercase tracking-wider text-ink-faint mb-1.5">Recommended approach</div>
        <div className="rounded-md bg-accent-soft px-4 py-3 text-[13px] text-ink-soft leading-relaxed">{p.approach}</div>
      </div>

      {p.notes ? (
        <div>
          <div className="text-2xs font-mono uppercase tracking-wider text-ink-faint mb-1.5">Your notes</div>
          <p className="text-xs text-ink-mute">{p.notes}</p>
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button size="sm" onClick={() => onStage("CONTACTED")} disabled={p.stage !== "NEW"}>Mark contacted</Button>
        <Button size="sm" variant="secondary" onClick={() => onStage("QUALIFIED")} disabled={!["CONTACTED", "ENGAGED"].includes(p.stage)}>Qualify</Button>
        <Button size="sm" variant="ghost" onClick={() => onStage("CUSTOMER")} disabled={p.stage === "CUSTOMER"}>Mark customer 🎉</Button>
      </div>
    </div>
  );
}
