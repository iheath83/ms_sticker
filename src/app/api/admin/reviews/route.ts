import { NextRequest, NextResponse } from "next/server";
import { getAdminReviews } from "@/lib/review-actions";
import type { AdminReviewFilters } from "@/lib/reviews/review-types";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const statusParam = url.searchParams.get("status");
    const typeParam = url.searchParams.get("type");
    const ratingParam = url.searchParams.get("rating");
    const pageParam = url.searchParams.get("page");
    const limitParam = url.searchParams.get("limit");

    const filters: AdminReviewFilters = {};
    if (statusParam) filters.status = statusParam as AdminReviewFilters["status"];
    if (typeParam) filters.type = typeParam as AdminReviewFilters["type"];
    if (ratingParam) filters.rating = parseInt(ratingParam, 10);
    if (url.searchParams.get("withMedia") === "true") filters.withMedia = true;
    const productId = url.searchParams.get("productId");
    if (productId) filters.productId = productId;
    const dateFrom = url.searchParams.get("dateFrom");
    if (dateFrom) filters.dateFrom = dateFrom;
    const dateTo = url.searchParams.get("dateTo");
    if (dateTo) filters.dateTo = dateTo;
    const q = url.searchParams.get("q");
    if (q) filters.q = q;
    if (pageParam) filters.page = parseInt(pageParam, 10);
    if (limitParam) filters.limit = parseInt(limitParam, 10);

    const result = await getAdminReviews(filters);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erreur" }, { status: 401 });
  }
}
