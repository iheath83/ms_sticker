"use server";

import { db } from "@/db";
import { productFamilies } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function getProductFamilies() {
  return db.select().from(productFamilies).orderBy(asc(productFamilies.sortOrder), asc(productFamilies.label));
}

export async function getActiveProductFamilies() {
  return db
    .select()
    .from(productFamilies)
    .where(eq(productFamilies.active, true))
    .orderBy(asc(productFamilies.sortOrder), asc(productFamilies.label));
}

const familySchema = z.object({
  slug:        z.string().min(1).max(100).regex(/^[a-z0-9_-]+$/),
  label:       z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  icon:        z.string().max(10).optional().nullable(),
  active:      z.boolean().default(true),
  sortOrder:   z.number().int().default(0),
});

export async function createProductFamily(data: z.infer<typeof familySchema>) {
  const parsed = familySchema.parse(data);
  const [fam] = await db.insert(productFamilies).values(parsed).returning();
  revalidatePath("/admin/product-families");
  revalidatePath("/admin/products");
  return fam;
}

export async function updateProductFamily(id: string, data: Partial<z.infer<typeof familySchema>>) {
  const parsed = familySchema.partial().parse(data);
  const [fam] = await db
    .update(productFamilies)
    .set({ ...parsed, updatedAt: new Date() })
    .where(eq(productFamilies.id, id))
    .returning();
  revalidatePath("/admin/product-families");
  revalidatePath("/admin/products");
  return fam;
}

export async function deleteProductFamily(id: string) {
  await db.delete(productFamilies).where(eq(productFamilies.id, id));
  revalidatePath("/admin/product-families");
}
