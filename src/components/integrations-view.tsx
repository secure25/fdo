"use client";

import { useState } from "react";
import { Badge, Button, Card, CardHeader, Input, Field } from "@/components/ui";
import { Plug, Webhook, Rss } from "lucide-react";

type IntegrationItem = {
  provider: string;
  name: string;
  blurb: string;
  tier: string;
  comingSoon?: boolean;
};

const CATALOG: IntegrationItem[] = [
  { provider: "slack", name: "Slack", blurb: "Daily opportunity digests in a channel of your choice.", tier: "GROWTH+", comingSoon: true },
  { provider: "hubspot", name: "HubSpot", blurb: "Sync prospects and conversions into your CRM.", tier: "PRO", comingSoon: true },
  { provider: "pipedrive", name: "Pipedrive", blurb: "Push qualified prospects into your deal pipeline.", tier: "PRO", comingSoon: true },
  { provider: "gmail", name: "Gmail", blurb: "Send approved outreach from your own address.", tier: "MAKER+", comingSoon: true },
  { provider: "stripe", name: "Stripe", blurb: "Attribute revenue events to acquisition channels.", tier: "GROWTH+", comingSoon: true },
  { provider: "zapier", name: "Zapier", blurb: "Connect opportunities to 6,000+ apps.", tier: "MAKER+", comingSoon: true },
  { provider: "webhook", name: "Webhooks", blurb: "POST high-intent opportunities (score ≥ 75) directly to your HTTP endpoint.", tier: "ALL PLANS", comingSoon: false },
];

const SOURCE_NOTES: Record<string, string> = {
  hackernews: "Public Algolia HN Search API. No auth required; polled at low frequency with backoff. Terms of service respected.",
  reddit: "Reddit public endpoints (OAuth-ready). Polite user-agent, low-frequency polling, exponential backoff. Platform policies respected.",
  sandbox: "Deterministic demonstration source. Sandbox rows are always flagged as demo data and never mixed into live results.",
};

function timeAgoStr(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export type DiscoverySource = { adapter: string; name: string; status: string; lastRunAt: string | null; isLive: boolean };

export function IntegrationsView({
  initial,
  sources,
}: {
  initial: { provider: string; status: string; config?: Record<string, unknown> | null }[];
  sources: DiscoverySource[];
}) {
  const [state, setState] = useState(Object.fromEntries(initial.map((i) => [i.provider, i.status])));
  const webhookInitial = initial.find((i) => i.provider === "webhook");
  const [webhookUrl, setWebhookUrl] = useState((webhookInitial?.config?.url as string) ?? "");
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(provider: string, action: "connect" | "disconnect") {
    setBusy(provider);
    try {
      await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, action, config: provider === "webhook" ? { url: webhookUrl.trim() } : undefined }),
      });
      setState((prev) => ({ ...prev, [provider]: action === "connect" ? "CONNECTED" : "DISCONNECTED" }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold tracking-tight">Integrations</h1>
        <p className="text-xs text-ink-faint mt-0.5">Connect Distribution OS to the tools you already use. Native webhooks are active now.</p>
      </div>

      {/* Discovery sources (spec §4 — modular source adapters) */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold tracking-tight">Discovery sources</h2>
          <span className="text-2xs text-ink-faint">modular adapters · add or replace without touching the engine</span>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {sources.map((s) => (
            <Card key={s.adapter}>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <Rss size={14} /> {s.name}
                  </span>
                }
                subtitle={SOURCE_NOTES[s.adapter] ?? "Source adapter"}
                action={<Badge tone={s.status === "ACTIVE" ? "good" : s.status === "PAUSED" ? "warn" : "neutral"}>{s.status.toLowerCase()}</Badge>}
              />
              <div className="px-5 py-3 flex items-center justify-between text-2xs font-mono text-ink-faint">
                <span>{s.isLive ? "LIVE SOURCE" : "DEMO SOURCE"}</span>
                <span>last run: {s.lastRunAt ? timeAgoStr(s.lastRunAt) : "never"}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {CATALOG.map((c) => {
          const connected = state[c.provider] === "CONNECTED";
          return (
            <Card key={c.provider}>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    {c.provider === "webhook" ? <Webhook size={14} /> : <Plug size={14} />} {c.name}
                  </span>
                }
                subtitle={c.blurb}
                action={
                  c.comingSoon ? (
                    <Badge tone="neutral">coming soon</Badge>
                  ) : (
                    <Badge tone={connected ? "good" : "neutral"}>{connected ? "connected" : "off"}</Badge>
                  )
                }
              />
              <div className="px-5 py-4">
                {c.provider === "webhook" ? (
                  <Field label="Endpoint URL" hint="Receives JSON on every new high-intent opportunity (score ≥ 75).">
                    <Input
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://yourapp.com/api/webhooks/fdo"
                    />
                  </Field>
                ) : null}
                <div className="flex items-center justify-between mt-3">
                  <span className="text-2xs font-mono text-ink-faint">{c.tier}</span>
                  {c.comingSoon ? (
                    <Button size="sm" variant="secondary" disabled>
                      Coming soon
                    </Button>
                  ) : connected ? (
                    <Button size="sm" variant="ghost" onClick={() => toggle(c.provider, "disconnect")} disabled={busy === c.provider}>
                      {busy === c.provider ? "Updating…" : "Disconnect"}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => toggle(c.provider, "connect")}
                      disabled={busy === c.provider || (c.provider === "webhook" && !webhookUrl.trim())}
                    >
                      {busy === c.provider ? "Connecting…" : c.provider === "webhook" ? "Save & connect" : "Connect"}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
