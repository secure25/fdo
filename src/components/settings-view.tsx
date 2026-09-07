"use client";

import { useState } from "react";
import { Badge, Button, Card, CardHeader, Field, Input, SectionLabel } from "@/components/ui";
import { Copy, KeyRound, Plus, ShieldCheck, Trash2 } from "lucide-react";

export type SettingsProps = {
  user: { name: string; email: string };
  org: { id: string; name: string; slug: string };
  products: { id: string; name: string; isDefault: boolean }[];
  planApi: boolean;
  apiKeys: { id: string; name: string; prefix: string; createdAt: string }[];
};

export function SettingsView({ user, org, products, planApi, apiKeys: initialKeys }: SettingsProps) {
  const [name, setName] = useState(user.name);
  const [orgName, setOrgName] = useState(org.name);
  const [defaultProductId, setDefaultProductId] = useState(products.find((p) => p.isDefault)?.id ?? "");
  const [saved, setSaved] = useState(false);
  const [keys, setKeys] = useState(initialKeys);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [keyName, setKeyName] = useState("Default key");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  async function save() {
    await fetch("/api/integrations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, orgName, defaultProductId: defaultProductId || undefined }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
    window.location.reload();
  }

  async function createKey() {
    const res = await fetch("/api/settings/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: keyName }),
    });
    const data = await res.json();
    if (res.ok) {
      setNewKey(data.key);
      setKeys((prev) => [...prev, { id: data.id, name: keyName, prefix: data.prefix, createdAt: new Date().toISOString() }]);
    }
  }

  async function deleteKey(id: string) {
    setKeys((prev) => prev.filter((k) => k.id !== id));
    await fetch(`/api/settings/api-keys?id=${id}`, { method: "DELETE" }).catch(() => undefined);
  }

  async function changePassword() {
    setPwBusy(true);
    setPwMsg(null);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPwMsg({ ok: true, text: "Password updated." });
        setCurrentPassword("");
        setNewPassword("");
      } else {
        setPwMsg({ ok: false, text: data?.error?.message ?? "Could not update password." });
      }
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        <p className="text-xs text-ink-faint mt-0.5">Profile, workspace and API access.</p>
      </div>

      <Card>
        <CardHeader title="Profile & workspace" />
        <div className="p-5 space-y-3.5">
          <div className="grid sm:grid-cols-2 gap-3.5">
            <Field label="Your name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Email"><Input value={user.email} disabled className="opacity-60" /></Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-3.5">
            <Field label="Workspace name"><Input value={orgName} onChange={(e) => setOrgName(e.target.value)} /></Field>
            <Field label="Workspace URL slug"><Input value={org.slug} disabled className="opacity-60 font-mono" /></Field>
          </div>
          {products.length > 1 ? (
            <Field label="Primary product" hint="Drives the Overview, discovery scans and strategist context.">
              <select value={defaultProductId} onChange={(e) => setDefaultProductId(e.target.value)} className="w-full h-9 rounded-md border border-paper-line bg-paper-raise px-3 text-sm">
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          ) : null}
          <div className="flex items-center gap-2 justify-end">
            {saved ? <span className="text-2xs text-good">Saved ✓</span> : null}
            <Button size="sm" onClick={save}>Save changes</Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="API access"
          subtitle={planApi ? "Pro plan — read opportunities programmatically." : "Available on the Pro plan."}
          action={planApi ? <Badge tone="good">enabled</Badge> : <Badge tone="neutral">Pro</Badge>}
        />
        <div className="p-5 space-y-4">
          <div className="rounded-md bg-paper-sunken px-3.5 py-2.5 font-mono text-2xs text-ink-mute overflow-x-auto">
            GET /api/v1/opportunities?band=VERY_HIGH&status=NEW<br />
            Authorization: Bearer sk-dos-…
          </div>
          {newKey ? (
            <div className="rounded-md border border-good/30 bg-good-soft px-3.5 py-3">
              <div className="text-2xs font-mono uppercase tracking-wider text-good mb-1">Copy your key now — shown once</div>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono break-all flex-1">{newKey}</code>
                <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(newKey)}><Copy size={11} /></Button>
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            {keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between rounded-md border border-paper-line px-3.5 py-2.5">
                <div className="flex items-center gap-2.5">
                  <KeyRound size={13} className="text-ink-faint" />
                  <div>
                    <div className="text-xs font-medium">{k.name}</div>
                    <div className="text-2xs text-ink-faint font-mono">{k.prefix}…</div>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => deleteKey(k.id)}><Trash2 size={12} className="text-bad" /></Button>
              </div>
            ))}
          </div>
          {planApi ? (
            <div className="flex items-center gap-2">
              <Input value={keyName} onChange={(e) => setKeyName(e.target.value)} className="max-w-[220px]" placeholder="Key name" />
              <Button size="sm" variant="secondary" onClick={createKey}><Plus size={12} /> Generate key</Button>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-md border border-paper-line px-3.5 py-2.5">
              <span className="text-xs text-ink-mute">API key generation requires the Pro plan.</span>
              <a href="/app/billing"><Button size="sm" variant="secondary">Upgrade to Pro</Button></a>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Security" subtitle="Password and session security." action={<ShieldCheck size={14} className="text-ink-faint" />} />
        <div className="p-5 space-y-3.5">
          <div className="grid sm:grid-cols-2 gap-3.5">
            <Field label="Current password">
              <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
            </Field>
            <Field label="New password" hint="Minimum 8 characters.">
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
            </Field>
          </div>
          <div className="flex items-center gap-3 justify-end">
            {pwMsg ? <span className={pwMsg.ok ? "text-2xs text-good" : "text-2xs text-bad"}>{pwMsg.text}</span> : null}
            <Button size="sm" onClick={changePassword} disabled={pwBusy || !currentPassword || newPassword.length < 8}>
              {pwBusy ? "Updating…" : "Update password"}
            </Button>
          </div>
          <p className="text-2xs text-ink-faint leading-relaxed">
            Sessions are DB-backed httpOnly cookies; password hashes use bcrypt. All mutations are same-origin enforced and rate-limited.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Discovery sources" />
        <div className="p-5">
          <SectionLabel className="mb-2.5">Active adapters</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {["Hacker News (public API)", "Reddit (public endpoints)", "Sandbox (demo source)"].map((s) => (
              <Badge key={s} tone="neutral">{s}</Badge>
            ))}
          </div>
          <p className="text-2xs text-ink-faint mt-3 leading-relaxed">
            Source adapters are modular: they respect platform APIs, rate limits and terms of service, and can be paused or replaced from Sources without touching the engine.
          </p>
        </div>
      </Card>
    </div>
  );
}
