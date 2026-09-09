"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";
import { CheckCircle2 } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="rounded-lg border border-paper-line bg-paper-raise p-6 text-center space-y-4">
        <div className="text-sm font-semibold text-bad">Missing or invalid reset token</div>
        <p className="text-xs text-ink-mute">
          This password reset link is missing a valid token. Please request a new link.
        </p>
        <Link href="/forgot-password">
          <Button size="sm" variant="secondary">Request new link</Button>
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error?.message ?? "Failed to reset password.");
        setLoading(false);
        return;
      }
      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 2500);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div>
      {success ? (
        <div className="rounded-lg border border-paper-line bg-paper-raise p-6 text-center space-y-4">
          <div className="w-10 h-10 rounded-full bg-good-soft flex items-center justify-center mx-auto text-good">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div className="text-sm font-semibold">Password updated successfully!</div>
            <p className="text-xs text-ink-mute mt-1">
              Redirecting you to the sign in page in a moment…
            </p>
          </div>
          <Link href="/login" className="inline-block text-xs text-accent hover:underline pt-2">
            Click here if you are not redirected
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="New password" hint="Minimum 8 characters.">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
              autoFocus
            />
          </Field>

          <Field label="Confirm new password">
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
            />
          </Field>

          {error ? <div className="text-xs text-bad bg-bad-soft rounded px-3 py-2">{error}</div> : null}

          <Button type="submit" className="w-full" disabled={loading || !password || !confirmPassword}>
            {loading ? "Updating password…" : "Reset password"}
          </Button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
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
          <h1 className="display text-2xl font-semibold mt-6">Set new password</h1>
          <p className="text-xs text-ink-mute mt-1.5">
            Choose a strong password with at least 8 characters.
          </p>
        </div>

        <Suspense fallback={<div className="text-xs text-ink-mute text-center">Loading…</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}

