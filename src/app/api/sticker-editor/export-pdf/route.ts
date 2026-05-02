import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSiteSettingsQuery } from "@/lib/settings-queries";
import { buildProductionPdf } from "@/lib/sticker-editor/pdf-export";

const MAX_BYTES = 30 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";

  // ── Toggle back-office : refus immédiat si désactivé ──
  const settings = await getSiteSettingsQuery();
  if (!settings.enableProductionDownload) {
    return NextResponse.json({ ok: false, error: "disabled" }, { status: 403 });
  }

  // 20 PDF / 5 min suffisent largement pour des tests internes.
  const rl = await checkRateLimit(`sticker-export-pdf:${ip}`, 20, 5 * 60);
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

  const widthMm = clampNum(form.get("width_mm"), 5, 2000);
  const heightMm = clampNum(form.get("height_mm"), 5, 2000);
  const imgCx = clampNum(form.get("image_center_x_mm"), -2000, 4000);
  const imgCy = clampNum(form.get("image_center_y_mm"), -2000, 4000);
  const imgW = clampNum(form.get("image_width_mm"), 1, 4000);
  const imgH = clampNum(form.get("image_height_mm"), 1, 4000);
  const rotation = Number(form.get("image_rotation_deg") ?? 0);

  if ([widthMm, heightMm, imgCx, imgCy, imgW, imgH].some((v) => Number.isNaN(v))) {
    return NextResponse.json(
      { ok: false, error: "invalid_dimensions" },
      { status: 400 },
    );
  }

  const cutPath = String(form.get("cut_path_mm") ?? "").trim();
  if (!cutPath) {
    return NextResponse.json(
      { ok: false, error: "missing_cut_path" },
      { status: 400 },
    );
  }

  const mime = (file.type || "image/png").toLowerCase();
  if (mime !== "image/png" && mime !== "image/jpeg") {
    return NextResponse.json(
      { ok: false, error: "unsupported_image_mime" },
      { status: 415 },
    );
  }

  const filename =
    file instanceof File && file.name ? file.name : "sticker.png";
  const productName = String(form.get("product_name") ?? "Sticker").slice(0, 120);

  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    const pdf = await buildProductionPdf({
      imageBytes: buf,
      imageMime: mime as "image/png" | "image/jpeg",
      widthMm,
      heightMm,
      image: {
        centerXmm: imgCx,
        centerYmm: imgCy,
        widthMm: imgW,
        heightMm: imgH,
        rotationDeg: Number.isFinite(rotation) ? rotation : 0,
      },
      cutPathMm: cutPath,
      metadata: { title: productName, filename },
    });

    const safeName = filename.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "_");
    const downloadName = `${safeName || "sticker"}-prod.pdf`;

    // Réponse binaire (Uint8Array compatible Web Response)
    return new NextResponse(buf2blob(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${downloadName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error("[/api/sticker-editor/export-pdf] error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
        message: `Erreur lors de la génération du PDF : ${detail}`,
      },
      { status: 500 },
    );
  }
}

function clampNum(v: FormDataEntryValue | null, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return Number.NaN;
  return Math.max(min, Math.min(max, n));
}

function buf2blob(bytes: Uint8Array): Blob {
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
}

export const runtime = "nodejs";
