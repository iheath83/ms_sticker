import { NextResponse } from "next/server";
import { removeDiscountCode } from "@/lib/discount-actions";

export async function DELETE() {
  await removeDiscountCode();
  return NextResponse.json({ ok: true });
}
