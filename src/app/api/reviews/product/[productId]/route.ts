/**
 * GET /api/reviews/product/:productId
 * Public endpoint returning published reviews for a product with Google-compatible fields.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reviews, reviewMedia, reviewReplies, reviewAggregates, products } from "@/db/schema";
import { eq, and, desc, count, inArray, sql } from "drizzle-orm";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const APP_URL = (process.env.APP_URL ?? "https://msadhesif.fr").replace(/\/$/, "");

function hashEmail(email: string): string {
  return crypto.createHash("sha256").update(email.toLowerCase().trim()).digest("hex");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { productId } = await params;
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "10", 10)));

  const conditions = [
    eq(reviews.productId, productId),
    eq(reviews.status, "published"),
    eq(reviews.type, "product"),
  ];

  const offset = (page - 1) * limit;

  const [rows, countRows, aggregateRows, [product]] = await Promise.all([
    db.select().from(reviews).where(and(...conditions)).orderBy(desc(reviews.publishedAt)).limit(limit).offset(offset),
    db.select({ total: count() }).from(reviews).where(and(...conditions)),
    db.select().from(reviewAggregates).where(
      and(eq(reviewAggregates.targetType, "product"), eq(reviewAggregates.targetId, productId))
    ),
    db.select().from(products).where(eq(products.id, productId)),
  ]);

  const total = Number(countRows[0]?.total ?? 0);
  const aggregate = aggregateRows[0] ?? null;

  // Attach media
  const reviewIds = rows.map((r) => r.id);
  const mediaMap = new Map<string, typeof reviewMedia.$inferSelect[]>();
  const replyMap = new Map<string, typeof reviewReplies.$inferSelect>();

  if (reviewIds.length > 0) {
    const allMedia = await db.select().from(reviewMedia)
      .where(and(eq(reviewMedia.status, "approved"), inArray(reviewMedia.reviewId, reviewIds)));
    const allReplies = await db.select().from(reviewReplies)
      .where(inArray(reviewReplies.reviewId, reviewIds));

    for (const m of allMedia) {
      const arr = mediaMap.get(m.reviewId) ?? [];
      arr.push(m);
      mediaMap.set(m.reviewId, arr);
    }
    for (const r of allReplies) replyMap.set(r.reviewId, r);
  }

  const enriched = rows.map((review) => ({
    // Standard fields
    id: review.id,
    rating: review.rating,
    title: review.title,
    body: review.body,
    status: review.status,
    source: review.source,
    locale: review.locale,
    country: review.country,
    verificationStatus: review.verificationStatus,
    isVerifiedPurchase: review.verificationStatus === "verified_purchase",
    displayName: review.displayName ?? review.customerName ?? "Client vérifié",
    publishedAt: review.publishedAt,
    createdAt: review.createdAt,
    helpfulCount: review.helpfulCount,
    media: mediaMap.get(review.id) ?? [],
    reply: replyMap.get(review.id) ?? null,
    // Google-compatible fields
    reviewUrl: `${APP_URL}/products/${product?.slug ?? productId}#review-${review.id}`,
    reviewerEmailHash: hashEmail(review.customerEmail),
    orderId: review.orderId,
    productId: review.productId,
    productSku: product?.sku ?? product?.slug ?? productId,
    productGtin: product?.gtin ?? null,
    productMpn: product?.mpn ?? null,
    productBrand: product?.brand ?? "MS Adhésif",
    productName: product?.name ?? null,
    productUrl: product ? `${APP_URL}/products/${product.slug}` : null,
  }));

  return NextResponse.json({
    reviews: enriched,
    total,
    page,
    limit,
    aggregate,
    product: product
      ? {
          id: product.id,
          name: product.name,
          slug: product.slug,
          sku: product.sku ?? product.slug,
          gtin: product.gtin,
          mpn: product.mpn,
          brand: product.brand,
          url: `${APP_URL}/products/${product.slug}`,
          imageUrl: product.imageUrl,
        }
      : null,
  });
}
