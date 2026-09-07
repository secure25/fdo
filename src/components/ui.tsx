import { cn, scoreTone } from "@/lib/utils";

// ─── Buttons ──────────────────────────────────────────────────────────────────

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 font-medium transition-colors rounded-md disabled:opacity-50 disabled:cursor-not-allowed",
        size === "sm" && "text-xs px-2.5 h-7",
        size === "md" && "text-sm px-3.5 h-9",
        size === "lg" && "text-[15px] px-5 h-11",
        variant === "primary" && "bg-ink text-white hover:bg-ink-soft",
        variant === "secondary" && "bg-paper-raise text-ink shadow-card hover:bg-paper-sunken",
        variant === "ghost" && "text-ink-soft hover:bg-paper-sunken",
        variant === "danger" && "bg-bad text-white hover:opacity-90",
        className
      )}
      {...props}
    />
  );
}

// ─── Cards & layout primitives ────────────────────────────────────────────────

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("bg-paper-raise rounded-lg shadow-card", className)}>{children}</div>;
}

export function CardHeader({ title, subtitle, action, className }: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-paper-line", className)}>
      <div>
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {subtitle ? <p className="text-2xs text-ink-mute mt-0.5">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("text-2xs font-mono uppercase tracking-[0.14em] text-ink-faint", className)}>{children}</div>
  );
}

// ─── Badges ───────────────────────────────────────────────────────────────────

export function Badge({ children, tone = "neutral", className }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "bad" | "urgent" | "accent"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs font-medium whitespace-nowrap",
        tone === "neutral" && "bg-paper-sunken text-ink-mute",
        tone === "good" && "bg-good-soft text-good",
        tone === "warn" && "bg-warn-soft text-warn",
        tone === "bad" && "bg-bad-soft text-bad",
        tone === "urgent" && "bg-urgent-soft text-urgent",
        tone === "accent" && "bg-accent-soft text-accent",
        className
      )}
    >
      {children}
    </span>
  );
}

export function BandBadge({ band }: { band: string }) {
  const tone = band === "VERY_HIGH" ? "urgent" : band === "HIGH" ? "good" : band === "MEDIUM" ? "warn" : "neutral";
  const label = band === "VERY_HIGH" ? "Very High" : band === "HIGH" ? "High" : band === "MEDIUM" ? "Medium" : "Low";
  return <Badge tone={tone}>{label}</Badge>;
}

// ─── Score display ────────────────────────────────────────────────────────────

export function ScoreNum({ score, className }: { score: number; className?: string }) {
  const tone = scoreTone(score);
  return (
    <span className={cn("data-num font-semibold", tone === "good" && "text-good", tone === "warn" && "text-warn", tone === "bad" && "text-bad", className)}>
      {score}
    </span>
  );
}

export function ScoreRing({ score, size = 44, label }: { score: number; size?: number; label?: string }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const filled = (score / 100) * c;
  const tone = scoreTone(score);
  const color = tone === "good" ? "#0f7b4f" : tone === "warn" ? "#9a6700" : "#c03434";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eeece9" strokeWidth={4} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4} strokeDasharray={`${filled} ${c}`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="data-num font-semibold leading-none" style={{ fontSize: size / 3.4, color }}>
          {score}
        </span>
        {label ? <span className="text-[8px] uppercase tracking-wider text-ink-faint mt-0.5">{label}</span> : null}
      </div>
    </div>
  );
}

export function ProgressBar({ value, tone = "auto", className }: { value: number; tone?: "auto" | "accent"; className?: string }) {
  const toneClass = tone === "accent" ? "bg-accent" : scoreTone(value) === "good" ? "bg-good" : scoreTone(value) === "warn" ? "bg-warn" : "bg-bad";
  return (
    <div className={cn("h-1.5 rounded-full bg-paper-sunken overflow-hidden", className)}>
      <div className={cn("h-full rounded-full transition-all", toneClass)} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  );
}

// ─── Stat ─────────────────────────────────────────────────────────────────────

export function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "good" | "warn" | "bad" }) {
  return (
    <div>
      <div className="text-2xs uppercase tracking-[0.12em] text-ink-faint font-mono">{label}</div>
      <div className={cn("data-num text-2xl font-semibold mt-1 tracking-tight", tone === "good" && "text-good", tone === "warn" && "text-warn", tone === "bad" && "text-bad")}>
        {value}
      </div>
      {sub ? <div className="text-2xs text-ink-mute mt-0.5">{sub}</div> : null}
    </div>
  );
}

// ─── Inputs ───────────────────────────────────────────────────────────────────

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full h-9 rounded-md border border-paper-line bg-paper-raise px-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent/25 focus:border-accent/50 transition",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-md border border-paper-line bg-paper-raise px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent/25 focus:border-accent/50 transition resize-y",
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-9 rounded-md border border-paper-line bg-paper-raise px-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/25 transition",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-ink-soft mb-1.5">{label}</span>
      {children}
      {hint ? <span className="block text-2xs text-ink-faint mt-1">{hint}</span> : null}
    </label>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="text-sm font-semibold text-ink">{title}</div>
      <p className="text-sm text-ink-mute mt-1.5 max-w-md">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

// ─── Table helpers ────────────────────────────────────────────────────────────

export function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn("text-left font-mono text-2xs uppercase tracking-[0.12em] text-ink-faint font-medium px-4 py-2.5 border-b border-paper-line", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 text-sm border-b border-paper-line/60 align-middle", className)}>{children}</td>;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/25 p-4 pt-[8vh]" onMouseDown={onClose}>
      <div
        className={cn("bg-paper-raise rounded-lg shadow-popover w-full animate-fade-up", wide ? "max-w-3xl" : "max-w-lg")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-paper-line">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button onClick={onClose} className="text-ink-faint hover:text-ink transition text-lg leading-none px-1" aria-label="Close">
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Verified / Inference tags (spec §22) ─────────────────────────────────────

export function EpistemicTag({ kind }: { kind: "VERIFIED" | "INFERENCE" | "RECOMMENDATION" }) {
  return (
    <Badge tone={kind === "VERIFIED" ? "good" : kind === "INFERENCE" ? "neutral" : "accent"}>
      {kind === "VERIFIED" ? "Verified" : kind === "INFERENCE" ? "Inference" : "Recommendation"}
    </Badge>
  );
}
