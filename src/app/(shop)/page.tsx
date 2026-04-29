export const dynamic = "force-dynamic";

import { HeroSection } from "@/components/shop/home/hero-section";
import { CategoriesSection } from "@/components/shop/home/categories-section";
import { FeatureStrip } from "@/components/shop/home/feature-strip";
import { BestSellersSection } from "@/components/shop/home/bestsellers-section";
import { ProcessSection } from "@/components/shop/home/process-section";
import { ReviewsSection } from "@/components/shop/home/reviews-section";
import { getActiveProducts, getActiveCategories } from "@/lib/products";

export default async function HomePage() {
  const [products, categories] = await Promise.all([
    getActiveProducts().catch(() => []),
    getActiveCategories().catch(() => []),
  ]);

  return (
    <main>
      <HeroSection />
      <CategoriesSection categories={categories} />
      <FeatureStrip />
      <BestSellersSection products={products} />
      <ProcessSection />
      <ReviewsSection />
    </main>
  );
}
