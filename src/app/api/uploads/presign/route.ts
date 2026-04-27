import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getPresignedUploadUrl, buildStorageKey } from "@/lib/storage";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

const schema = z.object({
  orderId:   z.string().uuid(),
  type:      z.enum(["customer_upload", "proof", "final_artwork"]),
  filename:  z.string().min(1).max(255),
  mimeType:  z.string().min(1).max(100),
  sizeBytes: z.number().int().positive().max(MAX_SIZE_BYTES, "Fichier trop volumineux (max 50 Mo)"),
});

const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/pdf",
  "application/postscript",
  "application/illustrator",
];

export async function POST(request: NextRequest) {
  // ── Authentication required for all upload types ───────────────────────────
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const role = (session.user as { role?: string }).role;

  // ── Rate limiting: 20 presigned URLs / 5 min per user ─────────────────────
  const rateLimitKey = `presign:${session.user.id}`;
  const rl = await checkRateLimit(rateLimitKey, 20, 5 * 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessayez dans quelques minutes." },
      {
        status: 429,
        headers: { "Retry-After": rl.retryAfter ?? "" },
      },
    );
  }

  // ── Parse and validate body ────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides" },
      { status: 400 },
    );
  }

  const { orderId, type, filename, mimeType, sizeBytes } = parsed.data;

  // ── Role-based type restrictions ───────────────────────────────────────────
  if (type === "proof" && role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  if (type === "final_artwork" && role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  // ── MIME type whitelist ────────────────────────────────────────────────────
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return NextResponse.json(
      { error: "Type de fichier non autorisé. Types acceptés : PNG, JPG, SVG, PDF, AI/EPS" },
      { status: 400 },
    );
  }

  // ── Declared size guard (client-declared; real enforcement via S3 policy) ──
  if (sizeBytes > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "Fichier trop volumineux (max 50 Mo)" },
      { status: 413 },
    );
  }

  const key = buildStorageKey(orderId, type, filename);

  try {
    const uploadUrl = await getPresignedUploadUrl(key, sizeBytes);
    return NextResponse.json({ uploadUrl, key, maxSizeBytes: MAX_SIZE_BYTES });
  } catch (err) {
    console.error("[presign] MinIO error:", err);
    return NextResponse.json({ error: "Impossible de générer l'URL d'upload" }, { status: 500 });
  }
}
