import { getCategories } from "@/lib/product-catalog-actions";
import { ProductNewClient } from "@/components/admin/product-new-client";

export default async function AdminProductNewPage() {
  const categories = await getCategories();
  return (
    <ProductNewClient
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
