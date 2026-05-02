import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { callCutlineService } from "@/lib/sticker-editor/cutline-service";
import { checkRateLimit } from "@/lib/rate-limit";

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const rl = await checkRateLimit(`sticker-cutline:${ip}`, 30, 5 * 60);
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

  const offsetPxRaw = form.get("offset_px");
  const offsetPx =
    offsetPxRaw !== null
      ? Math.max(0, Math.min(2000, Number(offsetPxRaw)))
      : undefined;
  const offsetMm = Math.max(0, Math.min(20, Number(form.get("offset_mm") ?? 2)));
  const dpi = Math.max(72, Math.min(2400, Number(form.get("dpi") ?? 300)));
  const closeRadiusPx = form.get("close_radius_px")
    ? Math.max(0, Math.min(64, Number(form.get("close_radius_px"))))
    : undefined;
  const smoothPasses = form.get("smooth_passes")
    ? Math.max(0, Math.min(12, Number(form.get("smooth_passes"))))
    : undefined;

  const filename =
    file instanceof File && file.name ? file.name : "image.png";

  try {
    const result = await callCutlineService({
      file,
      filename,
      ...(offsetPx !== undefined ? { offsetPx } : { offsetMm, dpi }),
      ...(closeRadiusPx !== undefined ? { closeRadiusPx } : {}),
      ...(smoothPasses !== undefined ? { smoothPasses } : {}),
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/sticker-editor/cutline] service error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "service_unavailable",
        message: "Le service de génération de contour est temporairement indisponible.",
      },
      { status: 502 },
    );
  }
}

export const runtime = "nodejs";
