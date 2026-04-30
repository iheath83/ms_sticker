import { NextRequest, NextResponse } from "next/server";
import { replyToReview } from "@/lib/review-actions";
import { z } from "zod";

const schema = z.object({ body: z.string().min(1) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

    await replyToReview(id, parsed.data.body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erreur" }, { status: 401 });
  }
}
