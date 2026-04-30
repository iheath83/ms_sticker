/**
 * GET /api/reviews/schema/product/:productId
 * Returns a ready-to-inject JSON-LD Product schema with AggregateRating + individual Reviews.
 * Use for SSR injection or dynamic enrichment.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reviews, reviewAggregates, products } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

const APP_URL = (process.env.APP_URL ?? "https://msadhesif.fr").replace(/\/$/, "");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { productId } = await params;

  const [[product], [aggregate], publishedReviews] = await Promise.all([
    db.select().from(products).where(eq(products.id, productId)),
    db.select().from(reviewAggregates).where(
      and(eq(reviewAggregates.targetType, "product"), eq(reviewAggregates.targetId, productId))
    ),
    db.select().from(reviews)
      .where(and(eq(reviews.productId, productId), eq(reviews.status, "published"), eq(reviews.type, "product")))
      .orderBy(desc(reviews.publishedAt))
      .limit(20),
  ]);

  if (!product || !aggregate || aggregate.reviewCount === 0) {
    return NextResponse.json({ schema: null });
  }

  const productUrl = `${APP_URL}/products/${product.slug}`;

  const schema = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: product.name,
    description: product.description ?? undefined,
    url: productUrl,
    image: product.imageUrl ?? undefined,
    sku: product.sku ?? product.slug,
    ...(product.gtin ? { gtin: product.gtin } : {}),
    ...(product.mpn ? { mpn: product.mpn } : {}),
    brand: {
      "@type": "Brand",
      name: product.brand ?? "MS Adhésif",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: aggregate.averageRating.toFixed(1),
      reviewCount: aggregate.reviewCount,
      bestRating: "5",
      worstRating: "1",
    },
    review: publishedReviews.map((r) => ({
      "@type": "Review",
      reviewRating: {
        "@type": "Rating",
        ratingValue: String(r.rating),
        bestRating: "5",
        worstRating: "1",
      },
      name: r.title ?? undefined,
      reviewBody: r.body ?? undefined,
      datePublished: (r.publishedAt ?? r.createdAt).toISOString().split("T")[0],
      author: {
        "@type": "Person",
        name: r.displayName ?? r.customerName ?? "Client vérifié",
      },
    })),
  };

  return NextResponse.json({ schema });
}
