/**
 * Premium data visualization (spec §19): lightweight dependency-free SVG charts
 * with a restrained, editorial feel — tabular numerals, muted grid, no neon.
 */

import { useId } from "react";
import { cn } from "@/lib/utils";

export function LineChart({
  data,
  height = 140,
  color = "#1a56db",
  fill = true,
  className,
  labels,
}: {
  data: number[];
  height?: number;
  color?: string;
  fill?: boolean;
  className?: string;
  labels?: string[];
}) {
  const gid = useId().replace(/:/g, "");
  const w = 560;
  const h = height;
  const pad = 6;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = pad + (i / Math.max(1, data.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / range) * (h - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1]?.[0] ?? 0},${h - pad} L${pts[0]?.[0] ?? 0},${h - pad} Z`;
  return (
    <div className={cn("w-full", className)}>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none" role="img">
        <defs>
          <linearGradient id={`g-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.16} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={pad} x2={w - pad} y1={pad + f * (h - pad * 2)} y2={pad + f * (h - pad * 2)} stroke="#eeece9" strokeWidth={1} />
        ))}
        {fill ? <path d={area} fill={`url(#g-${gid})`} /> : null}
        <path d={line} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
        {pts.length > 0 ? <circle cx={pts[pts.length - 1]![0]} cy={pts[pts.length - 1]![1]} r={3} fill={color} /> : null}
      </svg>
      {labels ? (
        <div className="flex justify-between text-2xs font-mono text-ink-faint px-1 mt-1">
          {labels.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function HBar({
  label,
  value,
  max = 100,
  suffix,
  tone = "auto",
  sublabel,
}: {
  label: string;
  value: number;
  max?: number;
  suffix?: string;
  tone?: "auto" | "accent" | "ink";
  sublabel?: string;
}) {
  const pct = Math.max(2, Math.min(100, (value / max) * 100));
  const color = tone === "accent" ? "#1a56db" : tone === "ink" ? "#141210" : value >= 75 ? "#0f7b4f" : value >= 50 ? "#9a6700" : "#c03434";
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="w-28 shrink-0 min-w-0">
        <div className="text-xs text-ink-soft truncate">{label}</div>
        {sublabel ? <div className="text-2xs text-ink-faint truncate">{sublabel}</div> : null}
      </div>
      <div className="flex-1 min-w-3 h-2 rounded-full bg-paper-sunken overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <div className="data-num text-xs text-ink-soft w-10 text-right shrink-0">
        {suffix ?? value}
      </div>
    </div>
  );
}

export function FunnelChart({ stages }: { stages: { label: string; value: number; hint?: string }[] }) {
  const max = Math.max(...stages.map((s) => s.value), 1);
  return (
    <div className="space-y-2.5">
      {stages.map((s, i) => {
        const pct = (s.value / max) * 100;
        const prev = i > 0 ? stages[i - 1]!.value : null;
        const conv = prev && prev > 0 ? `${Math.round((s.value / prev) * 100)}%` : null;
        return (
          <div key={s.label} className="flex items-center gap-3">
            <div className="w-24 shrink-0 text-xs text-ink-soft">{s.label}</div>
            <div className="flex-1 h-7 rounded-md bg-paper-sunken overflow-hidden relative">
              <div
                className="h-full rounded-md flex items-center px-2.5"
                style={{
                  width: `${Math.max(3, pct)}%`,
                  backgroundColor: `rgba(26, 86, 219, ${0.85 - i * 0.13})`,
                }}
              >
                {pct >= 22 ? <span className="data-num text-2xs font-medium text-white whitespace-nowrap">{s.value.toLocaleString()}</span> : null}
              </div>
              {pct < 22 ? (
                <span
                  className="data-num text-2xs font-medium text-ink-soft absolute top-1/2 -translate-y-1/2 whitespace-nowrap"
                  style={{ left: `calc(${Math.max(3, pct)}% + 8px)` }}
                >
                  {s.value.toLocaleString()}
                </span>
              ) : null}
            </div>
            <div className="w-12 text-right text-2xs font-mono text-ink-faint">{conv ?? "—"}</div>
          </div>
        );
      })}
    </div>
  );
}

export function ScoreBars({ components }: { components: { key: string; label: string; score: number }[] }) {
  return (
    <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
      {components.map((c) => (
        <HBar key={c.key} label={c.label} value={c.score} />
      ))}
    </div>
  );
}

export function Donut({ segments, size = 120 }: { segments: { label: string; value: number; color: string }[]; size?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} className="-rotate-90">
      {segments.map((s) => {
        const frac = s.value / total;
        const dash = frac * c;
        const el = (
          <circle
            key={s.label}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={10}
            strokeDasharray={`${dash} ${c - dash}`}
            strokeDashoffset={-offset}
          />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
}

export function Sparkline({ data, color = "#0f7b4f", width = 72, height = 22 }: { data: number[]; color?: string; width?: number; height?: number }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / Math.max(1, data.length - 1)) * width},${height - ((v - min) / range) * height}`).join(" ");
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
