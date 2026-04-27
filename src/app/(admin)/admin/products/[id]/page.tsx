import { notFound } from "next/navigation";
import { getProductWithVariants, getCategories } from "@/lib/product-catalog-actions";
import { ProductEditClientV2 } from "@/components/admin/product-edit-client-v2";

export default async function AdminProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [productData, cats] = await Promise.all([
    getProductWithVariants(id),
    getCategories(),
  ]);

  if (!productData) notFound();

  const { variants, ...product } = productData;

  return (
    <ProductEditClientV2
      product={{
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        tagline: product.tagline,
        features: product.features ?? [],
        imageUrl: product.imageUrl,
        images: (product.images as string[]) ?? [],
        categoryId: product.categoryId,
        requiresCustomization: product.requiresCustomization,
        active: product.active,
        sortOrder: product.sortOrder,
      }}
      variants={variants.map((v) => ({
        id: v.id,
        productId: v.productId,
        name: v.name,
        sku: v.sku,
        material: v.material,
        availableFinishes: v.availableFinishes,
        shapes: v.shapes,
        basePriceCents: v.basePriceCents,
        minQty: v.minQty,
        weightGrams: v.weightGrams,
        minWidthMm: v.minWidthMm,
        maxWidthMm: v.maxWidthMm,
        minHeightMm: v.minHeightMm,
        maxHeightMm: v.maxHeightMm,
        tiers: v.tiers as unknown as { minQty: number; discountPct: number }[] | null,
        sizePrices: v.sizePrices as Record<string, number> | null,
        customPresets: v.customPresets as unknown as { id: string; label: string; widthMm: number; heightMm: number }[] | null,
        imageUrl: v.imageUrl,
        images: (v.images as string[]) ?? [],
        active: v.active,
        sortOrder: v.sortOrder,
      }))}
      categories={cats.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
