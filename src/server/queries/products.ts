/**
 * Data Access Layer — products (read-only).
 */

import { db } from "@/db";
import { products, categories, productVariants } from "@/db/schema";
import { eq, asc, and } from "drizzle-orm";

export async function queryProduct(id: string) {
  const [p] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return p ?? null;
}

export async function queryProductBySlug(slug: string) {
  const [p] = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
  return p ?? null;
}

export async function queryActiveProducts() {
  return db
    .select()
    .from(products)
    .where(and(eq(products.active, true)))
    .orderBy(asc(products.sortOrder));
}

export async function queryCategories() {
  return db
    .select()
    .from(categories)
    .where(eq(categories.active, true))
    .orderBy(asc(categories.sortOrder));
}

export async function queryProductVariants(productId: string) {
  return db
    .select()
    .from(productVariants)
    .where(and(eq(productVariants.productId, productId), eq(productVariants.active, true)))
    .orderBy(asc(productVariants.sortOrder));
}
