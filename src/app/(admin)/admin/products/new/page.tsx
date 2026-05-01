import { db } from "@/db";
import { categories } from "@/db/schema";
import { asc } from "drizzle-orm";
import { ProductNewClient } from "@/components/admin/product-new-client";

export const metadata = { title: "Nouveau produit — Admin" };

export default async function AdminProductNewPage() {
  const cats = await db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.name));
  return <ProductNewClient categories={cats} />;
}
