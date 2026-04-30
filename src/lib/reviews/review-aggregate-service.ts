import { db } from "@/db";
import { reviews, reviewAggregates } from "@/db/schema";
import { eq, and, avg, count, sql } from "drizzle-orm";

export async function recalculateForProduct(productId: string): Promise<void> {
  const rows = await db
    .select({
      avgRating: avg(reviews.rating),
      total: count(),
      r1: count(sql`CASE WHEN ${reviews.rating} = 1 THEN 1 END`),
      r2: count(sql`CASE WHEN ${reviews.rating} = 2 THEN 1 END`),
      r3: count(sql`CASE WHEN ${reviews.rating} = 3 THEN 1 END`),
      r4: count(sql`CASE WHEN ${reviews.rating} = 4 THEN 1 END`),
      r5: count(sql`CASE WHEN ${reviews.rating} = 5 THEN 1 END`),
      withMedia: count(sql`CASE WHEN EXISTS (SELECT 1 FROM review_media rm WHERE rm.review_id = ${reviews.id} AND rm.status = 'approved') THEN 1 END`),
      verified: count(sql`CASE WHEN ${reviews.verificationStatus} = 'verified_purchase' THEN 1 END`),
    })
    .from(reviews)
    .where(and(eq(reviews.productId, productId), eq(reviews.status, "published"), eq(reviews.type, "product")));

  const row = rows[0];
  const avgRating = row?.avgRating ? parseFloat(String(row.avgRating)) : 0;

  await db
    .insert(reviewAggregates)
    .values({
      targetType: "product",
      targetId: productId,
      averageRating: avgRating,
      reviewCount: Number(row?.total ?? 0),
      rating1Count: Number(row?.r1 ?? 0),
      rating2Count: Number(row?.r2 ?? 0),
      rating3Count: Number(row?.r3 ?? 0),
      rating4Count: Number(row?.r4 ?? 0),
      rating5Count: Number(row?.r5 ?? 0),
      mediaReviewCount: Number(row?.withMedia ?? 0),
      verifiedReviewCount: Number(row?.verified ?? 0),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [reviewAggregates.targetType, reviewAggregates.targetId],
      set: {
        averageRating: sql`EXCLUDED.average_rating`,
        reviewCount: sql`EXCLUDED.review_count`,
        rating1Count: sql`EXCLUDED.rating1_count`,
        rating2Count: sql`EXCLUDED.rating2_count`,
        rating3Count: sql`EXCLUDED.rating3_count`,
        rating4Count: sql`EXCLUDED.rating4_count`,
        rating5Count: sql`EXCLUDED.rating5_count`,
        mediaReviewCount: sql`EXCLUDED.media_review_count`,
        verifiedReviewCount: sql`EXCLUDED.verified_review_count`,
        updatedAt: sql`now()`,
      },
    });
}

export async function recalculateForStore(): Promise<void> {
  const rows = await db
    .select({
      avgRating: avg(reviews.rating),
      total: count(),
      r1: count(sql`CASE WHEN ${reviews.rating} = 1 THEN 1 END`),
      r2: count(sql`CASE WHEN ${reviews.rating} = 2 THEN 1 END`),
      r3: count(sql`CASE WHEN ${reviews.rating} = 3 THEN 1 END`),
      r4: count(sql`CASE WHEN ${reviews.rating} = 4 THEN 1 END`),
      r5: count(sql`CASE WHEN ${reviews.rating} = 5 THEN 1 END`),
      withMedia: count(sql`CASE WHEN EXISTS (SELECT 1 FROM review_media rm WHERE rm.review_id = ${reviews.id} AND rm.status = 'approved') THEN 1 END`),
      verified: count(sql`CASE WHEN ${reviews.verificationStatus} = 'verified_purchase' THEN 1 END`),
    })
    .from(reviews)
    .where(and(eq(reviews.status, "published"), eq(reviews.type, "store")));

  const row = rows[0];
  const avgRating = row?.avgRating ? parseFloat(String(row.avgRating)) : 0;

  await db
    .insert(reviewAggregates)
    .values({
      targetType: "store",
      targetId: null,
      averageRating: avgRating,
      reviewCount: Number(row?.total ?? 0),
      rating1Count: Number(row?.r1 ?? 0),
      rating2Count: Number(row?.r2 ?? 0),
      rating3Count: Number(row?.r3 ?? 0),
      rating4Count: Number(row?.r4 ?? 0),
      rating5Count: Number(row?.r5 ?? 0),
      mediaReviewCount: Number(row?.withMedia ?? 0),
      verifiedReviewCount: Number(row?.verified ?? 0),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [reviewAggregates.targetType, reviewAggregates.targetId],
      set: {
        averageRating: sql`EXCLUDED.average_rating`,
        reviewCount: sql`EXCLUDED.review_count`,
        rating1Count: sql`EXCLUDED.rating1_count`,
        rating2Count: sql`EXCLUDED.rating2_count`,
        rating3Count: sql`EXCLUDED.rating3_count`,
        rating4Count: sql`EXCLUDED.rating4_count`,
        rating5Count: sql`EXCLUDED.rating5_count`,
        mediaReviewCount: sql`EXCLUDED.media_review_count`,
        verifiedReviewCount: sql`EXCLUDED.verified_review_count`,
        updatedAt: sql`now()`,
      },
    });
}
