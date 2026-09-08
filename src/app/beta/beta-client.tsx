"use client";

import { useState } from "react";
import { Button, Card, CardHeader } from "@/components/ui";

type EntitlementData = {
  id: string;
  cohort: string;
  startsAt: string;
  endsAt: string;
  status: string;
};

export function BetaClient({
  initialActive,
  initialEntitlement,
}: {
  initialActive: boolean;
  initialEntitlement: EntitlementData | null;
}) {
  const [isActivating, setIsActivating] = useState(false);
  const [isActive, setIsActive] = useState(initialActive);
  const [betaEntitlement, setBetaEntitlement] = useState<EntitlementData | null>(initialEntitlement);
  const [toast, setToast] = useState<{ id: string; type: "success" | "error"; message: string } | null>(null);
  const [cohort, setCohort] = useState<string>("BETA_2026_09");

  const handleActivate = async () => {
    setIsActivating(true);
    try {
      const res = await fetch("/api/betaEntitlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cohort }),
      });

      const data = await res.json();
      if (!res.ok) {
        setToast({
          id: Math.random().toString(36).substring(2, 9),
          type: "error",
          message: data?.error?.message || "Failed to activate beta entitlement",
        });
        return;
      }

      setIsActive(true);
      setBetaEntitlement(data.betaEntitlement);
      setToast({
        id: Math.random().toString(36).substring(2, 9),
        type: "success",
        message: "Beta entitlement activated successfully! You now have 30 days of Pro access.",
      });
    } catch (error: any) {
      setToast({
        id: Math.random().toString(36).substring(2, 9),
        type: "error",
        message: error?.message || "Failed to activate beta entitlement",
      });
    } finally {
      setIsActivating(false);
    }
  };

  const daysRemaining = betaEntitlement?.endsAt
    ? Math.max(0, Math.ceil((new Date(betaEntitlement.endsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Founder Distribution OS Beta Program</h1>
        <p className="text-sm text-ink-mute">
          Get 30 days of complimentary Pro access to test and provide feedback on the platform.
          No credit card required. Automatically reverts to Free plan after 30 days.
        </p>
      </div>

      {toast && (
        <div className="mb-4">
          <div
            role="status"
            className={`rounded-md px-4 py-3 text-sm ${
              toast.type === "success" ? "bg-good-soft text-good" : "bg-danger-soft text-danger"
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <span>{toast.message}</span>
              <button type="button" onClick={() => setToast(null)} aria-label="Close notification">
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {isActive ? (
        <Card className="mb-6">
          <CardHeader title="Your Beta Entitlement" />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status</span>
              <span className="px-3 py-1 rounded text-sm font-semibold bg-good-soft text-good">
                Active
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Cohort</span>
              <span className="text-sm font-medium">{betaEntitlement?.cohort}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Start Date</span>
              <span className="text-sm font-medium">
                {betaEntitlement?.startsAt ? new Date(betaEntitlement.startsAt).toLocaleDateString() : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">End Date</span>
              <span className="text-sm font-medium">
                {betaEntitlement?.endsAt ? new Date(betaEntitlement.endsAt).toLocaleDateString() : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Days Remaining</span>
              <span className="px-3 py-1 rounded text-sm font-semibold bg-accent-soft text-accent">
                {daysRemaining} days
              </span>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="mb-6">
          <CardHeader title="How the Beta Program Works" />
          <div className="space-y-4">
            <div className="flex items-center">
              <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-md bg-accent-100 text-accent">
                1
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium">Sign Up</h3>
                <p className="text-xs text-ink-mute">Create your account and onboard your business</p>
              </div>
            </div>
            <div className="flex items-center mt-4">
              <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-md bg-accent-100 text-accent">
                2
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium">Activate Beta</h3>
                <p className="text-xs text-ink-mute">Click the button below to activate 30 days of Pro access</p>
              </div>
            </div>
            <div className="flex items-center mt-4">
              <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-md bg-accent-100 text-accent">
                3
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium">Test & Provide Feedback</h3>
                <p className="text-xs text-ink-mute">Use the platform freely for 30 days and share your feedback</p>
              </div>
            </div>
            <div className="flex items-center mt-4">
              <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-md bg-accent-100 text-accent">
                4
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium">Automatic Downgrade</h3>
                <p className="text-xs text-ink-mute">After 30 days, your account will automatically revert to the Free plan</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-6">
            <Button
              onClick={handleActivate}
              disabled={isActivating}
              className={`w-full ${isActivating ? "opacity-50" : ""}`}
            >
              {isActivating ? "Activating..." : "Activate 30-Day Beta Access"}
            </Button>
          </div>
        </Card>
      )}

      <div className="mt-6">
        <Card>
          <CardHeader title="Important Notes" />
          <div className="space-y-3">
            <p className="text-sm text-ink-mute">
              <strong>No Credit Card Required:</strong> The beta program does not require a credit card to activate.
            </p>
            <p className="text-sm text-ink-mute">
              <strong>Automatic Downgrade:</strong> After 30 days, your account will automatically revert to the Free plan.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}

