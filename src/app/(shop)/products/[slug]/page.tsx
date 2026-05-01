import { notFound } from "next/navigation";
import { getActiveProducts, getProductBySlug } from "@/lib/products";
import { getStickerCatalogForProduct } from "@/lib/sticker-catalog-actions";
import { ProductConfigurator } from "@/components/product-configurator/ProductConfigurator";
import { ProductRatingSummary } from "@/components/reviews/ProductRatingSummary";
import { ProductReviews } from "@/components/reviews/ProductReviews";
import { db } from "@/db";
import { reviewAggregates } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  try {
    const products = await getActiveProducts();
    return products.map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

export const dynamicParams = true;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};
  const desc = product.description?.split("\n").find((l) => l.trim() && !l.startsWith("#"))?.trim();
  return {
    title: `${product.name} — MS Adhésif`,
    description: product.seoDescription ?? product.tagline ?? desc,
    ...(product.seoTitle ? { title: product.seoTitle } : {}),
    openGraph: {
      images: product.imageUrl ? [product.imageUrl] : [],
    },
  };
}

async function getProductAggregate(productId: string) {
  try {
    const [agg] = await db
      .select()
      .from(reviewAggregates)
      .where(and(eq(reviewAggregates.targetType, "product"), eq(reviewAggregates.targetId, productId)));
    return agg && agg.reviewCount > 0 ? agg : null;
  } catch {
    return null;
  }
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [aggregate, stickerCatalog] = await Promise.all([
    getProductAggregate(product.id),
    getStickerCatalogForProduct(product.id),
  ]);

  const appUrl = (process.env.APP_URL ?? "https://msadhesif.fr").replace(/\/$/, "");
  const productSchema: Record<string, unknown> = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: product.name,
    url: `${appUrl}/products/${product.slug}`,
    sku: product.sku ?? product.slug,
    brand: { "@type": "Brand", name: product.brand ?? "MS Adhésif" },
    ...(product.gtin ? { gtin: product.gtin } : {}),
    ...(product.mpn ? { mpn: product.mpn } : {}),
    ...(product.imageUrl ? { image: product.imageUrl } : {}),
    ...(product.description
      ? { description: product.description.split("\n").find((l) => l.trim() && !l.startsWith("#"))?.trim() }
      : {}),
    ...(aggregate
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: aggregate.averageRating.toFixed(1),
            reviewCount: aggregate.reviewCount,
            bestRating: "5",
            worstRating: "1",
          },
        }
      : {}),
  };
  const jsonLd = JSON.stringify(productSchema);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      {stickerCatalog ? (
        <ProductConfigurator
          productId={product.id}
          productName={product.name}
          slug={product.slug}
          {...(product.imageUrl ? { imageUrl: product.imageUrl } : {})}
          config={stickerCatalog.config}
          shapes={stickerCatalog.shapes}
          sizes={stickerCatalog.sizes}
          materials={stickerCatalog.materials}
          laminations={stickerCatalog.laminations}
          {...(aggregate ? { aggregate } : {})}
        />
      ) : (
        <div style={{ maxWidth: 900, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: "#0A0E27", marginBottom: 16 }}>{product.name}</h1>
          {product.tagline && <p style={{ fontSize: 18, color: "#6B7280", marginBottom: 24 }}>{product.tagline}</p>}
          {product.description && (
            <div style={{ fontSize: 15, color: "#374151", lineHeight: 1.7, textAlign: "left", maxWidth: 640, margin: "0 auto 40px", whiteSpace: "pre-wrap" }}>
              {product.description}
            </div>
          )}
          <p style={{ color: "#9CA3AF", fontSize: 14 }}>Ce produit n'a pas encore de configurateur actif. Revenez bientôt.</p>
        </div>
      )}

      {product.reviewsEnabled && (
        <div id="avis" className="max-w-4xl mx-auto px-4 pb-16 mt-12">
          <ProductRatingSummary productId={product.id} />
          <ProductReviews productId={product.id} />
        </div>
      )}
    </>
  );
}
