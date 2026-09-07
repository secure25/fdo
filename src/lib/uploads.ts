/**
 * Local file storage for content images. Files live in `data/uploads`
 * (outside /public so access always goes through the API route) and are
 * served by GET /api/uploads/[file] with a strict filename allow-list.
 */

import { randomBytes } from "crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { join, resolve } from "path";

const EXT_TO_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
};

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

function uploadsDir(): string {
  const dir = resolve(process.cwd(), "data", "uploads");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

/** Detect the real extension from magic bytes; null when not a supported raster image. */
export function detectImageExt(bytes: Buffer): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.slice(0, 6).toString("latin1") === "GIF87a" || bytes.slice(0, 6).toString("latin1") === "GIF89a") return "gif";
  if (bytes.slice(0, 4).toString("latin1") === "RIFF" && bytes.slice(8, 12).toString("latin1") === "WEBP") return "webp";
  return null;
}

/** Persist bytes under a random, extension-validated name. Returns the public URL path. */
export function saveImage(bytes: Buffer, ext: string): string {
  const safeExt = EXT_TO_MIME[ext] ? ext : null;
  if (!safeExt) throw new Error(`unsupported image extension: ${ext}`);
  const name = `${Date.now().toString(36)}-${randomBytes(8).toString("hex")}.${safeExt}`;
  writeFileSync(join(uploadsDir(), name), bytes);
  return `/api/uploads/${name}`;
}

/** Resolve a requested upload filename to a path inside the uploads dir, or null. */
export function resolveUploadPath(name: string): string | null {
  if (!/^[a-z0-9-]+\.(png|jpe?g|webp|gif|svg)$/i.test(name)) return null;
  const path = resolve(uploadsDir(), name);
  if (!path.startsWith(uploadsDir())) return null;
  return existsSync(path) ? path : null;
}

export function readUpload(path: string): { bytes: Buffer; mime: string } | null {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const mime = EXT_TO_MIME[ext];
  if (!mime) return null;
  return { bytes: readFileSync(path), mime };
}

export function deleteUploadByUrl(url: string | null | undefined): void {
  if (!url || !url.startsWith("/api/uploads/")) return;
  const name = url.slice("/api/uploads/".length);
  const path = resolveUploadPath(name);
  if (path) {
    try {
      unlinkSync(path);
    } catch {
      // already gone — fine
    }
  }
}

/** Strip scripts, event handlers and external references from LLM-produced SVG. */
export function sanitizeSvg(svg: string): string | null {
  const start = svg.search(/<svg[\s>]/);
  const end = svg.lastIndexOf("</svg>");
  if (start === -1 || end === -1 || end <= start) return null;
  let s = svg.slice(start, end + 6);
  const before = s;
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  s = s.replace(/(href|xlink:href)\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, "");
  s = s.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "");
  // Fail closed: any residual dangerous pattern rejects the SVG entirely.
  if (/<script|on\w+\s*=|javascript:/i.test(s)) return null;
  return s;
}
