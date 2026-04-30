import { NextRequest, NextResponse } from "next/server";
import { getAdminReviewRequests, createManualReviewRequest } from "@/lib/review-actions";
import type { AdminReviewRequestFilters } from "@/lib/reviews/review-types";
import { z } from "zod";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const filters: AdminReviewRequestFilters = {};
    const statusParam = url.searchParams.get("status");
    if (statusParam) filters.status = statusParam as AdminReviewRequestFilters["status"];
    const orderId = url.searchParams.get("orderId");
    if (orderId) filters.orderId = orderId;
    const q = url.searchParams.get("q");
    if (q) filters.q = q;
    const pageParam = url.searchParams.get("page");
    if (pageParam) filters.page = parseInt(pageParam, 10);
    const limitParam = url.searchParams.get("limit");
    if (limitParam) filters.limit = parseInt(limitParam, 10);

    const result = await getAdminReviewRequests(filters);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erreur" }, { status: 401 });
  }
}

const postSchema = z.object({
  orderId: z.string().uuid(),
  sendAt: z.string().datetime().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = postSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

    const sendAt = parsed.data.sendAt ? new Date(parsed.data.sendAt) : undefined;
    await createManualReviewRequest(parsed.data.orderId, sendAt);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erreur" }, { status: 400 });
  }
}
