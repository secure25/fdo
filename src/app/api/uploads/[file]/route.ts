import { NextResponse } from "next/server";
import { readUpload, resolveUploadPath } from "@/lib/uploads";

/** Serves content images from data/uploads. Filenames are strictly validated. */
export async function GET(_req: Request, { params }: { params: { file: string } }) {
  const path = resolveUploadPath(params.file);
  if (!path) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const file = readUpload(path);
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
