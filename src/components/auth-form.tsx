"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";
import { Turnstile } from "@/components/turnstile";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeParam = searchParams.get("code") ?? "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [inviteCode, setInviteCode] = useState(codeParam);
  const [turnstileToken, setTurnstileToken] = useState("");
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
        body: JSON.stringify(
          mode === "login"
            ? { email, password, turnstileToken }
            : {
                name,
                email,
                password,
                orgName: orgName || undefined,
                inviteCode: inviteCode.trim().toUpperCase(),
                turnstileToken,
              }
        ),
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

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center gap-2 justify-center">
          <span className="w-5 h-5 rounded bg-ink inline-flex items-center justify-center"><span className="w-2 h-2 rounded-sm bg-white" /></span>
          <span className="text-sm font-semibold tracking-tight">Founder Distribution OS</span>
        </Link>
        <h1 className="display text-2xl font-semibold mt-6">{mode === "login" ? "Welcome back" : "Create your workspace"}</h1>
        <p className="text-xs text-ink-mute mt-1.5">
          {mode === "login"
            ? "Sign in to your distribution workspace."
            : "Private Beta — Invitation required. 30 days complimentary Pro access included."}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3.5">
        {mode === "signup" ? (
          <>
            <Field label="Private Beta Invite Code" hint="Required for access. 30 days of Pro included.">
              <Input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="e.g. FOUNDER1"
                required
                autoCapitalize="characters"
              />
            </Field>
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

        {mode === "login" ? (
          <div className="flex justify-end -mt-1">
            <Link href="/forgot-password" className="text-2xs text-ink-mute hover:text-ink">
              Forgot password?
            </Link>
          </div>
        ) : null}

        {error ? <div className="text-xs text-bad bg-bad-soft rounded px-3 py-2">{error}</div> : null}

        <Turnstile onVerify={setTurnstileToken} />

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Working…" : mode === "login" ? "Sign in" : "Create workspace"}
        </Button>

        {mode === "signup" ? (
          <p className="text-2xs text-ink-faint text-center leading-relaxed pt-1">
            By creating an account, you agree to our{" "}
            <Link href="/terms" className="underline hover:text-ink" target="_blank">Terms</Link> and{" "}
            <Link href="/privacy" className="underline hover:text-ink" target="_blank">Privacy Policy</Link>.
          </p>
        ) : null}
      </form>

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
