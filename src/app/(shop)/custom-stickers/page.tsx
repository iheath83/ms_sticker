import { ProductConfigurator } from "@/components/shop/configurator/product-configurator";
import { getActiveProducts } from "@/lib/products";

export const metadata = {
  title: "Configurateur Stickers — MS Adhésif",
  description:
    "Personnalisez vos stickers die cut, ronds ou carrés. Choisissez la matière, la taille, la quantité. Épreuve numérique gratuite.",
};

export default async function CustomStickersPage() {
  const products = await getActiveProducts().catch(() => []);
  return <ProductConfigurator products={products} />;
}
