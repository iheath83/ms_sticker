import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { callBackgroundRemoveService } from "@/lib/sticker-editor/cutline-service";
import { checkRateLimit } from "@/lib/rate-limit";

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  // Plus restrictif que la cutline car rembg est plus coûteux (CPU intensif)
  const rl = await checkRateLimit(`sticker-bgremove:${ip}`, 12, 5 * 60);
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
    file instanceof File && file.name ? file.name : "image.png";

  try {
    const result = await callBackgroundRemoveService(file, filename);
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
        "Content-Disposition": "inline; filename=\"no-bg.png\"",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[/api/sticker-editor/background-remove] service error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "service_unavailable",
        message:
          "Le service de suppression de fond est temporairement indisponible.",
      },
      { status: 502 },
    );
  }
}

export const runtime = "nodejs";
