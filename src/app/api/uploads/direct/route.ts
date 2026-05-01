import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { uploadStream } from "@/lib/storage";
import { checkRateLimit } from "@/lib/rate-limit";
import { Readable } from "node:stream";

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

const ALLOWED_MIME_TYPES = new Set([
  "image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml",
  "application/pdf", "application/postscript", "application/illustrator",
  "application/octet-stream", // AI/EPS often arrive as octet-stream
]);

export async function POST(request: NextRequest) {
  // Rate limit by IP
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const rl = await checkRateLimit(`upload-direct:${ip}`, 30, 5 * 60);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Fichier trop volumineux (max 50 Mo)" }, { status: 413 });
  }

  const mimeType = request.headers.get("x-file-mime") ?? "application/octet-stream";
  const filename = decodeURIComponent(request.headers.get("x-file-name") ?? "fichier");
  // Key is pre-computed server-side by prepareFileUpload and passed here
  const key = request.headers.get("x-storage-key");

  if (!key) {
    return NextResponse.json({ error: "Clé de stockage manquante" }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return NextResponse.json({ error: "Type de fichier non autorisé (PNG, JPG, SVG, PDF, AI, EPS)" }, { status: 400 });
  }

  if (!request.body) {
    return NextResponse.json({ error: "Corps de requête manquant" }, { status: 400 });
  }

  try {
    const nodeStream = Readable.fromWeb(
      request.body as Parameters<typeof Readable.fromWeb>[0],
    );
    await uploadStream(key!, nodeStream, contentLength || undefined, mimeType);
    return NextResponse.json({ key, filename, mimeType, sizeBytes: contentLength });
  } catch (err) {
    console.error("[upload/direct] MinIO error:", err);
    return NextResponse.json({ error: "Erreur de stockage du fichier" }, { status: 500 });
  }
}
