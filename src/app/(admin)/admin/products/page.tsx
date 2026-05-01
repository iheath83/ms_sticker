import { getAllProductsForAdmin } from "@/lib/products";
import { ProductsListClient } from "@/components/admin/products-list-client";

export const metadata = { title: "Produits — Admin" };

export default async function AdminProductsPage() {
  const products = await getAllProductsForAdmin();
  return <ProductsListClient products={products} />;
}
