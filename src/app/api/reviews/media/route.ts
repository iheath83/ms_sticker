import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  filename: z.string(),
  contentType: z.string().regex(/^image\/(jpeg|jpg|png|webp|gif)$/),
  folder: z.string().optional().default("reviews"),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  // Reuse the existing presign endpoint logic
  const { getPresignedUploadUrl } = await import("@/lib/storage");
  const { filename, contentType, folder } = parsed.data;

  const ext = filename.split(".").pop() ?? "jpg";
  const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const presignedUrl = await getPresignedUploadUrl(key);
  const publicUrl = `${process.env.MINIO_ENDPOINT ?? "https://minio.msadhesif.fr"}/${process.env.MINIO_BUCKET ?? "ms-sticker"}/${key}`;

  return NextResponse.json({ presignedUrl, key, publicUrl });
}
