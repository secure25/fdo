"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Field, Input } from "@/components/ui";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Turnstile } from "@/components/turnstile";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), turnstileToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error?.message ?? "Something went wrong.");
        setLoading(false);
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 justify-center">
            <span className="w-5 h-5 rounded bg-ink inline-flex items-center justify-center">
              <span className="w-2 h-2 rounded-sm bg-white" />
            </span>
            <span className="text-sm font-semibold tracking-tight">Founder Distribution OS</span>
          </Link>
          <h1 className="display text-2xl font-semibold mt-6">Reset your password</h1>
          <p className="text-xs text-ink-mute mt-1.5">
            Enter your account email and we'll send you a password reset link.
          </p>
        </div>

        {submitted ? (
          <div className="rounded-lg border border-paper-line bg-paper-raise p-6 text-center space-y-4">
            <div className="w-10 h-10 rounded-full bg-good-soft flex items-center justify-center mx-auto text-good">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <div className="text-sm font-semibold">Check your inbox</div>
              <p className="text-xs text-ink-mute mt-1 leading-relaxed">
                If an account exists for <span className="font-medium text-ink">{email}</span>, you will receive an email with reset instructions within a few minutes.
              </p>
            </div>
            <Link href="/login" className="inline-block text-xs text-accent hover:underline pt-2">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Account email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                autoFocus
              />
            </Field>

            {error ? <div className="text-xs text-bad bg-bad-soft rounded px-3 py-2">{error}</div> : null}

            <Turnstile onVerify={setTurnstileToken} />

            <Button type="submit" className="w-full" disabled={loading || !email.trim()}>
              {loading ? "Sending link…" : "Send reset link"}
            </Button>

            <div className="text-center pt-2">
              <Link href="/login" className="inline-flex items-center gap-1.5 text-xs text-ink-mute hover:text-ink">
                <ArrowLeft size={13} /> Back to sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

