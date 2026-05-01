"use server";

import { db } from "@/db";
import { products } from "@/db/schema";
import { eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generateSlug } from "./products";

const productSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().optional().nullable(),
  tagline: z.string().max(500).optional().nullable(),
  features: z.array(z.string()).optional(),
  imageUrl: z.string().optional().nullable(),
  images: z.array(z.string()).optional(),
  categoryId: z.string().uuid().optional().nullable(),
  productFamily: z.string().min(1).max(100).default("sticker"),
  status: z.enum(["draft", "active", "archived"]).default("active"),
  sku: z.string().max(100).optional().nullable(),
  gtin: z.string().max(50).optional().nullable(),
  mpn: z.string().max(100).optional().nullable(),
  brand: z.string().max(255).optional(),
  seoTitle: z.string().max(255).optional().nullable(),
  seoDescription: z.string().optional().nullable(),
  reviewsEnabled: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export async function createProduct(data: z.infer<typeof productSchema>) {
  const parsed = productSchema.parse(data);
  const slug = parsed.slug ?? (await generateSlug(parsed.name));

  const [product] = await db
    .insert(products)
    .values({
      ...parsed,
      slug,
      brand: parsed.brand ?? "MS Adhésif",
    })
    .returning();

  revalidatePath("/admin/products");
  revalidatePath("/products");
  return product;
}

export async function updateProduct(id: string, data: Partial<z.infer<typeof productSchema>>) {
  const parsed = productSchema.partial().parse(data);

  const [product] = await db
    .update(products)
    .set({ ...parsed, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning();

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}`);
  if (product?.slug) revalidatePath(`/products/${product.slug}`);
  return product;
}

export async function softDeleteProduct(id: string) {
  await db
    .update(products)
    .set({ deletedAt: new Date(), status: "archived", updatedAt: new Date() })
    .where(eq(products.id, id));
  revalidatePath("/admin/products");
  revalidatePath("/products");
}

export async function restoreProduct(id: string) {
  await db
    .update(products)
    .set({ deletedAt: null, status: "active", updatedAt: new Date() })
    .where(eq(products.id, id));
  revalidatePath("/admin/products");
}

export async function duplicateProduct(id: string) {
  const [original] = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  if (!original) throw new Error("Produit introuvable");

  const slug = await generateSlug(`${original.name} copie`);
  const [copy] = await db
    .insert(products)
    .values({
      ...original,
      id: undefined as unknown as string,
      slug,
      name: `${original.name} (copie)`,
      status: "draft",
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  revalidatePath("/admin/products");
  return copy;
}
