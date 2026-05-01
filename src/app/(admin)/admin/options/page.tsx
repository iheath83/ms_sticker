import { getOptionValues, seedOptionValues } from "@/lib/product-catalog-actions";
import { OptionsClient } from "./options-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Options produit — Admin MS Adhésif",
};

export default async function OptionsPage() {
  // Seed on first visit if table is empty
  await seedOptionValues();

  const [shapes, finishes, materials, sizes] = await Promise.all([
    getOptionValues("shape"),
    getOptionValues("finish"),
    getOptionValues("material"),
    getOptionValues("size"),
  ]);

  return <OptionsClient shapes={shapes} finishes={finishes} materials={materials} sizes={sizes} />;
}
