import { getCategories, getActiveOptionValues } from "@/lib/product-catalog-actions";
import { ProductNewClient } from "@/components/admin/product-new-client";

export default async function AdminProductNewPage() {
  const [categories, materials] = await Promise.all([
    getCategories(),
    getActiveOptionValues("material"),
  ]);
  return (
    <ProductNewClient
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      materials={materials.map((m) => ({ slug: m.slug, label: m.label }))}
    />
  );
}
