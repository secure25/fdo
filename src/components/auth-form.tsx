"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Badge } from "@/components/ui";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "login" ? { email, password } : { name, email, password, orgName: orgName || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Something went wrong");
        setLoading(false);
        return;
      }
      router.push(data.needsProduct ? "/onboarding" : "/app");
      router.refresh();
    } catch {
      setError("Network error — try again");
      setLoading(false);
    }
  }

  async function demoLogin() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "demo@founderos.app", password: "demo1234" }),
      });
      if (!res.ok) {
        setError("Demo account unavailable — run the seed script");
        setLoading(false);
        return;
      }
      router.push("/app");
      router.refresh();
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center gap-2 justify-center">
          <span className="w-5 h-5 rounded bg-ink inline-flex items-center justify-center"><span className="w-2 h-2 rounded-sm bg-white" /></span>
          <span className="text-sm font-semibold tracking-tight">Founder Distribution OS</span>
        </Link>
        <h1 className="display text-2xl font-semibold mt-6">{mode === "login" ? "Welcome back" : "Create your workspace"}</h1>
        <p className="text-xs text-ink-mute mt-1.5">
          {mode === "login" ? "Sign in to your distribution workspace." : "Free plan, no credit card. First discovery scan runs immediately."}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3.5">
        {mode === "signup" ? (
          <>
            <Field label="Your name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" required minLength={2} />
            </Field>
            <Field label="Workspace name" hint="You can rename or add workspaces later.">
              <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Acme Inc." />
            </Field>
          </>
        ) : null}
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required />
        </Field>
        <Field label="Password" hint={mode === "signup" ? "Minimum 8 characters." : undefined}>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={mode === "signup" ? 8 : 1} />
        </Field>

        {error ? <div className="text-xs text-bad bg-bad-soft rounded px-3 py-2">{error}</div> : null}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Working…" : mode === "login" ? "Sign in" : "Create workspace"}
        </Button>
      </form>

      <div className="my-4 flex items-center gap-3">
        <div className="h-px bg-paper-line flex-1" />
        <span className="text-2xs text-ink-faint">or</span>
        <div className="h-px bg-paper-line flex-1" />
      </div>

      <Button variant="secondary" className="w-full" onClick={demoLogin} disabled={loading}>
        Explore the demo workspace →
      </Button>
      <div className="mt-2 text-center">
        <Badge tone="neutral">demo@founderos.app · demo1234</Badge>
      </div>

      <p className="text-xs text-ink-mute text-center mt-6">
        {mode === "login" ? (
          <>No account? <Link href="/signup" className="text-accent hover:underline">Sign up</Link></>
        ) : (
          <>Already have an account? <Link href="/login" className="text-accent hover:underline">Sign in</Link></>
        )}
      </p>
    </div>
  );
}
