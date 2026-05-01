"use server";

import { db } from "@/db";
import { categories } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function getCategories() {
  return db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function getCategoryById(id: string) {
  const rows = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return rows[0] ?? null;
}

const categorySchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100),
  description: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  parentId: z.string().uuid().optional().nullable(),
});

export async function createCategory(data: z.infer<typeof categorySchema>) {
  const parsed = categorySchema.parse(data);
  const [cat] = await db.insert(categories).values(parsed).returning();
  revalidatePath("/admin/categories");
  return cat;
}

export async function updateCategory(id: string, data: Partial<z.infer<typeof categorySchema>>) {
  const parsed = categorySchema.partial().parse(data);
  const [cat] = await db.update(categories).set({ ...parsed, updatedAt: new Date() }).where(eq(categories.id, id)).returning();
  revalidatePath("/admin/categories");
  return cat;
}

export async function deleteCategory(id: string) {
  await db.delete(categories).where(eq(categories.id, id));
  revalidatePath("/admin/categories");
}
