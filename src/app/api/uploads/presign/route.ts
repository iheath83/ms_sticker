import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getPresignedUploadUrl, buildStorageKey } from "@/lib/storage";
import { z } from "zod";

const schema = z.object({
  orderId: z.string().uuid(),
  type: z.enum(["customer_upload", "proof", "final_artwork"]),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
});

const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/pdf",
  "application/postscript", // .ai / .eps
  "application/illustrator",
];

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });

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

  const { orderId, type, filename, mimeType } = parsed.data;

  const role = session ? (session.user as { role?: string }).role : null;

  // Only admins can upload proofs — customer_upload is open to authenticated users and guests
  if (type === "proof" && role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  // final_artwork requires authentication
  if (type === "final_artwork" && !session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return NextResponse.json(
      { error: `Type de fichier non autorisé. Types acceptés : PNG, JPG, SVG, PDF, AI/EPS` },
      { status: 400 },
    );
  }

  const key = buildStorageKey(orderId, type, filename);

  try {
    const uploadUrl = await getPresignedUploadUrl(key);
    return NextResponse.json({
      uploadUrl,
      key,
      maxSizeBytes: MAX_SIZE_BYTES,
    });
  } catch (err) {
    console.error("[presign] MinIO error:", err);
    return NextResponse.json({ error: "Impossible de générer l'URL d'upload" }, { status: 500 });
  }
}
