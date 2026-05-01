import { notFound } from "next/navigation";
import { getActiveProductsWithVariants, getProductWithVariants } from "@/lib/products";
import { materialToPreview } from "@/lib/product-utils";
import { ProductConfigurator } from "@/components/shop/configurator/product-configurator";
import { ProductDirectTemplate } from "@/components/shop/product-direct-template";
import { StickerConfigurator } from "@/components/shop/sticker-configurator";
import { QUANTITY_TIERS, type PricingTier, type PricingFinish, type PricingSize, type CustomPreset } from "@/lib/pricing";
import { ProductRatingSummary } from "@/components/reviews/ProductRatingSummary";
import { ProductReviews } from "@/components/reviews/ProductReviews";
import { getStickerCatalogForProduct } from "@/lib/sticker-catalog-actions";
import { db } from "@/db";
import { reviewAggregates } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  try {
    const products = await getActiveProductsWithVariants();
    return products.map((p) => ({ slug: p.slug }));
  } catch {
    // DB not available at build time — pages rendered on demand at runtime
    return [];
  }
}

export const dynamicParams = true;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductWithVariants(slug);
  if (!product) return {};
  const tagline = product.tagline;
  const desc = product.description?.split("\n").find((l) => l.trim() && !l.startsWith("#"))?.trim();

  return {
    title: `${product.name} — MS Adhésif`,
    description: tagline ?? desc,
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
  const product = await getProductWithVariants(slug);
  if (!product) notFound();

  const aggregate = await getProductAggregate(product.id);

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
      ? {
          description: product.description
            .split("\n")
            .find((l) => l.trim() && !l.startsWith("#"))
            ?.trim(),
        }
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

  // ── New sticker configurator system ───────────────────────────────────────
  const stickerCatalog = await getStickerCatalogForProduct(product.id);
  if (stickerCatalog) {
    const { config, shapes, sizes, materials, laminations, cutTypes } = stickerCatalog;
    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px 0" }}>
          <h1 style={{ fontFamily: "var(--font-archivo, system-ui)", fontSize: 36, fontWeight: 900, color: "#0A0E27", margin: "0 0 8px" }}>
            {product.name}
          </h1>
          {product.tagline && (
            <p style={{ fontSize: 16, color: "#6B7280", margin: "0 0 24px" }}>{product.tagline}</p>
          )}
        </div>
        <StickerConfigurator
          productId={product.id}
          productName={product.name}
          {...(product.imageUrl ? { imageUrl: product.imageUrl } : {})}
          config={config}
          shapes={shapes}
          sizes={sizes}
          materials={materials}
          laminations={laminations}
          cutTypes={cutTypes}
        />
        {product.reviewsEnabled && (
          <div className="max-w-4xl mx-auto px-4 pb-16">
            <ProductRatingSummary productId={product.id} />
            <ProductReviews productId={product.id} />
          </div>
        )}
      </>
    );
  }

  // ── Non-customizable products get a simpler template ──────────────────────
  if (!product.requiresCustomization) {
    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
        <ProductDirectTemplate product={product} variants={product.variants} />
        {product.reviewsEnabled && (
          <div className="max-w-4xl mx-auto px-4 pb-16">
            <ProductRatingSummary productId={product.id} />
            <ProductReviews productId={product.id} />
          </div>
        )}
      </>
    );
  }

  // ── Customizable products: existing configurator ───────────────────────────
  // Fall back to legacy product fields if no variants (should not happen after migration)
  const variants = product.variants;
  const primaryVariant = variants[0];

  const defaultMaterial = primaryVariant
    ? materialToPreview(primaryVariant.material)
    : materialToPreview(product.material);

  const defaultShape = primaryVariant
    ? ((primaryVariant.shapes?.[0] ?? "die-cut") as "die-cut" | "circle" | "square" | "rectangle")
    : ((product.shapes?.[0] ?? "die-cut") as "die-cut" | "circle" | "square" | "rectangle");

  // For backward compat: if no variants exist, read from products.options
  const opts = (product.options ?? {}) as Record<string, unknown>;

  // Build features, tagline
  const features =
    product.features?.length
      ? product.features
      : Array.isArray(opts.features)
      ? (opts.features as string[])
      : undefined;
  const tagline = product.tagline ?? (typeof opts.tagline === "string" ? opts.tagline : undefined);

  // Use primary variant data if available, otherwise fall back to legacy product fields
  const pricingTiers: ReadonlyArray<PricingTier> = primaryVariant?.tiers?.length
    ? (primaryVariant.tiers as PricingTier[])
    : Array.isArray(opts.tiers)
    ? (opts.tiers as PricingTier[])
    : QUANTITY_TIERS;

  const allFinishes: PricingFinish[] = ["gloss", "matte", "uv-laminated"];
  const availableFinishes: PricingFinish[] = primaryVariant?.availableFinishes?.length
    ? (primaryVariant.availableFinishes as PricingFinish[]).filter((f) => allFinishes.includes(f))
    : Array.isArray(opts.availableFinishes)
    ? (opts.availableFinishes as PricingFinish[]).filter((f) => allFinishes.includes(f))
    : allFinishes;

  const allSizes: PricingSize[] = ["2x2", "3x3", "4x4", "5x5", "7x7", "custom"];
  const availableSizes: PricingSize[] = Array.isArray(opts.availableSizes)
    ? (opts.availableSizes as PricingSize[]).filter((s) => allSizes.includes(s))
    : allSizes;

  const sizePrices: Record<string, number> = primaryVariant?.sizePrices
    ? (primaryVariant.sizePrices as Record<string, number>)
    : opts.sizePrices !== null && typeof opts.sizePrices === "object" && !Array.isArray(opts.sizePrices)
    ? (opts.sizePrices as Record<string, number>)
    : {};

  const customPresets: CustomPreset[] = primaryVariant?.customPresets?.length
    ? (primaryVariant.customPresets as CustomPreset[]).filter(
        (p) => p.id && p.label && typeof p.widthMm === "number" && typeof p.heightMm === "number",
      )
    : Array.isArray(opts.customPresets)
    ? (opts.customPresets as CustomPreset[]).filter(
        (p) => p.id && p.label && typeof p.widthMm === "number" && typeof p.heightMm === "number",
      )
    : [];

  const minQty = primaryVariant?.minQty ?? product.minQty ?? 1;

  // Build product list for material switcher (other variants of this product + all active products)
  // Each variant maps to a "product-like" object for the configurator
  const allActiveProducts = await getActiveProductsWithVariants();

  // Available materials from variants
  const availableMaterials: string[] = variants.length
    ? [...new Set(variants.map((v) => v.material))]
    : Array.isArray(opts.availableMaterials)
    ? (opts.availableMaterials as string[])
    : allActiveProducts.map((p) => p.material);

  const filteredProducts = allActiveProducts.filter((p) =>
    availableMaterials.includes(p.material),
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <ProductConfigurator
        products={filteredProducts.length > 0 ? filteredProducts : allActiveProducts}
        defaultMaterial={defaultMaterial}
        defaultShape={defaultShape}
        productName={product.name}
        description={tagline ?? product.description ?? undefined}
        imageUrl={product.imageUrl ?? undefined}
        features={features}
        pricingTiers={pricingTiers}
        availableFinishes={availableFinishes.length > 0 ? availableFinishes : allFinishes}
        availableSizes={availableSizes.length > 0 ? availableSizes : allSizes}
        minQty={minQty}
        sizePrices={sizePrices}
        customPresets={customPresets}
      />
      {product.reviewsEnabled && (
        <div className="max-w-4xl mx-auto px-4 pb-16">
          <ProductRatingSummary productId={product.id} />
          <ProductReviews productId={product.id} />
        </div>
      )}
    </>
  );
}
