import { notFound } from "next/navigation";
import { getActiveProductsWithVariants, getProductWithVariants } from "@/lib/products";
import { materialToPreview } from "@/lib/product-utils";
import { ProductConfigurator } from "@/components/shop/configurator/product-configurator";
import { ProductDirectTemplate } from "@/components/shop/product-direct-template";
import { QUANTITY_TIERS, type PricingTier, type PricingFinish, type PricingSize, type CustomPreset } from "@/lib/pricing";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const products = await getActiveProductsWithVariants();
  return products.map((p) => ({ slug: p.slug }));
}

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

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductWithVariants(slug);
  if (!product) notFound();

  // ── Non-customizable products get a simpler template ──────────────────────
  if (!product.requiresCustomization) {
    return <ProductDirectTemplate product={product} variants={product.variants} />;
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
  );
}
