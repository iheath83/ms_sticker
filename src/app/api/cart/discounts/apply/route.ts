import { NextResponse, type NextRequest } from "next/server";
import { applyDiscountCode } from "@/lib/discount-actions";

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ ok: false, error: "JSON invalide" }, { status: 400 });
  }

  const code = typeof (body as Record<string, unknown>)["code"] === "string"
    ? ((body as Record<string, unknown>)["code"] as string).trim()
    : "";

  if (!code) {
    return NextResponse.json({ ok: false, error: "Code manquant" }, { status: 400 });
  }

  const result = await applyDiscountCode(code);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error, reason: result.reason }, { status: 422 });
  }

  return NextResponse.json({ ok: true, discountCents: result.discountCents, discountTitle: result.discountTitle });
}
