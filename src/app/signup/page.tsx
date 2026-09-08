import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-6 py-12">
      <Suspense fallback={<div className="text-xs text-ink-mute">Loading…</div>}>
        <AuthForm mode="signup" />
      </Suspense>
    </div>
  );
}
