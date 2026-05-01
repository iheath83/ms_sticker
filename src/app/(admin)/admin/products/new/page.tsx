import { db } from "@/db";
import { categories } from "@/db/schema";
import { asc } from "drizzle-orm";
import { ProductNewClient } from "@/components/admin/product-new-client";
import { getActiveProductFamilies } from "@/lib/product-family-actions";

export const metadata = { title: "Nouveau produit — Admin" };

export default async function AdminProductNewPage() {
  const [cats, families] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.name)),
    getActiveProductFamilies(),
  ]);
  return (
    <ProductNewClient
      categories={cats}
      families={families.map((f) => ({ slug: f.slug, label: f.label }))}
    />
  );
}
