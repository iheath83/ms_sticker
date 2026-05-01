// Server-only module — imports DB, do NOT import from Client Components
import { db } from "@/db";
import { products, productVariants, categories } from "@/db/schema";
import { eq, asc, isNull, inArray, and } from "drizzle-orm";
import type { Product, ProductVariant, Category } from "@/db/schema";

export type { Product, ProductVariant, Category };
export type ProductWithVariants = Product & {
  variants: ProductVariant[];
  category?: Category | null;
};

export { materialToPreview, formatPriceCents } from "./product-utils";

export async function getActiveProducts(): Promise<Product[]> {
  return db
    .select()
    .from(products)
    .where(and(eq(products.active, true), isNull(products.deletedAt)))
    .orderBy(asc(products.sortOrder));
}

export async function getActiveProductsWithVariants(): Promise<ProductWithVariants[]> {
  const prods = await db
    .select()
    .from(products)
    .where(and(eq(products.active, true), isNull(products.deletedAt)))
    .orderBy(asc(products.sortOrder));

  if (!prods.length) return [];

  const productIds = prods.map((p) => p.id);
  const allVariants = await db
    .select()
    .from(productVariants)
    .where(inArray(productVariants.productId, productIds))
    .orderBy(asc(productVariants.sortOrder));

  const catIds = [...new Set(prods.map((p) => p.categoryId).filter(Boolean))] as string[];
  const allCats = catIds.length
    ? await db.select().from(categories).where(inArray(categories.id, catIds))
    : [];
  const catMap = new Map(allCats.map((c) => [c.id, c]));

  return prods.map((p) => ({
    ...p,
    variants: allVariants.filter((v) => v.productId === p.id && v.active),
    category: p.categoryId ? (catMap.get(p.categoryId) ?? null) : null,
  }));
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.slug, slug), isNull(products.deletedAt), eq(products.active, true)))
    .limit(1);
  return rows[0];
}

export async function getProductWithVariants(slug: string): Promise<ProductWithVariants | undefined> {
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.slug, slug), isNull(products.deletedAt), eq(products.active, true)))
    .limit(1);
  const product = rows[0];
  if (!product) return undefined;

  const variants = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, product.id))
    .orderBy(asc(productVariants.sortOrder));

  let category: Category | null = null;
  if (product.categoryId) {
    const catRows = await db.select().from(categories).where(eq(categories.id, product.categoryId)).limit(1);
    category = catRows[0] ?? null;
  }

  return { ...product, variants: variants.filter((v) => v.active), category };
}

export async function getActiveCategories(): Promise<Category[]> {
  return db
    .select()
    .from(categories)
    .where(eq(categories.active, true))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
}
