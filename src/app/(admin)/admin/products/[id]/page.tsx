import { notFound } from "next/navigation";
import { db } from "@/db";
import { products, categories } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import {
  getProductStickerConfig,
  getAllStickerShapes,
  getAllStickerSizes,
  getAllStickerMaterials,
  getAllStickerLaminations,
} from "@/lib/sticker-catalog-actions";
import { getActiveProductFamilies } from "@/lib/product-family-actions";
import { ProductEditClient } from "@/components/admin/product-edit-client";
import { StickerConfigTab } from "@/components/admin/sticker-config-tab";

export default async function AdminProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [productRows, cats, families, stickerConfig, stickerShapes, stickerSizes, stickerMaterials, stickerLaminations] = await Promise.all([
    db.select().from(products).where(eq(products.id, id)).limit(1),
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.name)),
    getActiveProductFamilies(),
    getProductStickerConfig(id),
    getAllStickerShapes(),
    getAllStickerSizes(),
    getAllStickerMaterials(),
    getAllStickerLaminations(),
  ]);

  const product = productRows[0];
  if (!product) notFound();

  return (
    <ProductEditClient
      product={product}
      categories={cats}
      families={families.map((f) => ({ slug: f.slug, label: f.label }))}
      stickerConfigTab={
        <StickerConfigTab
          productId={id}
          config={stickerConfig}
          shapes={stickerShapes}
          sizes={stickerSizes}
          materials={stickerMaterials}
          laminations={stickerLaminations}
        />
      }
    />
  );
}
