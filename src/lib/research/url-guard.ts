/**
 * URL guard for user-supplied product URLs before they are handed to the
 * site-fetch stage. Blocks non-HTTP schemes, unusual ports, and hosts that
 * resolve to private/loopback/link-local space (SSRF protection).
 */

import { lookup } from "dns/promises";

const PRIVATE_V4_RANGES: [string, number][] = [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["224.0.0.0", 3], // multicast + reserved (224.0.0.0/3 covers 224-255)
];

function ipToLong(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    const v = Number(part);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

/** True if the IPv4/IPv6 address is globally routable (not private/reserved). */
export function isPublicIp(ip: string): boolean {
  if (ip.includes(":")) {
    const low = ip.toLowerCase();
    if (low === "::1" || low === "::" || low.startsWith("fe80:") || low.startsWith("fc") || low.startsWith("fd") || low.startsWith("::ffff:127.")) return false;
    return true;
  }
  const n = ipToLong(ip);
  if (n === null) return false;
  for (const [base, bits] of PRIVATE_V4_RANGES) {
    const baseN = ipToLong(base);
    if (baseN === null) continue;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    if ((n & mask) === (baseN & mask)) return false;
  }
  return true;
}

/** Synchronous syntax + scheme + host-shape check. Returns the parsed URL or a reason. */
export function urlSyntaxGuard(raw: string): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "not a valid URL" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, reason: `scheme ${url.protocol} not allowed` };
  if (url.port && url.port !== "80" && url.port !== "443") return { ok: false, reason: `port ${url.port} not allowed` };
  const host = url.hostname.toLowerCase();
  if (!host || host.length > 253) return { ok: false, reason: "invalid hostname" };
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".home.arpa")
  ) {
    return { ok: false, reason: "private hostname not allowed" };
  }
  // Bare IP literal: check ranges directly (no DNS to resolve).
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
    return isPublicIp(host) ? { ok: true, url } : { ok: false, reason: "private/reserved IP not allowed" };
  }
  return { ok: true, url };
}

/** Full check: syntax guard plus DNS resolution to public addresses only. */
export async function isPublicHttpUrl(raw: string): Promise<boolean> {
  const guarded = urlSyntaxGuard(raw);
  if (!guarded.ok) return false;
  try {
    const addrs = await lookup(guarded.url.hostname, { all: true });
    return addrs.length > 0 && addrs.every((a) => isPublicIp(a.address));
  } catch {
    return false; // unresolvable host — nothing to scrape
  }
}
