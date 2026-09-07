/**
 * Content image management.
 *  - multipart POST: upload a real image file (png/jpeg/webp/gif, ≤5MB) — stored
 *    locally, served via /api/uploads, validated by magic bytes (not just MIME).
 *  - JSON POST {"prompt"?}: generate an AI banner for the draft. Raster image
 *    models are not available on the free NIM chat tier, so the LLM composes a
 *    clean, sanitized SVG banner (16:9) from the draft's title/body instead.
 *  - DELETE: remove the image (file + field).
 */
import { NextResponse } from "next/server";
import { requireApi } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import {
  ALLOWED_MIME,
  MAX_UPLOAD_BYTES,
  deleteUploadByUrl,
  detectImageExt,
  sanitizeSvg,
  saveImage,
} from "@/lib/uploads";
import { tryAI } from "@/lib/ai/provider";
import { spendCredits } from "@/lib/usage";

type RouteContext = { params: { id: string } };

async function loadContent(req: Request, { params }: RouteContext) {
  const auth = await requireApi();
  const content = await prisma.content.findFirst({ where: { id: params.id, orgId: auth.orgId } });
  if (!content) return { error: NextResponse.json({ error: { code: "NOT_FOUND", message: "Content not found" } }, { status: 404 }) } as const;
  return { auth, content } as const;
}

export async function POST(req: Request, ctx: RouteContext) {
  const loaded = await loadContent(req, ctx);
  if ("error" in loaded) return loaded.error;
  const { auth, content } = loaded;
  const contentType = req.headers.get("content-type") ?? "";

  // ── AI banner generation (JSON) ───────────────────────────────────────────
  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as { prompt?: string };
    const basis = body.prompt?.trim()
      ? body.prompt.trim()
      : `${content.title}. ${content.body.slice(0, 400)}`;
    const svg = await tryAI(
      async (ai) => {
        const text = await ai.complete({
          system: `You design clean, minimal SVG banner graphics (1200x675, 16:9) for marketing content.
Rules: off-white background (#FAFAF8 or similar), dark ink text (#1A1A1A), one restrained accent color; 2-4 geometric shapes with soft fills; a short headline using the given topic (max ~6 words, system-safe font stack like Arial/Helvetica); generous whitespace; no photos, no external references, no gradients heavier than subtle.
Return ONLY the raw <svg> markup — no markdown fences, no commentary.`,
          messages: [{ role: "user", content: `Design the banner for this content:\n${basis.slice(0, 600)}` }],
          temperature: 0.5,
          maxTokens: 1800,
        });
        return text;
      },
      { label: "image-banner" }
    );
    const clean = svg ? sanitizeSvg(svg) : null;
    if (!clean) {
      return NextResponse.json({ error: { code: "GENERATION_FAILED", message: "AI banner generation failed — try again or upload an image instead" } }, { status: 502 });
    }
    const url = saveImage(Buffer.from(clean, "utf8"), "svg");
    deleteUploadByUrl(content.imageUrl);
    await prisma.content.update({ where: { id: content.id }, data: { imageUrl: url } });
    await spendCredits(auth.orgId, 5, { kind: "image", contentId: content.id }).catch(() => undefined);
    return NextResponse.json({ imageUrl: url, kind: "generated" });
  }

  // ── File upload (multipart) ───────────────────────────────────────────────
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "multipart form with a 'file' field required" } }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: { code: "TOO_LARGE", message: "Image must be 5MB or smaller" } }, { status: 413 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = detectImageExt(bytes);
  if (!ext || !ALLOWED_MIME.has(`image/${ext === "jpg" ? "jpeg" : ext}`)) {
    return NextResponse.json({ error: { code: "UNSUPPORTED", message: "Only PNG, JPEG, WebP or GIF images are supported" } }, { status: 415 });
  }
  const url = saveImage(bytes, ext);
  deleteUploadByUrl(content.imageUrl);
  await prisma.content.update({ where: { id: content.id }, data: { imageUrl: url } });
  return NextResponse.json({ imageUrl: url, kind: "uploaded" });
}

export async function DELETE(req: Request, ctx: RouteContext) {
  const loaded = await loadContent(req, ctx);
  if ("error" in loaded) return loaded.error;
  const { content } = loaded;
  deleteUploadByUrl(content.imageUrl);
  await prisma.content.update({ where: { id: content.id }, data: { imageUrl: null } });
  return NextResponse.json({ ok: true });
}
