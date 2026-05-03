import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { callRasterizeService } from "@/lib/sticker-editor/cutline-service";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Proxy de rasterisation : transforme PDF/AI/EPS/PSD en PNG d'aperçu côté
 * serveur via le microservice Python (poppler / Ghostscript / Pillow).
 *
 * Le client envoie un FormData :
 *  - file: Blob du fichier original
 * Réponse : binaire image/png prêt à être chargé dans le canvas.
 */

const MAX_BYTES = 30 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  // Plus permissif que rembg car la rasterisation est plus rapide.
  const rl = await checkRateLimit(`sticker-rasterize:${ip}`, 30, 5 * 60);
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_form" },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json(
      { ok: false, error: "missing_file" },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "file_too_large" },
      { status: 413 },
    );
  }

  const filename =
    file instanceof File && file.name ? file.name : "upload.bin";

  // Validation extension côté Next.js (cohérence avec l'éditeur).
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (!["pdf", "ai", "eps", "psd"].includes(ext)) {
    return NextResponse.json(
      { ok: false, error: "unsupported_extension", message: `Extension non supportée : .${ext}` },
      { status: 400 },
    );
  }

  try {
    const result = await callRasterizeService(file, filename);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error, message: result.message },
        { status: 500 },
      );
    }
    return new NextResponse(result.png, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": "inline; filename=\"preview.png\"",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[/api/sticker-editor/rasterize] service error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "service_unavailable",
        message:
          "Le service de rasterisation est temporairement indisponible.",
      },
      { status: 502 },
    );
  }
}

export const runtime = "nodejs";
