import { Header } from "@/components/shop/header";
import { Footer } from "@/components/shop/footer";
import { CartDrawer } from "@/components/shop/cart-drawer";
import { CartProvider } from "@/components/shop/cart-context";
import { CookieBanner } from "@/components/shop/cookie-banner";
import { getActiveProducts } from "@/lib/products";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const products = await getActiveProducts();

  return (
    <CartProvider>
      <Header products={products} />
      {children}
      <Footer />
      <CartDrawer />
      <CookieBanner />
    </CartProvider>
  );
}
