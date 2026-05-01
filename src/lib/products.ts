import { db } from "@/db";
import { products, categories } from "@/db/schema";
import { eq, isNull, asc, and } from "drizzle-orm";
import type { Product } from "@/db/schema";

export type { Product };

export async function getActiveProducts(): Promise<Product[]> {
  return db
    .select()
    .from(products)
    .where(and(eq(products.status, "active"), isNull(products.deletedAt)))
    .orderBy(asc(products.sortOrder), asc(products.name));
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.slug, slug), eq(products.status, "active"), isNull(products.deletedAt)))
    .limit(1);
  return rows[0];
}

export async function getProductById(id: string): Promise<Product | undefined> {
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), isNull(products.deletedAt)))
    .limit(1);
  return rows[0];
}

export async function getAllProductsForAdmin() {
  return db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      tagline: products.tagline,
      imageUrl: products.imageUrl,
      productFamily: products.productFamily,
      status: products.status,
      sortOrder: products.sortOrder,
      sku: products.sku,
      categoryId: products.categoryId,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
      deletedAt: products.deletedAt,
    })
    .from(products)
    .where(isNull(products.deletedAt))
    .orderBy(asc(products.sortOrder), asc(products.name));
}

export async function generateSlug(name: string, existingId?: string): Promise<string> {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);

  let slug = base;
  let counter = 1;
  while (true) {
    const existing = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, slug))
      .limit(1);
    if (!existing[0] || existing[0].id === existingId) break;
    slug = `${base}-${counter++}`;
  }
  return slug;
}
