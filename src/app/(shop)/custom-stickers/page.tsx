import { redirect } from "next/navigation";
import { getActiveProducts } from "@/lib/products";

export const metadata = {
  title: "Stickers personnalisés — MS Adhésif",
  description: "Configurez vos stickers découpés sur mesure. Choisissez la forme, la matière, la taille et la quantité.",
};

export default async function CustomStickersPage() {
  const products = await getActiveProducts().catch(() => []);
  if (products.length === 0) redirect("/products");
  // Redirect to first available product
  return redirect(`/products/${products[0]!.slug}`);
}
