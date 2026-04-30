import { NextRequest, NextResponse } from "next/server";
import { getAdminReview, publishReview, rejectReview, archiveReview } from "@/lib/review-actions";
import { z } from "zod";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const review = await getAdminReview(id);
    if (!review) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    return NextResponse.json(review);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erreur" }, { status: 401 });
  }
}

const patchSchema = z.object({
  action: z.enum(["publish", "reject", "archive"]),
  reason: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

    if (parsed.data.action === "publish") await publishReview(id);
    else if (parsed.data.action === "reject") await rejectReview(id, parsed.data.reason);
    else await archiveReview(id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erreur" }, { status: 401 });
  }
}
