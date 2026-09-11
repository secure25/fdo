"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, Textarea, Card, SectionLabel, Badge, ScoreRing } from "@/components/ui";
import { cn } from "@/lib/utils";

type AnalysisResult = {
  product: { id: string; name: string };
  intel: {
    category: string;
    icp: { name: string; description: string; buyerRole: string };
    problems: string[];
    competitors: { name: string; positioning: string }[];
    confidence: number;
    model: string;
  };
  discovery: { inserted: number; scanned: number };
};

const STEPS = ["Product", "Constraints", "Analysis"];

export function OnboardingWizard({ orgName, userName }: { orgName: string; userName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const [form, setForm] = useState({
    name: "",
    url: "",
    description: "",
    targetCustomer: "",
    industry: "",
    geography: "Global",
    budgetBand: "LEAN",
    timePerWeek: "5",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function analyze() {
    setLoading(true);
    setError(null);
    try {
      let cleanUrl = form.url.trim();
      if (cleanUrl && !/^https?:\/\//i.test(cleanUrl) && cleanUrl.includes(".")) {
        cleanUrl = `https://${cleanUrl}`;
      }

      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          url: form.url || undefined,
          description: form.description,
          targetCustomer: form.targetCustomer || undefined,
          industry: form.industry || undefined,
          name: form.name.trim(),
          url: cleanUrl || undefined,
          description: form.description.trim(),
          targetCustomer: form.targetCustomer.trim() || undefined,
          industry: form.industry.trim() || undefined,
          geography: form.geography || undefined,
          budgetBand: form.budgetBand,
          timePerWeek: parseInt(form.timePerWeek, 10) || 5,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Analysis failed");
        const detailMsg = data.error?.details?.[0]?.message;
        const msg = detailMsg
          ? `${data.error?.message ?? "Validation error"}: ${detailMsg}`
          : data.error?.message ?? "Analysis failed";
        setError(msg);
        setLoading(false);
        return;
      }
      setResult(data);
      setStep(2);
    } catch {
      setError("Network error — try again");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="text-sm font-semibold">Founder Distribution OS</div>
            <div className="text-xs text-ink-mute mt-0.5">{orgName} · {userName}</div>
          </div>
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s} className={cn("text-2xs font-mono px-2 py-1 rounded", i === step ? "bg-ink text-white" : i < step ? "bg-good-soft text-good" : "bg-paper-sunken text-ink-faint")}>
                {i + 1}. {s}
              </div>
            ))}
          </div>
        </div>

        {step === 0 ? (
          <Card className="p-6 animate-fade-up">
            <SectionLabel>Step 1 — Your product</SectionLabel>
            <h1 className="display text-2xl font-semibold mt-2">What did you build?</h1>
            <p className="text-xs text-ink-mute mt-1.5 mb-5">The platform derives your ICP, personas, competitors and channel map from this — be specific about the problem you solve.</p>
            <div className="space-y-3.5">
              <Field label="Product name">
                <Input value={form.name} onChange={set("name")} placeholder="Atelier" required />
              </Field>
              <Field label="Product URL" hint="Optional — helps the analysis.">
                <Input value={form.url} onChange={set("url")} placeholder="https://yourproduct.com" />
              </Field>
              <Field label="Description" hint="What does it do, and what problem does it solve? Minimum 20 characters.">
                <Textarea rows={4} value={form.description} onChange={set("description")} placeholder="Atelier generates photorealistic virtual try-on experiences for online fashion retailers, reducing returns caused by sizing uncertainty…" required minLength={20} />
              </Field>
              <div className="grid sm:grid-cols-2 gap-3.5">
                <Field label="Target customer" hint="Optional — leave blank to let the platform decide.">
                  <Input value={form.targetCustomer} onChange={set("targetCustomer")} placeholder="Online fashion retailers" />
                </Field>
                <Field label="Industry">
                  <Input value={form.industry} onChange={set("industry")} placeholder="Ecommerce / AI" />
                </Field>
              </div>
              <div className="flex justify-end pt-2">
                <Button disabled={form.name.length < 2 || form.description.length < 20} onClick={() => setStep(1)}>Continue →</Button>
                <Button disabled={form.name.trim().length < 2 || form.description.trim().length < 20} onClick={() => setStep(1)}>Continue →</Button>
              </div>
            </div>
          </Card>
        ) : null}

        {step === 1 ? (
          <Card className="p-6 animate-fade-up">
            <SectionLabel>Step 2 — Your constraints</SectionLabel>
            <h1 className="display text-2xl font-semibold mt-2">What do you have to work with?</h1>
            <p className="text-xs text-ink-mute mt-1.5 mb-5">Budget and time shape the recommended channel mix.</p>
            <div className="space-y-3.5">
              <div className="grid sm:grid-cols-2 gap-3.5">
                <Field label="Marketing budget">
                  <Select value={form.budgetBand} onChange={set("budgetBand")}>
                    <option value="NONE">No budget — time only</option>
                    <option value="LEAN">Lean — under $500/mo</option>
                    <option value="MODERATE">Moderate — $500–5k/mo</option>
                    <option value="FUNDED">Funded — $5k+/mo</option>
                  </Select>
                </Field>
                <Field label="Marketing time per week">
                  <Select value={form.timePerWeek} onChange={set("timePerWeek")}>
                    {["2", "5", "8", "12", "20"].map((h) => (
                      <option key={h} value={h}>{h} hours</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Primary geography">
                <Select value={form.geography} onChange={set("geography")}>
                  {["Global", "US", "US, EU, UK", "EU", "UK", "LATAM", "APAC", "India"].map((g) => <option key={g}>{g}</option>)}
                </Select>
              </Field>
              {error ? <div className="text-xs text-bad bg-bad-soft rounded px-3 py-2">{error}</div> : null}
              {error ? (
                <div className="text-xs text-bad bg-bad-soft rounded px-3 py-2 space-y-1">
                  <div>{error}</div>
                  <div className="text-2xs text-ink-mute">
                    Need to edit product details? Click <strong>← Back</strong> to modify Step 1.
                  </div>
                </div>
              ) : null}
              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep(0)}>← Back</Button>
                <Button onClick={analyze} disabled={loading}>{loading ? "Analyzing product…" : "Run product analysis →"}</Button>
              </div>
            </div>
          </Card>
        ) : null}

        {step === 2 && result ? (
          <Card className="p-6 animate-fade-up">
            <SectionLabel>Step 3 — Product intelligence</SectionLabel>
            <div className="flex items-start justify-between mt-2">
              <div>
                <h1 className="display text-2xl font-semibold">{result.product.name} — analyzed</h1>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge tone="accent">{result.intel.category}</Badge>
                  <Badge tone="neutral">engine: {result.intel.model}</Badge>
                  <Badge tone={result.intel.confidence >= 60 ? "good" : "warn"}>detection confidence {result.intel.confidence}</Badge>
                </div>
              </div>
              <ScoreRing score={result.intel.confidence} label="fit" />
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <div className="text-2xs font-mono uppercase tracking-wider text-ink-faint mb-1.5">Primary ICP · inference</div>
                <div className="text-sm font-medium">{result.intel.icp.name}</div>
                <div className="text-xs text-ink-mute mt-0.5">{result.intel.icp.description} · Buyer: {result.intel.icp.buyerRole}</div>
              </div>
              <div>
                <div className="text-2xs font-mono uppercase tracking-wider text-ink-faint mb-1.5">Problems solved</div>
                <div className="flex flex-wrap gap-1.5">
                  {result.intel.problems.map((p) => <Badge key={p} tone="neutral">{p}</Badge>)}
                </div>
              </div>
              <div>
                <div className="text-2xs font-mono uppercase tracking-wider text-ink-faint mb-1.5">Competitors identified</div>
                <div className="flex flex-wrap gap-1.5">
                  {result.intel.competitors.map((c) => <Badge key={c.name} tone="neutral">{c.name}</Badge>)}
                </div>
              </div>
              <div className="rounded-md bg-good-soft border border-good/15 px-4 py-3">
                <div className="text-xs font-medium text-good">Discovery complete — {result.discovery.inserted} opportunities found from {result.discovery.scanned} scanned posts.</div>
                <div className="text-2xs text-good/80 mt-0.5">Live sources (Hacker News, Reddit) will continue scanning in the background.</div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                onClick={() => {
                  router.push("/app");
                  router.refresh();
                }}
              >
                Open your command center →
              </Button>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
