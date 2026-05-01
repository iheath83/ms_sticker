import { getProductFamilies } from "@/lib/product-family-actions";
import { ProductFamiliesClient } from "./product-families-client";

export const metadata = { title: "Familles de produit — Admin" };

export default async function AdminProductFamiliesPage() {
  const families = await getProductFamilies();
  return <ProductFamiliesClient families={families} />;
}
