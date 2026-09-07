"use client";

import { useState } from "react";
import { Badge, Button, Card, CardHeader, SectionLabel, ProgressBar } from "@/components/ui";
import { PLAN_ORDER, PLANS } from "@/lib/entitlements";
import { fmtMoney } from "@/lib/utils";
import { Check } from "lucide-react";

export function BillingView({
  plan,
  credits,
  usedThisMonth,
  monthlyGrant,
  seats,
  productsInUse,
  provider,
}: {
  plan: string;
  credits: number;
  usedThisMonth: number;
  monthlyGrant: number;
  seats: number;
  productsInUse: number;
  provider: "paddle" | "stripe" | "manual";
}) {
  const [current, setCurrent] = useState(plan);
  const [busy, setBusy] = useState<string | null>(null);
  const currentPlan = PLANS[current as keyof typeof PLANS] ?? PLANS.FREE;

  async function changePlan(next: string) {
    setBusy(next);
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: next }),
      });
      const data = await res.json();
      if (res.ok && data.mode === "manual") {
        setCurrent(next);
        window.location.reload();
      } else if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } finally {
      setBusy(null);
    }
  }

  const providerLine =
    provider === "paddle"
      ? "Checkout by Paddle — cards, PayPal and Apple Pay worldwide, with sales tax & VAT handled by Paddle as merchant of record."
      : provider === "stripe"
        ? "Payments handled by Stripe."
        : "Self-hosted mode — plan changes activate instantly. Connect Paddle or Stripe for automated global billing.";

  async function buyCredits() {
    setBusy("credits");
    try {
      await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits: 500 }),
      });
      window.location.reload();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold tracking-tight">Billing</h1>
        <p className="text-xs text-ink-faint mt-0.5">
          {providerLine}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <Card className="p-5">
          <SectionLabel>Current plan</SectionLabel>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-semibold">{currentPlan.name}</span>
            <span className="text-sm text-ink-faint">{currentPlan.priceCents === 0 ? "$0" : fmtMoney(currentPlan.priceCents)}/mo</span>
          </div>
          <div className="mt-3 space-y-1 text-xs text-ink-mute">
            <div>{currentPlan.limits.products} products · {currentPlan.limits.seats} seat{currentPlan.limits.seats > 1 ? "s" : ""}</div>
            <div>{currentPlan.limits.opportunitiesSurfaced} opportunities surfaced per scan</div>
            <div>{currentPlan.limits.experiments} running experiments · {currentPlan.limits.competitors} competitors</div>
          </div>
        </Card>
        <Card className="p-5">
          <SectionLabel>AI credits</SectionLabel>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="data-num text-2xl font-semibold">{credits}</span>
            <span className="text-xs text-ink-faint">available</span>
          </div>
          <ProgressBar className="mt-3" tone="accent" value={Math.min(100, (credits / Math.max(1, monthlyGrant)) * 100)} />
          <div className="text-2xs text-ink-faint mt-1.5">{usedThisMonth} used this month · {monthlyGrant} monthly grant</div>
          <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={buyCredits} disabled={busy === "credits"}>
            + 500 credits — $25
          </Button>
        </Card>
        <Card className="p-5">
          <SectionLabel>Usage</SectionLabel>
          <div className="mt-3 space-y-2.5">
            <UsageRow label="Products" value={productsInUse} max={currentPlan.limits.products} />
            <UsageRow label="Seats" value={seats} max={currentPlan.limits.seats} />
            <UsageRow label="Credit balance" value={credits} max={Math.max(credits, monthlyGrant)} />
          </div>
        </Card>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLAN_ORDER.map((id) => {
          const p = PLANS[id];
          const isCurrent = id === current;
          return (
            <Card key={id} className={`p-5 flex flex-col ${isCurrent ? "ring-2 ring-ink/80" : ""}`}>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{p.name}</div>
                {isCurrent ? <Badge tone="good">current</Badge> : null}
              </div>
              <div className="data-num text-2xl font-semibold mt-2">
                {p.priceCents === 0 ? "$0" : fmtMoney(p.priceCents)}<span className="text-xs text-ink-faint font-normal">/mo</span>
              </div>
              <ul className="mt-4 space-y-1.5 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="text-xs text-ink-soft flex gap-1.5"><Check size={11} className="text-good shrink-0 mt-0.5" />{f}</li>
                ))}
              </ul>
              <Button
                className="mt-4 w-full"
                variant={isCurrent ? "secondary" : "primary"}
                disabled={isCurrent || busy !== null}
                onClick={() => changePlan(id)}
              >
                {isCurrent ? "Current plan" : busy === id ? "Activating…" : p.priceCents === 0 ? "Downgrade" : `Upgrade to ${p.name}`}
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function UsageRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(100, (value / Math.max(1, max)) * 100);
  return (
    <div>
      <div className="flex items-center justify-between text-2xs">
        <span className="text-ink-mute">{label}</span>
        <span className="data-num text-ink-soft">{value}/{max}</span>
      </div>
      <ProgressBar value={pct} tone="accent" className="mt-1" />
    </div>
  );
}
