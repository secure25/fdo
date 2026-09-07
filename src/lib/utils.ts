import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/** Human label for a future timestamp ("in 2h"); falls back to timeAgo phrasing for past dates. */
export function timeUntil(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = d.getTime() - Date.now();
  if (diff <= 0) return timeAgo(d);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `in ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `in ${h}h`;
  return `in ${Math.floor(h / 24)}d`;
}

export function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const s = Math.max(1, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtNum(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function fmtMoney(cents: number, opts: { compact?: boolean } = {}): string {
  if (opts.compact && Math.abs(cents) >= 100_000) {
    return `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(cents / 100_000)}k`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function fmtPct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function bandLabel(band: string): string {
  switch (band) {
    case "VERY_HIGH": return "Very High";
    case "HIGH": return "High";
    case "MEDIUM": return "Medium";
    default: return "Low";
  }
}

export function scoreTone(score: number): "good" | "warn" | "bad" {
  if (score >= 75) return "good";
  if (score >= 50) return "warn";
  return "bad";
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48) || "org";
}

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysAgo(n: number, hoursOffset = 0): Date {
  return new Date(Date.now() - n * 24 * 3600 * 1000 - hoursOffset * 3600 * 1000);
}
