/**
 * GET /api/reviews/store
 * Public endpoint returning published store reviews.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reviews, reviewAggregates } from "@/db/schema";
import { eq, and, desc, count, isNull } from "drizzle-orm";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function hashEmail(email: string): string {
  return crypto.createHash("sha256").update(email.toLowerCase().trim()).digest("hex");
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "10", 10)));

  const conditions = [eq(reviews.status, "published"), eq(reviews.type, "store")];
  const offset = (page - 1) * limit;

  const [rows, countRows, aggregateRows] = await Promise.all([
    db.select().from(reviews).where(and(...conditions)).orderBy(desc(reviews.publishedAt)).limit(limit).offset(offset),
    db.select({ total: count() }).from(reviews).where(and(...conditions)),
    db.select().from(reviewAggregates).where(
      and(eq(reviewAggregates.targetType, "store"), isNull(reviewAggregates.targetId))
    ),
  ]);

  const total = Number(countRows[0]?.total ?? 0);

  const enriched = rows.map((review) => ({
    id: review.id,
    rating: review.rating,
    title: review.title,
    body: review.body,
    source: review.source,
    locale: review.locale,
    country: review.country,
    verificationStatus: review.verificationStatus,
    isVerifiedPurchase: review.verificationStatus === "verified_purchase",
    displayName: review.displayName ?? review.customerName ?? "Client vérifié",
    publishedAt: review.publishedAt,
    createdAt: review.createdAt,
    helpfulCount: review.helpfulCount,
    reviewerEmailHash: hashEmail(review.customerEmail),
    orderId: review.orderId,
  }));

  return NextResponse.json({
    reviews: enriched,
    total,
    page,
    limit,
    aggregate: aggregateRows[0] ?? null,
  });
}
