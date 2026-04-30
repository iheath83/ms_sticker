import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reviews, reviewMedia, reviewReplies, reviewAggregates } from "@/db/schema";
import { eq, and, desc, asc, count, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { productId } = await params;
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "10", 10)));
  const sort = url.searchParams.get("sort") ?? "recent";
  const rating = url.searchParams.get("rating") ? parseInt(url.searchParams.get("rating")!, 10) : undefined;

  const conditions = [
    eq(reviews.productId, productId),
    eq(reviews.status, "published"),
    eq(reviews.type, "product"),
  ];

  if (rating) conditions.push(eq(reviews.rating, rating));

  const orderBy = sort === "helpful"
    ? desc(reviews.helpfulCount)
    : sort === "rating_asc"
    ? asc(reviews.rating)
    : sort === "rating_desc"
    ? desc(reviews.rating)
    : desc(reviews.publishedAt);

  const offset = (page - 1) * limit;

  const [rows, countRows, aggregateRows] = await Promise.all([
    db.select().from(reviews).where(and(...conditions)).orderBy(orderBy).limit(limit).offset(offset),
    db.select({ total: count() }).from(reviews).where(and(...conditions)),
    db.select().from(reviewAggregates).where(
      and(eq(reviewAggregates.targetType, "product"), eq(reviewAggregates.targetId, productId))
    ),
  ]);

  const total = Number(countRows[0]?.total ?? 0);
  const aggregate = aggregateRows[0] ?? null;

  // Attach media and replies
  const reviewIds = rows.map((r) => r.id);
  let mediaMap = new Map<string, typeof reviewMedia.$inferSelect[]>();
  let replyMap = new Map<string, typeof reviewReplies.$inferSelect>();

  if (reviewIds.length > 0) {
    const allMedia = await db
      .select()
      .from(reviewMedia)
      .where(and(eq(reviewMedia.status, "approved"), sql`${reviewMedia.reviewId} = ANY(${sql.raw(`ARRAY[${reviewIds.map((id) => `'${id}'`).join(",")}]::uuid[]`)})`));

    const allReplies = await db
      .select()
      .from(reviewReplies)
      .where(sql`${reviewReplies.reviewId} = ANY(${sql.raw(`ARRAY[${reviewIds.map((id) => `'${id}'`).join(",")}]::uuid[]`)})`);

    for (const m of allMedia) {
      const arr = mediaMap.get(m.reviewId) ?? [];
      arr.push(m);
      mediaMap.set(m.reviewId, arr);
    }
    for (const r of allReplies) {
      replyMap.set(r.reviewId, r);
    }
  }

  const enriched = rows.map((r) => ({
    ...r,
    media: mediaMap.get(r.id) ?? [],
    reply: replyMap.get(r.id) ?? null,
  }));

  return NextResponse.json({
    reviews: enriched,
    total: Number(total),
    page,
    limit,
    aggregate: aggregate ?? null,
  });
}
