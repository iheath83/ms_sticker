import { NextRequest, NextResponse } from "next/server";
import { getReviewSettings, updateReviewSettings } from "@/lib/review-actions";

export async function GET() {
  try {
    const settings = await getReviewSettings();
    return NextResponse.json(settings);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erreur" }, { status: 401 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    await updateReviewSettings(body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erreur" }, { status: 400 });
  }
}
